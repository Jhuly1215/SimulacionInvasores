import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { SimulationTimeStep } from '../../types';

interface SimulationLayerProps {
  timeStep: SimulationTimeStep;
}

const SimulationLayer: React.FC<SimulationLayerProps> = ({ timeStep }) => {
  const map = useMap();
  const layerRef = React.useRef<L.Canvas | null>(null);

  useEffect(() => {
    // Clear previous layer if it exists
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    // Create a new canvas layer for high-performance rendering
    const canvasLayer = L.canvas({ padding: 0.5 });
    layerRef.current = canvasLayer;

    // Find the max population value for normalization
    const maxPopulation = Math.max(...timeStep.cellData.map(cell => cell.population));

    // Add circles for each cell data point
    timeStep.cellData.forEach(cell => {
      const normalizedPopulation = cell.population / maxPopulation;
      
      // Color scale from yellow to red based on population density
      const hue = 60 - normalizedPopulation * 60; // 60 = yellow, 0 = red
      const radius = 10 + (normalizedPopulation * 30); // Scale radius by population
      
      const circle = L.circleMarker([cell.y, cell.x], {
        radius,
        fillColor: `hsl(${hue}, 100%, 50%)`,
        color: 'rgba(0, 0, 0, 0.2)',
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.5,
        renderer: canvasLayer
      });
      
      // Add tooltip with population info
      circle.bindTooltip(`Population: ${Math.round(cell.population)}`);
      
      // Add circle to the map
      circle.addTo(map);
    });

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [timeStep, map]);

  return null;
};

export default SimulationLayer;