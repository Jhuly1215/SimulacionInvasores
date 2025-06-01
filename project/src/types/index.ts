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
export interface InvasiveSpecies {
  id: string;
  name: string;
  scientificName: string;
  type: 'plant' | 'animal' | 'fungi' | 'other';
  habitat: string[];
  impactLevel: 'low' | 'medium' | 'high' | 'severe';
  firstObservedYear: number;
  description: string;
  imageUrl?: string;
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
  species: InvasiveSpecies | SimulationParams['customSpecies'];
  timeSteps: SimulationTimeStep[];
  summary: {
    maxPopulation: number;
    finalArea: number;
    averageSpeed: number;
    totalImpact: number;
  };
}

// Environment layer types
export interface EnvironmentLayer {
  id: string;
  name: string;
  description: string;
  type: 'landUse' | 'elevation' | 'climate' | 'hydrology' | 'barrier';
  visible: boolean;
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