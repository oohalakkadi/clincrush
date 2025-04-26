# backend/test_api.py
from api.trials import TrialAPI
import logging
import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_search_trials():
    """Test the search_trials function"""
    print("Testing search_trials function...")
    
    # Test with condition only
    print("\nTesting with condition only:")
    results = TrialAPI.search_trials(condition="Diabetes", max_results=3)
    print(f"Found {len(results)} trials")
    
    # Test with condition and location
    print("\nTesting with condition and location:")
    results = TrialAPI.search_trials(condition="Diabetes", location="Athens, GA", max_results=3)
    print(f"Found {len(results)} trials")
    
    # Print first result details
    if results and len(results) > 0:
        print("\nSample trial:")
        trial = results[0]
        print(f"Title: {trial['title']}")
        print(f"ID: {trial['id']}")
        print(f"Conditions: {', '.join(trial['conditions'])}")
        print(f"Gender: {trial['gender']}")
        print(f"Age Range: {trial['age_range']['min']} - {trial['age_range']['max']}")
        print(f"Compensation: {json.dumps(trial['compensation'], indent=2)}")
        
        print("\nLocations:")
        for loc in trial['locations']:
            distance = loc.get('distance')
            distance_str = f" ({distance} miles away)" if distance is not None else ""
            print(f"- {loc['facility']}, {loc['city']}, {loc['state']}, {loc['country']}{distance_str}")

def test_geocoding():
    """Test the geocode_location function"""
    print("\nTesting geocode_location function...")
    
    # Test with a valid address
    address = "Atlanta, GA"
    result = TrialAPI.geocode_location(address)
    
    if result:
        print(f"Geocoded {address} to: {result['lat']}, {result['lng']}")
        print(f"Formatted address: {result['formatted_address']}")
    else:
        print(f"Failed to geocode {address}")
    
    # Test with an invalid address
    address = "XYZ123, Nowhere"
    result = TrialAPI.geocode_location(address)
    
    if result:
        print(f"Geocoded {address} to: {result['lat']}, {result['lng']}")
        print(f"Formatted address: {result['formatted_address']}")
    else:
        print(f"Failed to geocode {address}")

if __name__ == "__main__":
    test_search_trials()
    test_geocoding()