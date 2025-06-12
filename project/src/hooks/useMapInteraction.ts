import { useRef, useState, useCallback } from 'react';
import * as L from 'leaflet';
import 'leaflet-draw';
import { regionAPI } from '../api/region';
import { BoundingBox, GeoPolygon, Region, Point, CreateRegionRequest } from '../types';

interface UseRegionMapProps {
  onRegionSelected?: (region: Region) => void;
  onError?: (error: Error) => void;
}

export const useMapInteraction = ({ onRegionSelected, onError }: UseRegionMapProps = {}) => {
  const [selectedRegion, setSelectedRegion] = useState<GeoPolygon | null>(null);
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  
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
      });
    }
  }, []);

  // Convert GeoPolygon to Points array for API
  const geoPolygonToPoints = useCallback((polygon: GeoPolygon): Point[] => {
    if (!polygon.coordinates || !polygon.coordinates[0]) return [];
    
    return polygon.coordinates[0].map(([longitude, latitude]) => ({
      latitude,
      longitude,
    }));
  }, []);

  // Create region via API
  const createRegion = useCallback(async (name: string, speciesList: any[] = []) => {
    if (!selectedRegion) {
      const error = new Error('No region selected');
      onError?.(error);
      throw error;
    }

    setIsCreating(true);
    
    try {
      const points = geoPolygonToPoints(selectedRegion);
      
      const regionData: CreateRegionRequest = {
        name,
        points,
        species_list: speciesList,
      };

      const newRegion = await regionAPI.createRegion(regionData);
      
      // Add to local regions list
      setRegions(prev => [...prev, newRegion]);
      
      // Clear current selection
      clearDrawings();
      
      onRegionSelected?.(newRegion);
      return newRegion;
    } catch (error) {
      const err = error as Error;
      onError?.(err);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [selectedRegion, geoPolygonToPoints, onRegionSelected, onError]);

  // Get region by ID
  const getRegion = useCallback(async (regionId: string) => {
    try {
      const region = await regionAPI.getRegion(regionId);
      return region;
    } catch (error) {
      const err = error as Error;
      onError?.(err);
      throw err;
    }
  }, [onError]);

  // Clear drawings
  const clearDrawings = useCallback(() => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      setSelectedRegion(null);
      setBoundingBox(null);
    }
  }, []);

  // Check if region is ready to be created
  const canCreateRegion = selectedRegion !== null && !isCreating;

  return {
    // State
    selectedRegion,
    boundingBox,
    isCreating,
    regions,
    canCreateRegion,
    
    // Map functions
    initializeDrawControl,
    clearDrawings,
    
    // API functions
    createRegion,
    getRegion,
    
    // Utilities
    geoPolygonToPoints,
  };
};