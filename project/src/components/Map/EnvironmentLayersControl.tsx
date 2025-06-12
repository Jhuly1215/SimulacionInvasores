import React from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { LayerUrls, Layer } from '../../types';

const { Overlay } = LayersControl;

interface EnvironmentLayersControlProps {
  layers: Layer[];
  onToggleLayer?: (layerId: string) => void;
}

const EnvironmentLayersControl: React.FC<EnvironmentLayersControlProps> = ({ 
  layers, 
  onToggleLayer 
}) => {
  if (layers.length === 0) {
    return null;
  }

  return (
    <LayersControl position="topright">
      {layers.map((layer) => (
        <Overlay 
          key={layer.id} 
          name={layer.name}
          checked={layer.visible}
        >
          <TileLayer
            url={layer.url}
            opacity={0.7}
            attribution={`${layer.name} | ${layer.description}`}
            eventHandlers={{
              add: () => onToggleLayer?.(layer.id),
              remove: () => onToggleLayer?.(layer.id),
            }}
          />
        </Overlay>
      ))}
    </LayersControl>
  );
};

export default EnvironmentLayersControl;