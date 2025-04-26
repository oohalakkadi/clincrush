# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from api.trials import TrialAPI

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy", "message": "API is running"})

@app.route('/api/trials/search')
def search_trials():
    try:
        condition = request.args.get('condition')
        location = request.args.get('location')
        
        if not condition:
            return jsonify({"error": "Condition parameter is required"}), 400
        
        logger.debug(f"Searching trials for condition: {condition}, location: {location}")
        results = TrialAPI.search_trials(condition, location)
        logger.debug(f"API returned {len(results) if isinstance(results, list) else results}")
        
        return jsonify(results)
    except Exception as e:
        logger.error(f"An error occurred during trial search:\n{str(e)}", exc_info=True)
        return jsonify({"error": "An error occurred during the search", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=2000, debug=True)