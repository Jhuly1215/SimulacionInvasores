// Map and GIS types
export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// Species related types
export interface Species {
  id: string;
  name: string;
  scientificName: string;
  status: string; // e.g., 'invasive', 'none-invasive'
  impactSummary: "low" | "medium" | "high" | "severe";// Summary of ecological impact
  primaryHabitat: string[]; // Primary habitat type
  recommendedLayers: string[]; // Recommended environmental layers for analysis
}

export interface GenerateSpeciesRequest {
  region_id: string;
  [key: string]: string; // For additional properties
}

export interface SpeciesGenerationResult {
  species_list: Species[];
  generated_at: string;
  error?: string;
}

// Simulation related types
export interface SimulationParams {
  regionPolygon: GeoPolygon;
  speciesId?: string;
  customSpecies?: {
    name: string;
    type: 'plant' | 'animal' | 'fungi' | 'other';
    dispersalRate: number;
    growthRate: number;
    habitatPreference: string[];
  };
  environmentLayers: string[];
  timeSteps: number;
  kernelType: 'exponential' | 'gaussian' | 'fat-tailed';
  stochastic: boolean;
}

export interface SimulationTimeStep {
  timeStep: number;
  cellData: {
    x: number;
    y: number;
    population: number;
  }[];
  stats: {
    totalArea: number;
    invasionFrontSpeed: number;
    ecosystemImpact: number;
  };
}

export interface SimulationResult {
  simulationId: string;
  species: Species | SimulationParams['customSpecies'];
  timeSteps: SimulationTimeStep[];
  summary: {
    maxPopulation: number;
    finalArea: number;
    averageSpeed: number;
    totalImpact: number;
  };
}

// Environment layer types
export interface LayerRequest {
  region_id: string;
}

export interface Layer {
  id: string;
  name: string;
  description: string;
  type: string;
  visible: boolean;
  url: string;
}

export interface LayerUrls {
  copernicus_url: string;
  bio1: string;
  bio15: string;
  bio12: string;
  bio5: string;
  bio6: string;
  srtm_url: string;
}

export interface SingleLayerResponse {
  copernicus_url?: string;
  srtm_url?: string;
}

export interface WorldClimResponse {
  bio1: string;
  bio15: string;
  bio12: string;
  bio5: string;
  bio6: string;
}

// LLM response type
export interface LLMAnalysis {
  speciesInRegion: {
    name: string;
    impact: string;
    recommendation: string;
  }[];
  ecologicalSummary: string;
  suggestedLayers: string[];
}

// region management types
export interface Point {
  latitude: number;
  longitude: number;
}

export interface Region {
  id?: string;
  name: string;
  points: Point[];
  species_list: Species[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRegionRequest {
  name: string;
  points: Point[];
  species_list?: Species[];
}

export interface UpdateRegionRequest {
  name?: string;
  points?: Point[];
  species_list?: Species[];
}

// Types for simulation requests and responses
export interface SimulationRequest {
  region_id: string;
  species_name: string;
  initial_population: number;
  growth_rate: number;
  dispersal_kernel: number;
  timesteps: number;
}

export interface SimulationParameters {
  species_name: string;
  initial_population: number;
  growth_rate: number;
  dispersal_kernel: number;
  timesteps: number;
}

export interface SimulationStatusRequest {
  region_id: string;
  paramereters: SimulationParameters;
  requested_at: string;
  estatus: 'running' | 'completed' | 'failed';
  timesteps: string[];
}

export interface SimulationResponse {
  completed_at?: string;
}

// other types
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
}