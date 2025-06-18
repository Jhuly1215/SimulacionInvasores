import React from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

interface SimulationStepsProps {
  timesteps: number;
  dt_years: number;
  selectedUrl: number;
  onSelectedUrlChange: (url: number) => void;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
}

const SimulationSteps: React.FC<SimulationStepsProps> = ({
  timesteps,
  dt_years,
  selectedUrl,
  onSelectedUrlChange,
  isPlaying = false,
  onPlay,
  onPause,
}) => {
  // Generate array of step options
  const steps = Array.from({ length: timesteps + 1 }, (_, index) => ({
    step: index,
    years: index * dt_years,
  }));

  const handlePrevious = () => {
    if (selectedUrl > 0) {
      onSelectedUrlChange(selectedUrl - 1);
    }
  };

  const handleNext = () => {
    if (selectedUrl < timesteps) {
      onSelectedUrlChange(selectedUrl + 1);
    }
  };

  const handleStepClick = (step: number) => {
    onSelectedUrlChange(step);
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Simulation Timeline</h3>
        <div className="flex items-center space-x-2">
          {onPlay && onPause && (
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span className="text-sm">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Current step info */}
      <div className="bg-gray-50 rounded p-3">
        <div className="text-sm text-gray-600">Current Step</div>
        <div className="text-xl font-bold text-gray-800">
          Step {selectedUrl} - Year {selectedUrl * dt_years}
        </div>
        <div className="text-sm text-gray-500">
          {selectedUrl === 0 ? 'Initial state' : `${selectedUrl * dt_years} years after introduction`}
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={selectedUrl <= 0}
          className="flex items-center space-x-1 px-3 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        <div className="text-sm text-gray-500">
          {selectedUrl + 1} of {timesteps + 1} steps
        </div>

        <button
          onClick={handleNext}
          disabled={selectedUrl >= timesteps}
          className="flex items-center space-x-1 px-3 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Timeline slider */}
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={timesteps}
          value={selectedUrl}
          onChange={(e) => onSelectedUrlChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Year 0</span>
          <span>Year {timesteps * dt_years}</span>
        </div>
      </div>

      {/* Step buttons grid */}
      <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto">
        {steps.map(({ step, years }) => (
          <button
            key={step}
            onClick={() => handleStepClick(step)}
            className={`p-2 text-xs rounded border transition-colors ${
              selectedUrl === step
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="font-semibold">S{step}</div>
            <div className="opacity-75">Y{years}</div>
          </button>
        ))}
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default SimulationSteps;