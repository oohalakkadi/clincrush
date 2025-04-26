# backend/api/trials.py
import requests
import logging
import os
import json
from dotenv import load_dotenv
import random

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Google Maps API Key
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY', '')

class TrialAPI:
    BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
    
    @staticmethod
    def search_trials(condition, location=None, max_results=20):
        """Search for clinical trials based on condition and location"""
        try:
            logger.debug(f"Searching for trials with condition: {condition}, location: {location}")
            
            # Build query parameters for v2 API
            params = {
                "query.term": condition,
                "pageSize": max_results,
                "format": "json"
            }
            
            # Add location if provided
            if location:
                # Format the query with location correctly for the API
                params["query.term"] = f"{condition} AND AREA[LocationCity]{location}"
            
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
            
            # Get user location geocoding if provided
            user_geo = None
            user_latitude = None
            user_longitude = None
            if location:
                user_geo = TrialAPI.geocode_location(location)
                if user_geo:
                    user_latitude = user_geo['lat']
                    user_longitude = user_geo['lng']
            
            formatted_trials = []
            for study in studies:
                try:
                    protocol = study.get('protocolSection', {})
                    identification = protocol.get('identificationModule', {})
                    description = protocol.get('descriptionModule', {})
                    conditions_module = protocol.get('conditionsModule', {})
                    eligibility = protocol.get('eligibilityModule', {})
                    contacts = protocol.get('contactsLocationsModule', {})
                    detailed_description = description.get('detailedDescription', '')
                    
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
                        'id': identification.get('nctId', ''),
                        'title': identification.get('briefTitle', ''),
                        'conditions': conditions,
                        'summary': description.get('briefSummary', ''),
                        'gender': gender,
                        'age_range': {
                            'min': eligibility.get('minimumAge', ''),
                            'max': eligibility.get('maximumAge', '')
                        },
                        'locations': [],
                        'compensation': compensation_info,
                        'eligibilityCriteria': criteria_text,
                        'substancesUsed': TrialAPI.extract_substances(protocol)
                    }
                    
                    # Process location data
                    locations = contacts.get('locations', [])
                    min_distance = float('inf')
                    
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
                        for location_data in locations:
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
                                
                                # Geocode the location
                                location_address = f"{city}, {state}, {country}"
                                location_geo = None
                                latitude = None
                                longitude = None
                                distance = None
                                
                                if user_latitude and user_longitude:
                                    # Try to geocode the trial location
                                    location_geo = TrialAPI.geocode_location(location_address)
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
                                logger.exception(f"Error processing location: {str(e)}")
                    
                    # Add the minimum distance to the nearest location
                    if min_distance != float('inf'):
                        trial['distance'] = min_distance
                    
                    formatted_trials.append(trial)
                except Exception as e:
                    logger.exception(f"Error processing trial: {str(e)}")
                    continue
            
            logger.debug(f"Returning {len(formatted_trials)} formatted trials")
            return formatted_trials
            
        except Exception as e:
            logger.exception(f"Error searching trials: {str(e)}")
            return {"error": f"Failed to search trials: {str(e)}"}

    @staticmethod
    def geocode_location(address):
        """Get geocode information for an address"""
        try:
            # Check if API key is available
            if not GOOGLE_MAPS_API_KEY:
                logger.warning("No Google Maps API key provided, using mock geocoding")
                return TrialAPI.mock_geocode_location(address)
            
            logger.debug(f"Geocoding address: {address}")
            
            # Prepare the API request
            params = {
                'address': address,
                'key': GOOGLE_MAPS_API_KEY
            }
            
            response = requests.get('https://maps.googleapis.com/maps/api/geocode/json', params=params)
            
            if response.status_code != 200:
                logger.error(f"Geocoding API error: {response.status_code} - {response.text}")
                return TrialAPI.mock_geocode_location(address)
            
            data = response.json()
            logger.debug(f"Geocoding response status: {data.get('status')}")
            
            if data.get('status') != 'OK' or not data.get('results'):
                logger.error(f"Geocoding failed: {data.get('status')}")
                return TrialAPI.mock_geocode_location(address)
            
            # Extract location data
            result = data['results'][0]
            location = result['geometry']['location']
            
            return {
                'lat': location['lat'],
                'lng': location['lng'],
                'formatted_address': result['formatted_address']
            }
        
        except Exception as e:
            logger.exception(f"Error in geocoding: {str(e)}")
            return TrialAPI.mock_geocode_location(address)
    
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
            'seattle': {'lat': 47.6062, 'lng': -122.3321}
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
        
        # If no match, return random coordinates (for testing)
        # Generate a random US location
        lat = random.uniform(24.0, 49.0)
        lng = random.uniform(-125.0, -66.0)
        
        return {
            'lat': lat,
            'lng': lng,
            'formatted_address': address
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
        # For hackathon purposes, generate mock compensation (in a real app, you'd parse the text)
        random.seed(hash(detailed_description or '') % 10000)  # Use consistent seed for same trials
        
        # Generate compensation with 75% probability
        has_compensation = random.choice([True, True, True, False])
        
        if has_compensation:
            # Generate random amount between $100 and $2000
            amount = random.randint(2, 40) * 50  # $100 to $2000 in $50 increments
            
            # Generate details based on amount
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
    def extract_substances(protocol):
        """Extract substances used in the trial for allergy checking"""
        # Check for intervention data
        interventions_module = protocol.get('armsInterventionsModule', {})
        interventions = interventions_module.get('interventions', [])
        
        substances = []
        
        if not interventions:
            return substances
        
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