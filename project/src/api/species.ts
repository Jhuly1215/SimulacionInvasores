import axios from 'axios';
import { 
    GenerateSpeciesRequest, 
    SpeciesGenerationResult,
    ApiResponse
} from '../types';


// API Configuration
const API_URL = import.meta.env.VITE_API_URL || '/api';

const speciesApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
speciesApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Species API Error:', error);
    return Promise.reject(error);
  }
);

// Species API Functions
export const invasiveSpeciesAPI = {
  /**
   * Generate invasive species list for a region
   * POST /species/
   */
  generateSpeciesList: async (requestData: GenerateSpeciesRequest): Promise<SpeciesGenerationResult> => {
    try {
      const { data } = await speciesApi.post<ApiResponse<SpeciesGenerationResult>>('/species/', requestData);
      return data.data;
    } catch (error) {
      console.error('Error generating species list:', error);
      throw error;
    }
  },

  /**
   * Get generated invasive species list for a region
   * GET /species/
   */
  getSpeciesList: async (regionId: string): Promise<SpeciesGenerationResult> => {
    try {
      const { data } = await speciesApi.get<ApiResponse<SpeciesGenerationResult>>('/species/', {
        params: { region_id: regionId }
      });
      return data.data;
    } catch (error) {
      console.error('Error fetching species list:', error);
      throw error;
    }
  },

  /**
   * Get species generation status
   * GET /species/status/{region_id}
   */
  getGenerationStatus: async (regionId: string): Promise<{ status: string; progress?: number }> => {
    try {
      const { data } = await speciesApi.get<ApiResponse<{ status: string; progress?: number }>>(`/species/status/${regionId}`);
      return data.data;
    } catch (error) {
      console.error('Error fetching generation status:', error);
      throw error;
    }
  },

  /**
   * Cancel species generation process
   * DELETE /species/generation/{region_id}
   */
  cancelGeneration: async (regionId: string): Promise<boolean> => {
    try {
      const { data } = await speciesApi.delete<ApiResponse<{ cancelled: boolean }>>(`/species/generation/${regionId}`);
      return data.data.cancelled;
    } catch (error) {
      console.error('Error cancelling generation:', error);
      throw error;
    }
  },

};

export default invasiveSpeciesAPI;