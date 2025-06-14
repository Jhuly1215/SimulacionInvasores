import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, Plus, ChevronDown, ChevronUp, X, Settings } from 'lucide-react';
import { Loader } from '../UI/Loader';
import { Species, SimulationRequest, ClimatePreference, ClimateTolerance } from '../../types';

interface SimulationPanelProps {
  selectedRegion: any;
  selectedSpecies: Species | null;
  onRunSimulation: (params: SimulationRequest) => Promise<void>;
  simulationData: any;
  isSimulating: boolean;
  onReset: () => void;
  
  // Props opcionales para funcionalidad de playback
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  playbackSpeed?: number;
  onUpdatePlaybackSpeed?: (speed: number) => void;
  currentTimeStep?: number;
  totalTimeSteps?: number;
  onUpdateTimeStep?: (step: number) => void;
  onCreateCustomSpecies?: (customSpecies: any) => void;
}

// Extended simulation parameters interface using proper types
interface ExtendedSimulationParams {
  // Basic parameters
  timeSteps: number;
  initialPopulation: number;
  growthRate: number;
  dispersalKernel: number;
  
  // Advanced general parameters
  dtYears: number;
  mobility: string;
  jumpProb: number;
  maxDispersalKm: number;
  altitudeToleranceMin: number;
  altitudeToleranceMax: number;
  
  // Habitat preferences (0-1 scale) - using proper structure
  habitatPref: {
    forest_closed: number;
    forest_open: number;
    shrubs: number;
    herbaceous: number;
    cropland: number;
    urban: number;
    snow_ice: number;
    water: number;
    wetland: number;
    moss_lichen: number;
  };
  
  // Climate preferences (0-1 scale) using imported type
  climatePref: ClimatePreference;
  
