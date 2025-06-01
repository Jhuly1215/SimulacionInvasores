import React from 'react';
import { Brain, Loader2, RefreshCw } from 'lucide-react';
import { LLMAnalysis } from '../../types';

interface LLMAnalysisPanelProps {
  analysis: LLMAnalysis | null;
  isLoading: boolean;
  onRequestAnalysis: () => void;
}

export const LLMAnalysisPanel: React.FC<LLMAnalysisPanelProps> = ({
  analysis,
  isLoading,
  onRequestAnalysis,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <Loader2 size={32} className="text-primary-600 animate-spin mb-4" />
        <h3 className="font-medium text-gray-700">Analyzing region with AI...</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          Our AI is examining the selected region for invasive species patterns and ecological impacts.
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <Brain size={48} className="text-gray-300 mb-4" />
        <h3 className="font-medium text-gray-700">AI Ecological Analysis</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          Select a region on the map and request an AI analysis to get ecological insights about invasive species in the area.
        </p>
        <button
          onClick={onRequestAnalysis}
          className="mt-6 py-2 px-4 bg-secondary-600 text-white rounded-md hover:bg-secondary-700 flex items-center"
        >
          <Brain size={16} className="mr-2" />
          Request AI Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Brain size={20} className="mr-2 text-primary-600" />
          <h3 className="text-lg font-semibold">AI Ecological Analysis</h3>
        </div>
        <button
          onClick={onRequestAnalysis}
          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded"
          title="Refresh Analysis"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      {/* Ecological Summary */}
      <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
        <h4 className="font-medium text-primary-800 mb-2">Ecological Summary</h4>
        <p className="text-sm text-gray-700">{analysis.ecologicalSummary}</p>
      </div>
      
      {/* Species Analysis */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">Invasive Species Impact</h4>
        <div className="space-y-3">
          {analysis.speciesInRegion.map((species, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900">{species.name}</h5>
              <p className="text-sm text-gray-600 mt-1">{species.impact}</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <h6 className="text-xs font-medium text-gray-500 uppercase">Recommendation</h6>
                <p className="text-sm text-gray-700 mt-1">{species.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Suggested Layers */}
      {analysis.suggestedLayers.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Suggested Environmental Layers</h4>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <ul className="space-y-1">
              {analysis.suggestedLayers.map((layer, index) => (
                <li key={index} className="text-sm text-gray-700">
                  • {layer}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};