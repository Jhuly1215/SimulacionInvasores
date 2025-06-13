import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, Plus, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Loader } from '../UI/Loader';
import { Species, SimulationRequest } from '../../types';

interface SimulationPanelProps {
  selectedRegion: any;
  selectedSpecies: Species | null;
  onRunSimulation: (params: SimulationRequest) => Promise<void>;
  simulationData: any;
  isSimulating: boolean;
  onReset: () => void;
  
  // Props opcionales para funcionalidad de playback (si las implementas más tarde)
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
  const [customSpecies, setCustomSpecies] = useState({
    name: '',
    initialPopulation: 1000,
    dispersalRate: 1.0,
    growthRate: 0.5,
  });
  const [params, setParams] = useState({
    timeSteps: 20,
    initialPopulation: 1000,
    growthRate: 0.5,
    dispersalKernel: 1.0,
  });

  // Actualizar parámetros cuando se selecciona una especie
  useEffect(() => {
    if (selectedSpecies) {
      setShowCustomSpecies(false);
    }
  }, [selectedSpecies]);

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
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

    let simulationRequest: SimulationRequest;

    if (selectedSpecies) {
      // Usar especie seleccionada
      simulationRequest = {
        region_id: selectedRegion.id || selectedRegion.name || 'default',
        species_name: selectedSpecies.name,
        initial_population: params.initialPopulation,
        growth_rate: params.growthRate,
        dispersal_kernel: params.dispersalKernel,
        timesteps: params.timeSteps,
      };
    } else if (showCustomSpecies && customSpecies.name) {
      // Usar especie personalizada
      simulationRequest = {
        region_id: selectedRegion.id || selectedRegion.name || 'default',
        species_name: customSpecies.name,
        initial_population: customSpecies.initialPopulation,
        growth_rate: customSpecies.growthRate,
        dispersal_kernel: customSpecies.dispersalRate,
        timesteps: params.timeSteps,
      };
    } else {
      alert('Por favor selecciona una especie o crea una especie personalizada');
      return;
    }

    try {
      await onRunSimulation(simulationRequest);
    } catch (error) {
      console.error('Error running simulation:', error);
      alert('Error al ejecutar la simulación');
    }
  };

  const hasSimulationResults = simulationData && simulationData.length > 0;
  const canRunSimulation = selectedRegion && (selectedSpecies || (showCustomSpecies && customSpecies.name));

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
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Initial Population</label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                        value={customSpecies.initialPopulation}
                        onChange={(e) => handleCustomSpeciesChange('initialPopulation', parseInt(e.target.value) || 1000)}
                        placeholder="e.g., 1000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dispersal Rate (0.1-5.0)
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        className="w-full"
                        value={customSpecies.dispersalRate}
                        onChange={(e) => handleCustomSpeciesChange('dispersalRate', parseFloat(e.target.value))}
                      />
                      <div className="text-xs text-gray-500 text-right">
                        {customSpecies.dispersalRate.toFixed(1)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Growth Rate (0.1-1.0)
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        className="w-full"
                        value={customSpecies.growthRate}
                        onChange={(e) => handleCustomSpeciesChange('growthRate', parseFloat(e.target.value))}
                      />
                      <div className="text-xs text-gray-500 text-right">
                        {customSpecies.growthRate.toFixed(1)}
                      </div>
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

            {/* Parámetros de simulación */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-800">Simulation Parameters</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Steps ({params.timeSteps})
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  className="w-full"
                  value={params.timeSteps}
                  onChange={(e) => handleParamChange('timeSteps', parseInt(e.target.value))}
                />
              </div>
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

        {/* Controles de reproducción (solo si hay resultados y las funciones están disponibles) */}
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