  // Climate tolerance ranges using imported type
  climateTolerance: ClimateTolerance;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({
  selectedRegion,
  selectedSpecies,
  onRunSimulation,
  simulationData,
  isSimulating,
  onReset,
  isPlaying = false,
  onPlay,
  onPause,
  playbackSpeed = 1,
  onUpdatePlaybackSpeed,
  currentTimeStep = 0,
  totalTimeSteps = 0,
  onUpdateTimeStep,
  onCreateCustomSpecies
}) => {
  const [showCustomSpecies, setShowCustomSpecies] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [activeAdvancedTab, setActiveAdvancedTab] = useState('general');
  
  const [customSpecies, setCustomSpecies] = useState({
    name: '',
    initialPopulation: 1000,
    dispersalRate: 1.0,
    growthRate: 0.5,
  });

  // Extended parameters with all the new fields using proper type structure
  const [params, setParams] = useState<ExtendedSimulationParams>({
    // Basic parameters
    timeSteps: 15,
    initialPopulation: 1,
    growthRate: 0.9,
    dispersalKernel: 800,
    
    // Advanced general parameters
    dtYears: 30,
    mobility: 'aerial',
    jumpProb: 0.9,
    maxDispersalKm: 20,
    altitudeToleranceMin: 0,
    altitudeToleranceMax: 3600,
    
    // Habitat preferences
    habitatPref: {
      forest_closed: 0.5,
      forest_open: 0.3,
      shrubs: 0.2,
      herbaceous: 0.4,
      cropland: 0.1,
      urban: 0.5,
      snow_ice: 0.0,
      water: 0.0,
      wetland: 0.1,
      moss_lichen: 0.0
    },
    
    // Climate preferences using proper variable name
    climatePref: {
      bio1: 0.5,
      bio5: 0.4,
      bio6: 0.4,
      bio12: 0.6,
      bio15: 0.3
    },
    
    // Climate tolerance ranges using proper variable name
    climateTolerance: {
      bio1: [0, 40],
      bio5: [10, 50],
      bio6: [-10, 30],
      bio12: [0, 2000],
      bio15: [0, 80]
    }
  });

  // Labels for better UX
  const habitatLabels = {
    forest_closed: 'Closed Forest',
    forest_open: 'Open Forest',
    shrubs: 'Shrubland',
    herbaceous: 'Grassland/Herbaceous',
    cropland: 'Cropland',
    urban: 'Urban Areas',
    snow_ice: 'Snow/Ice',
    water: 'Water Bodies',
    wetland: 'Wetlands',
    moss_lichen: 'Moss/Lichen'
  };

  const climateLabels = {
    bio1: 'Annual Mean Temperature (°C)',
    bio5: 'Max Temperature of Warmest Month (°C)',
    bio6: 'Min Temperature of Coldest Month (°C)',
    bio12: 'Annual Precipitation (mm)',
    bio15: 'Precipitation Seasonality (%)'
  };

  const mobilityOptions = ['aerial', 'terrestrial', 'aquatic', 'semi_aquatic'];

  useEffect(() => {
    if (selectedSpecies) {
      setShowCustomSpecies(false);
    }
  }, [selectedSpecies]);

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleHabitatPrefChange = (habitat: string, value: number) => {
    setParams(prev => ({
      ...prev,
      habitatPref: {
        ...prev.habitatPref,
        [habitat]: value
      }
    }));
  };

  // Updated to use correct variable name
  const handleClimatePreferenceChange = (climate: string, value: number) => {
    setParams(prev => ({
      ...prev,
      climatePref: {
        ...prev.climatePref,
        [climate]: value
      }
    }));
  };

  // Updated to use correct variable name
  const handleClimateToleranceChange = (climate: string, index: number, value: number) => {
    setParams(prev => ({
      ...prev,
      climateTolerance: {
        ...prev.climateTolerance,
        [climate]: index === 0 
          ? [value, prev.climateTolerance[climate as keyof typeof prev.climateTolerance][1]]
          : [prev.climateTolerance[climate as keyof typeof prev.climateTolerance][0], value]
      }
    }));
  };

  const handleCustomSpeciesChange = (key: string, value: any) => {
    setCustomSpecies(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmitCustomSpecies = () => {
    if (onCreateCustomSpecies) {
      onCreateCustomSpecies(customSpecies);
    }
    setShowCustomSpecies(false);
  };

  const handleRunSimulation = async () => {
    if (!selectedRegion) {
      alert('Por favor selecciona una región primero');
      return;
    }

    let simulationRequest: any;

    // Build the complete simulation request using the exact variable structure
    const baseRequest = {
      region_id: selectedRegion.id || selectedRegion.name || 'default',
      initial_population: params.initialPopulation,
      growth_rate: params.growthRate,
      dispersal_kernel: params.dispersalKernel,
      timesteps: params.timeSteps,
      dt_years: params.dtYears,
      mobility: params.mobility,
      jump_prob: params.jumpProb,
      max_dispersal_km: params.maxDispersalKm,
      altitude_tolerance: [params.altitudeToleranceMin, params.altitudeToleranceMax],
      habitat_pref: {
        forest_closed: params.habitatPref.forest_closed,
        forest_open: params.habitatPref.forest_open,
        shrubs: params.habitatPref.shrubs,
        herbaceous: params.habitatPref.herbaceous,
        cropland: params.habitatPref.cropland,
        urban: params.habitatPref.urban,
        snow_ice: params.habitatPref.snow_ice,
        water: params.habitatPref.water,
        wetland: params.habitatPref.wetland,
        moss_lichen: params.habitatPref.moss_lichen
      },
      // Updated to use correct variable names
      climate_pref: {
        bio1: params.climatePref.bio1,
        bio5: params.climatePref.bio5,
        bio6: params.climatePref.bio6,
        bio12: params.climatePref.bio12,
        bio15: params.climatePref.bio15
      },
      climate_tolerance: {
        bio1: [params.climateTolerance.bio1[0], params.climateTolerance.bio1[1]],
        bio5: [params.climateTolerance.bio5[0], params.climateTolerance.bio5[1]],
        bio6: [params.climateTolerance.bio6[0], params.climateTolerance.bio6[1]],
        bio12: [params.climateTolerance.bio12[0], params.climateTolerance.bio12[1]],
        bio15: [params.climateTolerance.bio15[0], params.climateTolerance.bio15[1]]
      }
    };

    if (selectedSpecies) {
      simulationRequest = {
        ...baseRequest,
        species_name: selectedSpecies.name
      };
      console.log('Using selected species:', selectedSpecies.name);
    } else if (showCustomSpecies && customSpecies.name) {
      simulationRequest = {
        ...baseRequest,
        species_name: customSpecies.name
      };
    } else {
      alert('Por favor selecciona una especie o crea una especie personalizada');
      return;
    }

    console.log('SimulationRequest with structured data:', simulationRequest);

    try {
      await onRunSimulation(simulationRequest);
    } catch (error) {
      console.error('Error running simulation:', error);
      alert('Error al ejecutar la simulación');
    }
  };

  const hasSimulationResults = simulationData && simulationData.length > 0;
  const canRunSimulation = selectedRegion && (selectedSpecies || (showCustomSpecies && customSpecies.name));

  const renderAdvancedTab = () => {
    switch (activeAdvancedTab) {
      case 'general':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Step Duration (years): {params.dtYears}
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                className="w-full"
                value={params.dtYears}
                onChange={(e) => handleParamChange('dtYears', parseInt(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobility Type</label>
              <select
                className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                value={params.mobility}
                onChange={(e) => handleParamChange('mobility', e.target.value)}
              >
                {mobilityOptions.map(option => (
                  <option key={option} value={option}>
                    {option.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jump Probability: {params.jumpProb.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="w-full"
                value={params.jumpProb}
                onChange={(e) => handleParamChange('jumpProb', parseFloat(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Dispersal Distance (km): {params.maxDispersalKm}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                className="w-full"
                value={params.maxDispersalKm}
                onChange={(e) => handleParamChange('maxDispersalKm', parseInt(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Altitude Tolerance Range (m)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Min: {params.altitudeToleranceMin}m</label>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    className="w-full"
                    value={params.altitudeToleranceMin}
                    onChange={(e) => handleParamChange('altitudeToleranceMin', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Max: {params.altitudeToleranceMax}m</label>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    className="w-full"
                    value={params.altitudeToleranceMax}
                    onChange={(e) => handleParamChange('altitudeToleranceMax', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'habitat':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-3">
              Set habitat preferences (0 = avoided, 1 = strongly preferred)
            </p>
            {Object.entries(params.habitatPref).map(([habitat, value]) => (
              <div key={habitat}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {habitatLabels[habitat as keyof typeof habitatLabels]}: {value.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full"
                  value={value}
                  onChange={(e) => handleHabitatPrefChange(habitat, parseFloat(e.target.value))}
                />
              </div>
            ))}
          </div>
        );

      case 'climate_pref':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-3">
              Set climate preferences (0 = avoided, 1 = strongly preferred)
            </p>
            {Object.entries(params.climatePref).map(([climate, value]) => (
              <div key={climate}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {climateLabels[climate as keyof typeof climateLabels]}: {value.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full"
                  value={value}
                  onChange={(e) => handleClimatePreferenceChange(climate, parseFloat(e.target.value))}
                />
              </div>
            ))}
          </div>
        );

      case 'climate_tolerance':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-3">
              Set climate tolerance ranges (min-max values species can survive)
            </p>
            {Object.entries(params.climateTolerance).map(([climate, [min, max]]) => (
              <div key={climate}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {climateLabels[climate as keyof typeof climateLabels]}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Min: {min}</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md py-1 px-2 text-sm"
                      value={min}
                      onChange={(e) => handleClimateToleranceChange(climate, 0, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Max: {max}</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md py-1 px-2 text-sm"
                      value={max}
                      onChange={(e) => handleClimateToleranceChange(climate, 1, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-primary-600 text-white p-4">
        <h3 className="text-lg font-semibold">Simulation Panel</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Información de región seleccionada */}
        {selectedRegion && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-800">
              Región: {selectedRegion.name || 'Región seleccionada'}
            </div>
          </div>
        )}

        {isSimulating ? (
          <Loader message="Running simulation..." />
        ) : (
          <>
            {/* Especie seleccionada o creación de especie personalizada */}
            {selectedSpecies ? (
              <div className="bg-primary-50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-primary-800">{selectedSpecies.name}</h4>
                </div>
                <p className="text-sm text-primary-700 italic mb-1">{selectedSpecies.scientificName}</p>
                <div className="text-xs text-primary-600">
                  Impact: <span className="font-medium">{selectedSpecies.impactSummary}</span> 
                </div>
              </div>
            ) : (
              <div>
                <button
                  className="w-full flex items-center justify-between p-3 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-lg hover:bg-secondary-100"
                  onClick={() => setShowCustomSpecies(!showCustomSpecies)}
                >
                  <span>
                    {showCustomSpecies ? 'Cancel Custom Species' : 'Create Custom Species'}
                  </span>
                  {showCustomSpecies ? <X size={18} /> : <Plus size={18} />}
                </button>

                {showCustomSpecies && (
                  <div className="mt-3 p-3 border border-gray-200 rounded-lg space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Species Name</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                        value={customSpecies.name}
                        onChange={(e) => handleCustomSpeciesChange('name', e.target.value)}
                        placeholder="e.g., Pacific Sea Lamprey"
                      />
                    </div>

                    <button
                      className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                      onClick={handleSubmitCustomSpecies}
                      disabled={!customSpecies.name}
                    >
                      Use Custom Species
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Parámetros básicos de simulación */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-800">Basic Parameters</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Steps: {params.timeSteps}
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  className="w-full"
                  value={params.timeSteps}
                  onChange={(e) => handleParamChange('timeSteps', parseInt(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Population: {params.initialPopulation}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10000"
                  step="1"
                  className="w-full"
                  value={params.initialPopulation}
                  onChange={(e) => handleParamChange('initialPopulation', parseInt(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Growth Rate: {params.growthRate.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.01"
                  className="w-full"
                  value={params.growthRate}
                  onChange={(e) => handleParamChange('growthRate', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dispersal Kernel: {params.dispersalKernel}
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  className="w-full"
                  value={params.dispersalKernel}
                  onChange={(e) => handleParamChange('dispersalKernel', parseInt(e.target.value))}
                />
              </div>
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                className="w-full flex items-center justify-between p-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              >
                <div className="flex items-center">
                  <Settings size={18} className="mr-2" />
                  <span>Advanced Settings</span>
                </div>
                {showAdvancedSettings ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {showAdvancedSettings && (
                <div className="mt-3 border border-gray-200 rounded-lg">
                  {/* Tab Navigation */}
                  <div className="flex border-b border-gray-200">
                    {[
                      { id: 'general', label: 'General' },
                      { id: 'habitat', label: 'Habitat' },
                      { id: 'climate_pref', label: 'Climate Pref.' },
                      { id: 'climate_tolerance', label: 'Climate Tol.' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        className={`flex-1 py-2 px-3 text-sm font-medium border-b-2 ${
                          activeAdvancedTab === tab.id
                            ? 'border-primary-500 text-primary-600 bg-primary-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => setActiveAdvancedTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="p-4 max-h-96 overflow-y-auto">
                    {renderAdvancedTab()}
                  </div>
                </div>
              )}
            </div>

            {/* Botón de ejecutar simulación */}
            <button
              className="w-full py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRunSimulation}
              disabled={!canRunSimulation}
            >
              {hasSimulationResults ? 'Run New Simulation' : 'Run Simulation'}
            </button>

            {!selectedRegion && (
              <p className="text-sm text-amber-600 text-center">
                Please select a region on the map first
              </p>
            )}
          </>
        )}

        {/* Controles de reproducción */}
        {hasSimulationResults && onPlay && onPause && totalTimeSteps > 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">
                Time Step: {currentTimeStep + 1} / {totalTimeSteps}
              </div>
              {onUpdatePlaybackSpeed && (
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-gray-500">Speed:</span>
                  <select
                    className="text-xs border border-gray-300 rounded-md p-1"
                    value={playbackSpeed}
                    onChange={(e) => onUpdatePlaybackSpeed(parseFloat(e.target.value))}
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1">1x</option>
                    <option value="2">2x</option>
                    <option value="4">4x</option>
                  </select>
                </div>
              )}
            </div>
            
            {onUpdateTimeStep && (
              <input
                type="range"
                min="0"
                max={totalTimeSteps - 1}
                value={currentTimeStep}
                onChange={(e) => onUpdateTimeStep(parseInt(e.target.value))}
                className="w-full mb-3"
              />
            )}
            
            <div className="flex justify-between">
              {isPlaying ? (
                <button
                  className="flex items-center py-2 px-4 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  onClick={onPause}
                >
                  <Pause size={16} className="mr-1" /> Pause
                </button>
              ) : (
                <button
                  className="flex items-center py-2 px-4 bg-primary-600 text-white rounded hover:bg-primary-700"
                  onClick={onPlay}
                >
                  <Play size={16} className="mr-1" /> Play
                </button>
              )}
              
              <button
                className="flex items-center py-2 px-4 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={onReset}
              >
                <RefreshCw size={16} className="mr-1" /> Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationPanel;