import React, { useEffect, useRef, useState } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, useMap, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useMapInteraction } from '../../hooks/useMapInteraction';
import SimulationLayer from './SimulationLayer';
import EnvironmentLayersControl from './EnvironmentLayersControl';
import { SimulationTimeStep, Layer } from '../../types';

// Fix Leaflet icons (tu código actual sigue igual)

interface MapContainerProps {
  onRegionSelected?: (bbox: any, polygon: any) => void;
  currentTimeStep?: SimulationTimeStep;
  environmentLayers?: Layer[];
  className?: string;
}

const MapContainer: React.FC<MapContainerProps> = ({
  onRegionSelected,
  currentTimeStep,
  environmentLayers = [],
  className,
}) => {
  const [featureGroup, setFeatureGroup] = useState<L.FeatureGroup | null>(null);
  const { 
    initializeDrawControl, 
    createRegion,
    selectedRegion,
    boundingBox,
    canCreateRegion,
    clearDrawings
  } = useMapInteraction({
    onRegionSelected: (region) => {
      // Puedes hacer algo con la región seleccionada aquí
      console.log('Region selected in hook:', region);
    },
    onError: (error) => {
      console.error('Error:', error);
    }
  });

  // Componente interno para manejar los controles de dibujo
  const DrawControl = () => {
    const map = useMap();
    const fgRef = useRef<L.FeatureGroup>(null);

    useEffect(() => {
      if (map && !featureGroup) {
        const fg = new L.FeatureGroup();
        map.addLayer(fg);
        setFeatureGroup(fg);
        initializeDrawControl(map);
      }
    }, [map, initializeDrawControl]);

    return null;
  };

  const handleCreateRegion = async () => {
    if (!selectedRegion) return;
    
    try {
      const regionName = prompt('Enter region name:');
      if (!regionName) return;
      
      const newRegion = await createRegion(regionName);
      console.log('Region created:', newRegion);
      
      // Si necesitas notificar al componente padre
      if (onRegionSelected && boundingBox) {
        onRegionSelected(boundingBox, selectedRegion);
      }
    } catch (error) {
      console.error('Error creating region:', error);
    }
  };

  return (
    <div className="relative h-full w-full">
      <LeafletMapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        className={`h-full w-full ${className}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <DrawControl />
        <EnvironmentLayersControl layers={environmentLayers} />
        
        {currentTimeStep && (
          <SimulationLayer timeStep={currentTimeStep} />
        )}
      </LeafletMapContainer>

      {/* Botones de control */}
      <div className="absolute top-4 right-4 z-[1000] flex space-x-2">
        <button
          onClick={handleCreateRegion}
          disabled={!canCreateRegion}
          className={`px-4 py-2 rounded ${canCreateRegion ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'} text-white`}
        >
          Create Region
        </button>
        
        <button
          onClick={clearDrawings}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-white"
        >
          Clear Drawings
        </button>
      </div>
    </div>
  );
};

export default MapContainer;