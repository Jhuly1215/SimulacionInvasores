import React, { useState } from 'react';
import { Play, Pause, RefreshCw, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Species } from '../../types';
import { Loader } from '../UI/Loader';

interface SimulationPanelProps {
  selectedSpecies: Species | null;
  onUnselect: () => void;
  onUpdateParams: (params: any) => void;
  onStartSimulation: () => void;
  onCreateCustomSpecies: (customSpecies: any) => void;
  isSimulating: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onUpdatePlaybackSpeed: (speed: number) => void;
  currentTimeStep: number;
  totalTimeSteps: number;
  onUpdateTimeStep: (step: number) => void;
  hasSimulationResults: boolean;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({
  selectedSpecies,
  onUnselect,
  onUpdateParams,
  onStartSimulation,
  onCreateCustomSpecies,
  isSimulating,
  isPlaying,
  onPlay,
  onPause,
  onReset,
  playbackSpeed,
  onUpdatePlaybackSpeed,
  currentTimeStep,
  totalTimeSteps,
  onUpdateTimeStep,
  hasSimulationResults,
}) => {
  const [showCustomSpecies, setShowCustomSpecies] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [customSpecies, setCustomSpecies] = useState({
    name: '',
    type: 'plant',
    dispersalRate: 1.0,
    growthRate: 0.5,
    habitatPreference: ['forest'],
  });
  const [params, setParams] = useState({
    timeSteps: 20,
    kernelType: 'exponential',
    stochastic: true,
  });

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onUpdateParams(newParams);
  };

  const handleCustomSpeciesChange = (key: string, value: any) => {
    setCustomSpecies(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmitCustomSpecies = () => {
    onCreateCustomSpecies(customSpecies);
    setShowCustomSpecies(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-primary-600 text-white p-4">
        <h3 className="text-lg font-semibold">Simulation Panel</h3>
      </div>

      <div className="p-4 space-y-4">
        {isSimulating ? (
          <Loader message="Running simulation..." />
        ) : (
          <>
            {/* Selected species or custom species creation */}
            {selectedSpecies ? (
              <div className="bg-primary-50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-primary-800">{selectedSpecies.name}</h4>
                  <button 
                    className="text-gray-500 hover:text-gray-700"
                    onClick={onUnselect}
                  >
                    Change
                  </button>
                </div>
                <p className="text-sm text-primary-700 italic mb-1">{selectedSpecies.scientificName}</p>
                <div className="text-xs text-primary-600">
                  Impact: <span className="font-medium">{selectedSpecies.impactSummary}</span> | 
                  Type: <span className="font-medium">{selectedSpecies.status}</span>
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
                  {showCustomSpecies ? <ChevronUp size={18} /> : <Plus size={18} />}
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                        value={customSpecies.type}
                        onChange={(e) => handleCustomSpeciesChange('type', e.target.value)}
                      >
                        <option value="plant">Plant</option>
                        <option value="animal">Animal</option>
                        <option value="fungi">Fungi</option>
                        <option value="other">Other</option>
                      </select>
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
                      className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      onClick={handleSubmitCustomSpecies}
                      disabled={!customSpecies.name}
                    >
                      Use Custom Species
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Time steps control */}
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

            {/* Advanced parameters toggle */}
            <div>
              <button
                className="w-full flex items-center justify-between p-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                onClick={() => setShowAdvancedParams(!showAdvancedParams)}
              >
                <span>Advanced Parameters</span>
                {showAdvancedParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvancedParams && (
                <div className="mt-2 p-3 border border-gray-200 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kernel Type</label>
                    <select
                      className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                      value={params.kernelType}
                      onChange={(e) => handleParamChange('kernelType', e.target.value)}
                    >
                      <option value="exponential">Exponential</option>
                      <option value="gaussian">Gaussian</option>
                      <option value="fat-tailed">Fat-tailed</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Determines how far organisms disperse from their origin.
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="stochastic"
                      checked={params.stochastic}
                      onChange={(e) => handleParamChange('stochastic', e.target.checked)}
                      className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="stochastic" className="text-sm font-medium text-gray-700">
                      Stochastic (random variation)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Run simulation button */}
            <button
              className="w-full py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onStartSimulation}
              disabled={!selectedSpecies && !showCustomSpecies}
            >
              {hasSimulationResults ? 'Run New Simulation' : 'Run Simulation'}
            </button>
          </>
        )}

        {/* Simulation playback controls (visible only when simulation results are available) */}
        {hasSimulationResults && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">
                Time Step: {currentTimeStep + 1} / {totalTimeSteps}
              </div>
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
            </div>
            
            <input
              type="range"
              min="0"
              max={totalTimeSteps - 1}
              value={currentTimeStep}
              onChange={(e) => onUpdateTimeStep(parseInt(e.target.value))}
              className="w-full mb-3"
            />
            
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