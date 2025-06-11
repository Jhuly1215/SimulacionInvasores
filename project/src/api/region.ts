import axios from 'axios';
import {
  Region,
  CreateRegionRequest,
  UpdateRegionRequest,
  ApiResponse,
} from '../types';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || '/api';

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

// Region API Functions
export const regionAPI = {
  /**
   * Create a new region
   * POST /region/
   */
  createRegion: async (regionData: CreateRegionRequest): Promise<Region> => {
    try {
      const { data } = await api.post<ApiResponse<Region>>('/region/', regionData);
      return data.data;
    } catch (error) {
      console.error('Error creating region:', error);
      throw error;
    }
  },

  /**
   * Get a region by ID
   * GET /region/{region_id}
   */
  getRegion: async (regionId: string): Promise<Region> => {
    try {
      const { data } = await api.get<ApiResponse<Region>>(`/region/${regionId}`);
      return data.data;
    } catch (error) {
      console.error('Error fetching region:', error);
      throw error;
    }
  },
};

export default regionAPI;