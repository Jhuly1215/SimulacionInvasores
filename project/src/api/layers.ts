import axios from 'axios';
import {
  LayerRequest,
  LayerUrls,
  SingleLayerResponse,
  WorldClimResponse,
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
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Layers API Functions
export const layersAPI = {
  /**
   * Generate all layers (SRTM, Copernicus, WorldClim) for a region
   * POST /layers/
   */
  generateAllLayers: async (regionData: LayerRequest): Promise<LayerUrls> => {
    try {
      const { data } = await api.post<LayerUrls>('/layers/', regionData);
      return data;
    } catch (error) {
      console.error('Error generating all layers:', error);
      throw error;
    }
  },

  /**
   * Get all layer URLs for a region
   * GET /layers/{region_id}
   */
  getAllLayers: async (regionId: string): Promise<LayerUrls> => {
    try {
      const { data } = await api.get<LayerUrls>(`/layers/${regionId}`);
      return data;
    } catch (error) {
      console.error('Error fetching all layers:', error);
      throw error;
    }
  },

  /**
   * Generate SRTM layer for a region
   * POST /layers/srtm
   */
  generateSRTM: async (regionData: LayerRequest): Promise<SingleLayerResponse> => {
    try {
      const { data } = await api.post<SingleLayerResponse>('/layers/srtm', regionData);
      return data;
    } catch (error) {
      console.error('Error generating SRTM layer:', error);
      throw error;
    }
  },

  /**
   * Get SRTM layer URL for a region
   * GET /layers/srtm/{region_id}
   */
  getSRTM: async (regionId: string): Promise<SingleLayerResponse> => {
    try {
      const { data } = await api.get<SingleLayerResponse>(`/layers/srtm/${regionId}`);
      return data;
    } catch (error) {
      console.error('Error fetching SRTM layer:', error);
      throw error;
    }
  },

  /**
   * Generate Copernicus layer for a region
   * POST /layers/copernicus
   */
  generateCopernicus: async (regionData: LayerRequest): Promise<SingleLayerResponse> => {
    try {
      const { data } = await api.post<SingleLayerResponse>('/layers/copernicus', regionData);
      return data;
    } catch (error) {
      console.error('Error generating Copernicus layer:', error);
      throw error;
    }
  },

  /**
   * Get Copernicus layer URL for a region
   * GET /layers/copernicus/{region_id}
   */
  getCopernicus: async (regionId: string): Promise<SingleLayerResponse> => {
    try {
      const { data } = await api.get<SingleLayerResponse>(`/layers/copernicus/${regionId}`);
      return data;
    } catch (error) {
      console.error('Error fetching Copernicus layer:', error);
      throw error;
    }
  },

  /**
   * Generate WorldClim layers for a region
   * POST /layers/worldclim
   */
  generateWorldClim: async (regionData: LayerRequest): Promise<WorldClimResponse> => {
    try {
      const { data } = await api.post<WorldClimResponse>('/layers/worldclim', regionData);
      return data;
    } catch (error) {
      console.error('Error generating WorldClim layers:', error);
      throw error;
    }
  },

  /**
   * Get WorldClim layer URLs for a region
   * GET /layers/worldclim/{region_id}
   */
  getWorldClim: async (regionId: string): Promise<WorldClimResponse> => {
    try {
      const { data } = await api.get<WorldClimResponse>(`/layers/worldclim/${regionId}`);
      return data;
    } catch (error) {
      console.error('Error fetching WorldClim layers:', error);
      throw error;
    }
  },
  // GET /region/{regionId}/layers
  getLayers: async (regionId: string): Promise<LayerUrls> => {
    const { data } = await api.get<LayerUrls>(`/layers-${regionId}`);
    return data;
  },
};

export default layersAPI;