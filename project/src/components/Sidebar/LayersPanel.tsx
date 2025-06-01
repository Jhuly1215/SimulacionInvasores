import React from 'react';
import { Layers as LayersIcon } from 'lucide-react';
import { EnvironmentLayer } from '../../types';
import { Loader } from '../UI/Loader';

interface LayersPanelProps {
  layers: EnvironmentLayer[];
  isLoading: boolean;
  onToggleLayer: (layerId: string) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  isLoading,
  onToggleLayer,
}) => {
  if (isLoading) {
    return <Loader message="Loading environmental layers..." />;
  }

  if (layers.length === 0) {
    return (
      <div className="p-4 text-gray-500 bg-gray-50 rounded-lg">
        <p>No environmental layers available for this region. Please select a region on the map first.</p>
      </div>
    );
  }

  // Group layers by type
  const groupedLayers = layers.reduce<Record<string, EnvironmentLayer[]>>((groups, layer) => {
    const group = groups[layer.type] || [];
    return { ...groups, [layer.type]: [...group, layer] };
  }, {});

  // Display name mapping for layer types
  const typeNames: Record<string, string> = {
    landUse: 'Land Use',
    elevation: 'Elevation',
    climate: 'Climate',
    hydrology: 'Hydrology',
    barrier: 'Barriers',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <LayersIcon className="mr-2 text-primary-600" />
        <h3 className="text-lg font-semibold">Environmental Layers</h3>
      </div>
      
      <p className="text-sm text-gray-600">
        Toggle layers to include in the simulation. Selected layers will affect species dispersal patterns.
      </p>
      
      <div className="space-y-4">
        {Object.entries(groupedLayers).map(([type, typeLayers]) => (
          <div key={type} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 font-medium text-gray-700 border-b">
              {typeNames[type] || type}
            </div>
            <div className="p-2">
              {typeLayers.map(layer => (
                <div key={layer.id} className="flex items-center p-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    id={`layer-${layer.id}`}
                    checked={layer.visible}
                    onChange={() => onToggleLayer(layer.id)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`layer-${layer.id}`} className="ml-2 block text-sm text-gray-700">
                    {layer.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayersPanel;