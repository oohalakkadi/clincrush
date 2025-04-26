// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:2000/api';

interface SearchOptions {
  max_results?: number;
  distance?: number;
}

export const searchTrials = async (
  condition: string, 
  location?: string,
  options: SearchOptions = {}
) => {
  try {
    console.log(`Searching trials for condition: ${condition}, location: ${location || 'any'}, distance: ${options.distance || 50} miles`);
    
    const response = await axios.get(`${API_BASE_URL}/trials/search`, {
      params: { 
        condition, 
        location,
        max_results: options.max_results || 20,
        distance: options.distance || 50
      }
    });
    
    console.log(`Retrieved ${response.data.length || 0} trials`);
    return response.data;
  } catch (error) {
    console.error('Error searching trials:', error);
    throw error;
  }
};

export const checkApiHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  } catch (error) {
    console.error('API health check failed:', error);
    throw error;
  }
};