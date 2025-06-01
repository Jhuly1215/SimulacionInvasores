import React from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { EnvironmentLayer } from '../../types';

const { Overlay } = LayersControl;

// Mock tile URLs for different layer types
const getTileUrl = (layer: EnvironmentLayer) => {
  switch (layer.type) {
    case 'landUse':
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    case 'elevation':
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}';
    case 'climate':
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    case 'hydrology':
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    case 'barrier':
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    default:
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
};

interface EnvironmentLayersControlProps {
  layers: EnvironmentLayer[];
}

const EnvironmentLayersControl: React.FC<EnvironmentLayersControlProps> = ({ layers }) => {
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
            url={getTileUrl(layer)}
            opacity={0.7}
            attribution={`${layer.name} | ${layer.description}`}
          />
        </Overlay>
      ))}
    </LayersControl>
  );
};

export default EnvironmentLayersControl;