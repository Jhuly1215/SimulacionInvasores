import { useRef, useState, useCallback } from 'react';
import * as L from 'leaflet';
import 'leaflet-draw';

import { BoundingBox, GeoPolygon } from '../types';

interface UseMapInteractionProps {
  onRegionSelected?: (bbox: BoundingBox, polygon: GeoPolygon) => void;
}

export const useMapInteraction = ({ onRegionSelected }: UseMapInteractionProps = {}) => {
  const [selectedRegion, setSelectedRegion] = useState<GeoPolygon | null>(null);
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  const initializeDrawControl = useCallback((map: L.Map) => {
    // Initialize FeatureGroup for drawn items
    if (!drawnItemsRef.current) {
      drawnItemsRef.current = new L.FeatureGroup();
      map.addLayer(drawnItemsRef.current);

      // Initialize draw control
      drawControlRef.current = new L.Control.Draw({
        draw: {
          polyline: false,
          circle: false,
          circlemarker: false,
          marker: false,
          rectangle: {
            shapeOptions: {
              color: '#2D6A4F',
              weight: 2,
            },
          },
          polygon: {
            shapeOptions: {
              color: '#2D6A4F',
              weight: 2,
            },
            allowIntersection: false,
          },
        },
        edit: {
          featureGroup: drawnItemsRef.current,
        },
      });

      map.addControl(drawControlRef.current);

      // Handle draw events
      map.on(L.Draw.Event.CREATED, (event: L.LeafletEvent) => {
        const createdEvent = event as unknown as L.DrawEvents.Created;
        const layer = createdEvent.layer as L.Polygon;
        drawnItemsRef.current?.addLayer(layer);
        
        // Extract polygon coordinates
        const latLngs = layer.getLatLngs()[0] as L.LatLng[];
        const coordinates = latLngs.map((latLng: L.LatLng) => [latLng.lng, latLng.lat]);
        coordinates.push(coordinates[0]); // Close the polygon
        
        const polygon: GeoPolygon = {
          type: 'Polygon',
          coordinates: [coordinates],
        };
        
        // Calculate bounding box
        const bounds = layer.getBounds();
        const bbox: BoundingBox = {
          xmin: bounds.getWest(),
          ymin: bounds.getSouth(),
          xmax: bounds.getEast(),
          ymax: bounds.getNorth(),
        };
        
        setSelectedRegion(polygon);
        setBoundingBox(bbox);
        
        if (onRegionSelected) {
          onRegionSelected(bbox, polygon);
        }
      });
    }
  }, [onRegionSelected]);

  const clearDrawings = useCallback(() => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      setSelectedRegion(null);
      setBoundingBox(null);
    }
  }, []);

  return {
    selectedRegion,
    boundingBox,
    initializeDrawControl,
    clearDrawings,
  };
};