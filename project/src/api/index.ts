import axios from 'axios';
import { 
  BoundingBox, 
  InvasiveSpecies, 
  EnvironmentLayer,
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

export const fetchInvasiveSpecies = async (bbox: BoundingBox): Promise<InvasiveSpecies[]> => {
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
  getInvasiveSpecies: (): InvasiveSpecies[] => [
    {
      id: '1',
      name: 'Zebra Mussel',
      scientificName: 'Dreissena polymorpha',
      type: 'animal',
      habitat: ['freshwater', 'lakes', 'rivers'],
      impactLevel: 'severe',
      firstObservedYear: 1988,
      description: 'Zebra mussels are small, fingernail-sized mollusks native to the Caspian Sea region of Asia. They disrupt ecosystems by filtering water and removing phytoplankton, competing with native species and attaching to surfaces.',
      imageUrl: 'https://images.pexels.com/photos/751690/pexels-photo-751690.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
    },
    {
      id: '2',
      name: 'Purple Loosestrife',
      scientificName: 'Lythrum salicaria',
      type: 'plant',
      habitat: ['wetlands', 'marshes', 'riparian'],
      impactLevel: 'high',
      firstObservedYear: 1940,
      description: 'Purple loosestrife is a wetland plant native to Europe and Asia that was introduced to North America in the 1800s. It forms dense, homogeneous stands that degrade wetlands by displacing native plants and wildlife.',
      imageUrl: 'https://images.pexels.com/photos/730881/pexels-photo-730881.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
    },
    {
      id: '3',
      name: 'Asian Carp',
      scientificName: 'Hypophthalmichthys spp.',
      type: 'animal',
      habitat: ['freshwater', 'rivers', 'lakes'],
      impactLevel: 'high',
      firstObservedYear: 1970,
      description: 'Asian carp are a group of invasive fish species native to Asia. They consume large amounts of plankton, competing with native fish species and disrupting aquatic food webs.',
      imageUrl: 'https://images.pexels.com/photos/325045/pexels-photo-325045.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260',
    },
  ],
  getEnvironmentLayers: (): EnvironmentLayer[] => [
    { id: 'landuse', name: 'Land Use', description: 'Current land use classification', type: 'landUse', visible: false },
    { id: 'elevation', name: 'Elevation (SRTM)', description: 'Elevation data from Shuttle Radar Topography Mission', type: 'elevation', visible: false },
    { id: 'temperature', name: 'Temperature', description: 'Annual mean temperature (WorldClim)', type: 'climate', visible: false },
    { id: 'precipitation', name: 'Precipitation', description: 'Annual precipitation (WorldClim)', type: 'climate', visible: false },
    { id: 'rivers', name: 'Rivers & Streams', description: 'Major waterways and hydrological features', type: 'hydrology', visible: false },
    { id: 'roads', name: 'Roads & Highways', description: 'Major transportation corridors', type: 'barrier', visible: false },
  ],
  simulateInvasion: (params: SimulationParams): SimulationResult => ({
    simulationId: 'sim_' + Math.random().toString(36).substring(2, 11),
    species: params.customSpecies || {
      id: '1',
      name: 'Zebra Mussel',
      scientificName: 'Dreissena polymorpha',
      type: 'animal',
      habitat: ['freshwater', 'lakes', 'rivers'],
      impactLevel: 'severe',
      firstObservedYear: 1988,
      description: 'Invasive mussel species',
      imageUrl: 'https://images.pexels.com/photos/751690/pexels-photo-751690.jpeg'
    },
    timeSteps: Array.from({ length: params.timeSteps }, (_, i) => ({
      timeStep: i + 1,
      cellData: Array.from({ length: 50 }, (_, j) => ({
        x: Math.random() * 1,
        y: Math.random() * 1,
        population: Math.random() * 100 * (i + 1)
      })),
      stats: {
        totalArea: Math.min(100, 5 * (i + 1) + Math.random() * 10),
        invasionFrontSpeed: 2 + Math.random() * 3,
        ecosystemImpact: Math.min(10, 0.5 * (i + 1) + Math.random())
      }
    })),
    summary: {
      maxPopulation: 5000,
      finalArea: 100,
      averageSpeed: 2.5,
      totalImpact: 10
    }
  }),
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