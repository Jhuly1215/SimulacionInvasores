import axios from 'axios';
import {
  Region,
  CreateRegionRequest,
  ApiResponse,
  RegionResponse,
} from '../types';

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
    if (error.response) {
      console.error('API Error:', error.response.data);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Region API Functions
export const regionAPI = {
  /**
   * Create a new region
   * POST /region/
   * @param regionData - Data to create the region
   * @returns The created region
   * @throws Error if request fails
   */
  createRegion: async (regionData: CreateRegionRequest): Promise<Region> => {
    try {
      const { data } = await api.post<Region>('/region/', regionData);
      console.log('POST response:', data);
      return data;
    } catch (error) {
      console.error('Error creating region:', error);
      throw error;
    }
  },

  /**
   * Get a region by ID
   * GET /region/{region_id}
   * @param regionId - ID of the region to fetch
   * @returns The requested region
   * @throws Error if request fails
   */
  getRegion: async (regionId: string): Promise<Region> => {
    try {
      const { data } = await api.get<ApiResponse<Region>>(`/region/${regionId}`);
      return data.data;
    } catch (error) {
      console.error(`Error fetching region with ID ${regionId}:`, error);
      throw error;
    }
  },

  /**
   * Update a region by ID
   * PUT /region/{region_id}
   * @param regionId - ID of the region to update
   * @param regionData - Data to update the region
   * @returns The updated region
   * @throws Error if request fails
   */
  updateRegion: async (regionId: string, regionData: Partial<CreateRegionRequest>): Promise<Region> => {
    try {
      const { data } = await api.put<ApiResponse<Region>>(`/region/${regionId}`, regionData);
      return data.data;
    } catch (error) {
      console.error(`Error updating region with ID ${regionId}:`, error);
      throw error;
    }
  },
  /**
  * Get all regions
  * GET /region/
  * @returns An array of all regions
  * @throws Error if request fails
  */
  getAllRegions: async (): Promise<Region[]> => {
    try {
      const response = await api.get<RegionResponse>('/region/');
      console.log('response.data:', response.data);
      return response.data.regions;
    } catch (error) {
      console.error('Error fetching all regions:', error);
      throw error;
    }
  }
};

export default regionAPI;