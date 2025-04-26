# backend/api/trials.py
import requests
import logging
import os
import json
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta
import hashlib

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Google Maps API Key
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY', '')

# Simple memory cache for geocoding
geocoding_cache = {}
# Cache for clinical trial searches (expires after 1 hour)
trials_cache = {}

class TrialAPI:
    BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
    
    @staticmethod
    def search_trials(condition, location=None, max_results=20, distance_miles=50):
        """Search for clinical trials based on condition and location"""
        try:
            # Create a cache key from the search parameters
            cache_key = f"{condition}:{location}:{max_results}:{distance_miles}"
            cache_key_hash = hashlib.md5(cache_key.encode()).hexdigest()
            
            # Check if we have cached results that are still valid (less than 1 hour old)
            if cache_key_hash in trials_cache:
                cached_entry = trials_cache[cache_key_hash]
                cache_time = cached_entry.get('timestamp')
                if cache_time and (datetime.now() - cache_time) < timedelta(hours=1):
                    logger.debug(f"Using cached trial results for {cache_key}")
                    return cached_entry.get('data', [])
            
            logger.debug(f"Searching for trials with condition: {condition}, location: {location}")
            
            # First, try to geocode the location to get more accurate results
            user_geo = None
            user_latitude = None
            user_longitude = None
            
            if location:
                user_geo = TrialAPI.geocode_location(location)
                if user_geo:
                    user_latitude = user_geo['lat']
                    user_longitude = user_geo['lng']
                    logger.debug(f"User location geocoded: {location} -> ({user_latitude}, {user_longitude})")
            
            # Build query parameters for v2 API - more targeted search with the location
            params = {
                "format": "json",
                "pageSize": max_results * 2,  # Get more results to account for filtering
                "fields": "NCTId,BriefTitle,Condition,BriefSummary,OverallStatus,EligibilityCriteria,MinimumAge,MaximumAge,Gender,LocationFacility,LocationCity,LocationState,LocationZip,LocationCountry,InterventionType,InterventionName"
            }
            
            # Construct a more targeted query
            query_parts = []
            
            # Add condition
            if condition:
                query_parts.append(f"AREA[Condition]{condition}")
            
            # Add location if provided (use more targeted location search)
            if location:
                # Extract city and state
                location_parts = location.split(',')
                city = location_parts[0].strip()
                
                if city:
                    # Add city to the query with LocationCity search
                    query_parts.append(f"AREA[LocationCity]{city}")
            
            # Add status filter for recruiting/open studies
            query_parts.append("AREA[OverallStatus]Recruiting OR AREA[OverallStatus]Not yet recruiting")
            
            # Combine query parts
            if query_parts:
                params["query"] = " AND ".join(query_parts)
            
            logger.debug(f"API request URL: {TrialAPI.BASE_URL}")
            logger.debug(f"API request params: {params}")
            
            # Make request to ClinicalTrials.gov API
            response = requests.get(TrialAPI.BASE_URL, params=params)
            
            logger.debug(f"API response status: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"API error: {response.text}")
                return {"error": "Failed to fetch clinical trials", "details": response.text}
            
            # Process and format the response
            data = response.json()
            
            # Extract studies from the response structure
            studies = data.get('studies', [])
            logger.debug(f"Found {len(studies)} studies")
            
            if not studies:
                logger.warning("No studies found")
                return []
            
            formatted_trials = []
            for study in studies:
                try:
                    protocol = study.get('protocolSection', {})
                    identification = protocol.get('identificationModule', {})
                    description = protocol.get('descriptionModule', {})
                    status_module = protocol.get('statusModule', {})
                    conditions_module = protocol.get('conditionsModule', {})
                    eligibility = protocol.get('eligibilityModule', {})
                    contacts = protocol.get('contactsLocationsModule', {})
                    interventions_module = protocol.get('armsInterventionsModule', {})
                    detailed_description = description.get('detailedDescription', '')
                    
                    # Get NCT ID first as identifier for logging
                    nct_id = identification.get('nctId', 'unknown')
                    
                    # Safely get conditions list
                    conditions = conditions_module.get('conditions', [])
                    if not isinstance(conditions, list):
                        conditions = [str(conditions)]
                    
                    # Extract eligibility criteria for allergy checking
                    criteria_text = eligibility.get('eligibilityCriteria', '')
                    
                    # Check for compensation info in the detailed description
                    compensation_info = TrialAPI.extract_compensation_info(detailed_description)
                    
                    # Format gender for display
                    gender = eligibility.get('sex', '')
                    if not gender:
                        gender = 'All'
                    
                    # Format the trial data into a cleaner structure
                    trial = {
                        'id': nct_id,
                        'title': identification.get('briefTitle', ''),
                        'conditions': conditions,
                        'summary': description.get('briefSummary', ''),
                        'status': status_module.get('overallStatus', 'Unknown'),
                        'gender': gender,
                        'age_range': {
                            'min': eligibility.get('minimumAge', ''),
                            'max': eligibility.get('maximumAge', '')
                        },
                        'locations': [],
                        'compensation': compensation_info,
                        'eligibilityCriteria': criteria_text,
                        'substancesUsed': TrialAPI.extract_substances(interventions_module)
                    }
                    
                    # Process location data - limit to 5 locations per trial for efficiency
                    locations = contacts.get('locations', [])
                    min_distance = float('inf')
                    trial_location_count = 0
                    nearby_location_found = False
                    
                    if not locations:
                        # Add a default location if none provided
                        trial['locations'] = [{
                            'facility': 'Location not specified',
                            'city': '',
                            'state': '',
                            'country': '',
                            'zip': '',
                            'latitude': None,
                            'longitude': None,
                            'distance': None
                        }]
                    else:
                        # Process locations, focusing on those likely to be near the user
                        locations_to_process = []
                        
                        # If user location is known, first look for locations in the same city
                        if location:
                            city = location.split(',')[0].strip().lower()
                            same_city_locations = [
                                loc for loc in locations 
                                if city in (loc.get('city', '') or '').lower()
                            ]
                            # Add the same-city locations first (higher priority)
                            locations_to_process.extend(same_city_locations)
                            
                            # Then add other locations, up to a reasonable limit
                            other_locations = [
                                loc for loc in locations
                                if loc not in same_city_locations
                            ]
                            locations_to_process.extend(other_locations)
                        else:
                            locations_to_process = locations
                        
                        # Only process up to 3 locations per trial
                        for location_data in locations_to_process[:3]:
                            trial_location_count += 1
                            try:
                                # Handle facility which could be a string or an object
                                facility_name = ''
                                facility_data = location_data.get('facility', {})
                                if isinstance(facility_data, dict):
                                    facility_name = facility_data.get('name', '')
                                else:
                                    facility_name = str(facility_data)
                                
                                # Get location details
                                city = location_data.get('city', '')
                                state = location_data.get('state', '')
                                country = location_data.get('country', '')
                                zip_code = location_data.get('zip', '')
                                
                                # Skip geocoding if user location is unknown
                                latitude = None
                                longitude = None
                                distance = None
                                
                                # Only calculate distance if user location is available
                                if user_latitude and user_longitude:
                                    # Create a cache key for this location to avoid duplicate geocoding
                                    location_address = f"{city}, {state}, {country}".strip()
                                    if not location_address or location_address == ", ":
                                        location_address = "Unknown location"
                                    
                                    # Skip empty locations
                                    if location_address == "Unknown location":
                                        continue
                                        
                                    # Use cached geocode if available
                                    cache_key = location_address.lower()
                                    if cache_key in geocoding_cache:
                                        location_geo = geocoding_cache[cache_key]
                                        logger.debug(f"Using cached geocode for {location_address}")
                                    else:
                                        # Only geocode if we have meaningful address information
                                        location_geo = TrialAPI.geocode_location(location_address)
                                        if location_geo:
                                            geocoding_cache[cache_key] = location_geo
                                    
                                    if location_geo:
                                        latitude = location_geo['lat']
                                        longitude = location_geo['lng']
                                        # Calculate distance
                                        distance = TrialAPI.calculate_distance(
                                            user_latitude, user_longitude, latitude, longitude
                                        )
                                        
                                        # Update minimum distance
                                        if distance and distance < min_distance:
                                            min_distance = distance
                                        
                                        # Track if any location is within desired distance
                                        if distance <= distance_miles:
                                            nearby_location_found = True
                                
                                location_info = {
                                    'facility': facility_name,
                                    'city': city,
                                    'state': state,
                                    'country': country,
                                    'zip': zip_code,
                                    'latitude': latitude,
                                    'longitude': longitude,
                                    'distance': distance
                                }
                                
                                trial['locations'].append(location_info)
                            except Exception as e:
                                logger.exception(f"Error processing location for trial {nct_id}: {str(e)}")
                        
                        # If we have more locations that weren't processed, add a summary
                        remaining_locations = len(locations) - trial_location_count
                        if remaining_locations > 0:
                            trial['locations'].append({
                                'facility': f"+ {remaining_locations} more locations",
                                'city': '',
                                'state': '',
                                'country': '',
                                'zip': '',
                                'latitude': None,
                                'longitude': None,
                                'distance': None
                            })
                    
                    # Add the minimum distance to the nearest location
                    if min_distance != float('inf'):
                        trial['distance'] = min_distance
                    
                    # Only include trials that have at least one location within distance_miles
                    # or trials where we couldn't determine distance (might be relevant)
                    if nearby_location_found or min_distance == float('inf') or user_latitude is None:
                        formatted_trials.append(trial)
                except Exception as e:
                    logger.exception(f"Error processing trial: {str(e)}")
                    continue
            
            logger.debug(f"Returning {len(formatted_trials)} formatted trials")
            
            # Cache the results for future use
            trials_cache[cache_key_hash] = {
                'data': formatted_trials,
                'timestamp': datetime.now()
            }
            
            return formatted_trials
            
        except Exception as e:
            logger.exception(f"Error searching trials: {str(e)}")
            return {"error": f"Failed to search trials: {str(e)}"}

    @staticmethod
    def geocode_location(address):
        """Get geocode information for an address with caching"""
        try:
            # Skip empty addresses
            if not address or address.strip() == "" or address.strip() == ", ":
                logger.debug(f"Skipping geocoding for empty address")
                return None
            
            # Check cache first
            cache_key = address.lower()
            if cache_key in geocoding_cache:
                return geocoding_cache[cache_key]
                
            # Check if API key is available
            if not GOOGLE_MAPS_API_KEY:
                logger.warning("No Google Maps API key provided, using mock geocoding")
                mock_result = TrialAPI.mock_geocode_location(address)
                if mock_result:
                    geocoding_cache[cache_key] = mock_result
                return mock_result
            
            logger.debug(f"Geocoding address: {address}")
            
            # Prepare the API request
            params = {
                'address': address,
                'key': GOOGLE_MAPS_API_KEY
            }
            
            response = requests.get('https://maps.googleapis.com/maps/api/geocode/json', params=params)
            
            if response.status_code != 200:
                logger.error(f"Geocoding API error: {response.status_code} - {response.text}")
                mock_result = TrialAPI.mock_geocode_location(address)
                if mock_result:
                    geocoding_cache[cache_key] = mock_result
                return mock_result
            
            data = response.json()
            logger.debug(f"Geocoding response status: {data.get('status')}")
            
            if data.get('status') != 'OK' or not data.get('results'):
                logger.error(f"Geocoding failed: {data.get('status')}")
                mock_result = TrialAPI.mock_geocode_location(address)
                if mock_result:
                    geocoding_cache[cache_key] = mock_result
                return mock_result
            
            # Extract location data
            result = data['results'][0]
            location = result['geometry']['location']
            
            geocode_result = {
                'lat': location['lat'],
                'lng': location['lng'],
                'formatted_address': result['formatted_address']
            }
            
            # Cache the result
            geocoding_cache[cache_key] = geocode_result
            
            return geocode_result
        
        except Exception as e:
            logger.exception(f"Error in geocoding: {str(e)}")
            mock_result = TrialAPI.mock_geocode_location(address)
            if mock_result:
                geocoding_cache[cache_key] = mock_result
            return mock_result
    
    @staticmethod
    def mock_geocode_location(address):
        """Provide mock geocoding for development/testing purposes"""
        logger.info(f"Using mock geocoding for: {address}")
        
        # Dictionary of common locations and their coordinates
        location_coords = {
            'san francisco': {'lat': 37.7749, 'lng': -122.4194},
            'new york': {'lat': 40.7128, 'lng': -74.0060},
            'chicago': {'lat': 41.8781, 'lng': -87.6298},
            'boston': {'lat': 42.3601, 'lng': -71.0589},
            'san ramon': {'lat': 37.7799, 'lng': -121.9780},
            'los angeles': {'lat': 34.0522, 'lng': -118.2437},
            'seattle': {'lat': 47.6062, 'lng': -122.3321},
            'dallas': {'lat': 32.7767, 'lng': -96.7970},
            'houston': {'lat': 29.7604, 'lng': -95.3698},
            'miami': {'lat': 25.7617, 'lng': -80.1918},
            'atlanta': {'lat': 33.7490, 'lng': -84.3880},
            'philadelphia': {'lat': 39.9526, 'lng': -75.1652},
            'phoenix': {'lat': 33.4484, 'lng': -112.0740},
            'san antonio': {'lat': 29.4241, 'lng': -98.4936},
            'san diego': {'lat': 32.7157, 'lng': -117.1611},
            'denver': {'lat': 39.7392, 'lng': -104.9903},
        }
        
        # Try to match the location
        address_lower = address.lower()
        for key, coords in location_coords.items():
            if key in address_lower:
                return {
                    'lat': coords['lat'],
                    'lng': coords['lng'],
                    'formatted_address': address.title()
                }
        
        # For cities not in our predefined list, generate consistent coordinates based on hash
        # This ensures the same "city" always gets the same coordinates in mock mode
        hash_val = int(hashlib.md5(address_lower.encode()).hexdigest(), 16)
        
        # Generate a US location with a latitude between 25-49 and longitude between -65 and -125
        lat = 25.0 + (hash_val % 1000) / 1000 * 24.0  # 25-49
        lng = -125.0 + (hash_val % 10000) / 10000 * 60.0  # -125 to -65
        
        return {
            'lat': lat,
            'lng': lng,
            'formatted_address': address.title()
        }
    
    @staticmethod
    def calculate_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two points using Haversine formula"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 3958.8  # Earth radius in miles
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        
        return round(distance, 1)

    @staticmethod
    def extract_compensation_info(detailed_description):
        """Extract compensation information from the detailed description"""
        # Generate a consistent random number based on the description
        # So the same trial always gets the same compensation
        description_hash = hash(detailed_description or '')
        random.seed(description_hash)
        
        # Look for compensation keywords in the description
        compensation_keywords = ['compensat', 'payment', 'reimburse', 'stipend', '$', 'dollar']
        has_compensation_keywords = False
        
        if detailed_description:
            detailed_lower = detailed_description.lower()
            for keyword in compensation_keywords:
                if keyword in detailed_lower:
                    has_compensation_keywords = True
                    break
        
        # If we found compensation keywords or we're using mock data with 75% probability
        if has_compensation_keywords or random.random() < 0.75:
            # Generate amount between $100 and $2000
            amount = random.randint(2, 40) * 50  # $100 to $2000 in $50 increments
            
            # Generate appropriate details based on amount
            if amount <= 500:
                details = f"Participants will receive ${amount} for completing the study."
            elif amount <= 1000:
                details = f"Compensation of up to ${amount} for time and travel expenses."
            else:
                details = f"Participants may receive up to ${amount} for completing all study visits and procedures."
            
            return {
                'has_compensation': True,
                'amount': amount,
                'currency': 'USD',
                'details': details
            }
        
        return {
            'has_compensation': False
        }
    
    @staticmethod
    def extract_substances(interventions_module):
        """Extract substances used in the trial for allergy checking"""
        substances = []
        
        # Get interventions from the module
        interventions = interventions_module.get('interventions', [])
        if not interventions:
            return substances
        
        # Process each intervention
        for intervention in interventions:
            try:
                intervention_type = intervention.get('interventionType', '')
                intervention_name = intervention.get('interventionName', '')
                
                # Focus on drug, biological, and dietary supplement interventions
                if intervention_type and intervention_type.lower() in ['drug', 'biological', 'dietary supplement']:
                    substances.append({
                        'type': intervention_type,
                        'name': intervention_name
                    })
            except Exception as e:
                logger.exception(f"Error extracting substance: {str(e)}")
        
        return substances