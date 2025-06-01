import React, { useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useMapInteraction } from '../../hooks/useMapInteraction';
import SimulationLayer from './SimulationLayer';
import EnvironmentLayersControl from './EnvironmentLayersControl';
import { SimulationTimeStep, EnvironmentLayer } from '../../types';

// Need to fix Leaflet icon issues with webpack
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet default icon
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Initialize draw control when map is ready
function DrawControl({ onRegionSelected }: { onRegionSelected: any }) {
  const map = useMap();
  const { initializeDrawControl } = useMapInteraction({ onRegionSelected });
  
  useEffect(() => {
    initializeDrawControl(map);
  }, [map, initializeDrawControl]);
  
  return null;
}

interface MapContainerProps {
  onRegionSelected: (bbox: any, polygon: any) => void;
  currentTimeStep?: SimulationTimeStep;
  environmentLayers?: EnvironmentLayer[];
  className?: string;
}

const MapContainer: React.FC<MapContainerProps> = ({
  onRegionSelected,
  currentTimeStep,
  environmentLayers = [],
  className,
}) => {
  return (
    <LeafletMapContainer
      center={[39.8283, -98.5795]} // Center of the US
      zoom={4}
      className={`h-full w-full ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <DrawControl onRegionSelected={onRegionSelected} />
      
      <EnvironmentLayersControl layers={environmentLayers} />
      
      {currentTimeStep && (
        <SimulationLayer timeStep={currentTimeStep} />
      )}
    </LeafletMapContainer>
  );
};

export default MapContainer;