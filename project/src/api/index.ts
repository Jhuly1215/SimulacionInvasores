import axios from 'axios';
import { 
  BoundingBox, 
  Species, 
  SimulationParams,
  SimulationResult,
  LLMAnalysis
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchInvasiveSpecies = async (bbox: BoundingBox): Promise<Species[]> => {
  const { data } = await api.get('/invasive-species', {
    params: { bbox: `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}` },
  });
  return data;
};

export const fetchEnvironmentLayers = async (regionId: string): Promise<EnvironmentLayer[]> => {
  const { data } = await api.get('/environment-layers', {
    params: { regionId },
  });
  return data;
};

export const runSimulation = async (params: SimulationParams): Promise<SimulationResult> => {
  const { data } = await api.post('/simulate', params);
  return data;
};

export const exportAnimation = async (simulationId: string): Promise<Blob> => {
  const { data } = await api.get(`/export-animation?simId=${simulationId}`, {
    responseType: 'blob',
  });
  return data;
};

export const exportCsvData = async (simulationId: string): Promise<Blob> => {
  const { data } = await api.get(`/export-csv?simId=${simulationId}`, {
    responseType: 'blob',
  });
  return data;
};

export const getLLMAnalysis = async (bbox: BoundingBox): Promise<LLMAnalysis> => {
  const { data } = await api.post('/llm-analyze', {
    prompt: `Extrae especies invasoras en ${JSON.stringify(bbox)}; resume impactos ecológicos por especie; sugiere capas ambientales.`
  });
  return data;
};

// Mock API for development
export const mockAPI = {
  getEnvironmentLayers: (): EnvironmentLayer[] => [
    { id: 'landuse', name: 'Land Use', description: 'Current land use classification', type: 'landUse', visible: false },
    { id: 'elevation', name: 'Elevation (SRTM)', description: 'Elevation data from Shuttle Radar Topography Mission', type: 'elevation', visible: false },
    { id: 'temperature', name: 'Temperature', description: 'Annual mean temperature (WorldClim)', type: 'climate', visible: false },
    { id: 'precipitation', name: 'Precipitation', description: 'Annual precipitation (WorldClim)', type: 'climate', visible: false },
    { id: 'rivers', name: 'Rivers & Streams', description: 'Major waterways and hydrological features', type: 'hydrology', visible: false },
    { id: 'roads', name: 'Roads & Highways', description: 'Major transportation corridors', type: 'barrier', visible: false },
  ],
  
  getLLMAnalysis: (): LLMAnalysis => ({
    speciesInRegion: [
      {
        name: 'Zebra Mussel (Dreissena polymorpha)',
        impact: 'Severe impact on native mussel populations and water filtration systems',
        recommendation: 'Monitor water bodies and implement boat cleaning stations'
      },
      {
        name: 'Purple Loosestrife (Lythrum salicaria)',
        impact: 'Degrades wetlands by displacing native vegetation and wildlife',
        recommendation: 'Biological control with beetles, targeted herbicide application'
      }
    ],
    ecologicalSummary: 'The selected region contains sensitive wetland ecosystems threatened by multiple invasive species. Zebra mussels are causing filtration disruptions in aquatic systems, while purple loosestrife is outcompeting native wetland plants, reducing habitat diversity.',
    suggestedLayers: ['hydrology', 'landUse', 'temperature']
  })
};