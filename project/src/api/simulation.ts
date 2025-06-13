import axios from 'axios';
import { SimulationRequest, SimulationResponse, SimulationStatusRequest } from '../types';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Simulation API Functions
export const simulationAPI = {
  /**
   * Start invasion simulation for region and species
   * POST /simulation/
   */
  startSimulation: async (simulationData: SimulationRequest): Promise<SimulationResponse> => {
    try {
      const { data } = await api.post<SimulationResponse>('/simulation/', simulationData);
      return data;
    } catch (error) {
      console.error('Error starting simulation:', error);
      throw error;
    }
  },

  /**
   * Get simulation status and results
   * GET /simulation/
   */
  getSimulationStatus: async (statusData: SimulationStatusRequest): Promise<SimulationResponse> => {
    try {
      const { data } = await api.get<SimulationResponse>('/simulation/', {
        params: {
          region_id: statusData.region_id
        }
      });
      return data;
    } catch (error) {
      console.error('Error fetching simulation status:', error);
      throw error;
    }
  },
};

export default simulationAPI;