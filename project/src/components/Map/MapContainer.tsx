import React, { useEffect, useRef, useState } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, useMap, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useMapInteraction } from '../../hooks/useMapInteraction';
import { useEnvironmentLayers } from '../../hooks/useEnvironmentLayers';
import SimulationLayer from './SimulationLayer';
import EnvironmentLayersControl from './EnvironmentLayersControl';
import { SimulationResult, Layer } from '../../types';
import { ReactNode } from 'react';

// Fix Leaflet icons (tu código actual sigue igual)

interface MapContainerProps {
  onRegionSelected?: (bbox: any, polygon: any) => void;
  currentTimeStep?: SimulationResult;
  environmentLayers?: Layer[];
  className?: string;
  children?: ReactNode;
  // New props for map movement
  mapCenter?: {lat: number, lng: number} | null;
  onMapCenterProcessed?: () => void;
  // Props from App component
  onMapReady?: (map: L.Map) => void;
  selectedRegion?: any;
  boundingBox?: any;
  regions?: any[];
  simulationData?: any;
}

const MapContainer: React.FC<MapContainerProps> = ({
  onRegionSelected,
  currentTimeStep,
  environmentLayers = [],
  className,
  children,
  mapCenter,
  onMapCenterProcessed,
  onMapReady,
  selectedRegion,
  boundingBox,
  regions,
  simulationData,
}) => {
  const [featureGroup, setFeatureGroup] = useState<L.FeatureGroup | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  
  const { 
    initializeDrawControl, 
    createRegion,
    selectedRegion: hookSelectedRegion,
    boundingBox: hookBoundingBox,
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

  // Componente interno para manejar los controles de dibujo y el movimiento del mapa
  const MapController = () => {
    const map = useMap();

    useEffect(() => {
      if (map && !mapInstance) {
        setMapInstance(map);
        // Call onMapReady if provided
        if (onMapReady) {
          onMapReady(map);
        }
      }
    }, [map]);

    useEffect(() => {
      if (map && !featureGroup) {
        const fg = new L.FeatureGroup();
        map.addLayer(fg);
        setFeatureGroup(fg);
        initializeDrawControl(map);
      }
    }, [map, initializeDrawControl]);

    // Handle map center changes for region navigation
    useEffect(() => {
      if (mapCenter && map) {
        console.log('Moving map to center:', mapCenter);
        
        // Move the map to the new center with a smooth animation
        map.setView([mapCenter.lat, mapCenter.lng], 12, {
          animate: true,
          duration: 1.0 // Animation duration in seconds
        });
        
        // Call the callback to clear the center state after a delay
        // to ensure the animation completes
        setTimeout(() => {
          if (onMapCenterProcessed) {
            onMapCenterProcessed();
          }
        }, 1100); // Slightly longer than animation duration
        
        console.log('Map moved to:', mapCenter);
      }
    }, [mapCenter, map, onMapCenterProcessed]);

    return null;
  };

  const handleCreateRegion = async () => {
    // Use the selectedRegion from props or fallback to hook's selectedRegion
    const currentSelectedRegion = selectedRegion || hookSelectedRegion;
    
    if (!currentSelectedRegion) return;
    
    try {
      const regionName = prompt('Enter region name:');
      if (!regionName) return;
      
      const newRegion = await createRegion(regionName);
      console.log('Region created:', newRegion);
      
      // Si necesitas notificar al componente padre
      const currentBoundingBox = boundingBox || hookBoundingBox;
      if (onRegionSelected && currentBoundingBox) {
        onRegionSelected(currentBoundingBox, currentSelectedRegion);
      }
    } catch (error) {
      console.error('Error creating region:', error);
    }
  };

  // Use selectedRegion from props or fallback to hook's selectedRegion
  const currentSelectedRegion = selectedRegion || hookSelectedRegion;
  const currentCanCreateRegion = currentSelectedRegion ? true : canCreateRegion;

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
        
        <MapController />
        <EnvironmentLayersControl layers={environmentLayers} />
        
        {currentTimeStep && (
          <SimulationLayer timeStep={currentTimeStep} />
        )}

        {children}
        
      </LeafletMapContainer>

      {/* Botones de control */}
      <div className="absolute top-4 right-4 z-[1000] flex space-x-2">
        <button
          onClick={handleCreateRegion}
          disabled={!currentCanCreateRegion}
          className={`px-4 py-2 rounded ${currentCanCreateRegion ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'} text-white`}
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