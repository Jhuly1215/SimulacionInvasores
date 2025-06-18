import { useState, useEffect, useCallback } from 'react';
import { regionAPI } from '../api/region'; 
import { Region } from '../types'; 

interface UseRegionListReturn {
  regionsList: Region[];
  isLoading: boolean;
  error: Error | null;
  selectedRegionList: Region | undefined;
  onSelectRegionList: (region: Region) => void;
  onRefresh: () => Promise<void>;
  clearSelection: () => void;
}

export const useRegionList = (): UseRegionListReturn => {
  const [regionsList, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedRegionList, setSelectedRegion] = useState<Region | undefined>(undefined);

  // Función para cargar todas las regiones
  const fetchRegions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log('Fetching regions...');
    
    try {
      setRegions([]);
      const regionsData = await regionAPI.getAllRegions();

      console.log('regionsData:', regionsData);
      setRegions(prev => [...prev, ...regionsData]);
      console.log('regionsList UpDate:', regionsList);

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error fetching regions');
      setError(error);
      console.error('Error loading regions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Función para refrescar las regiones
  const onRefresh = useCallback(async () => {
    await fetchRegions();
  }, [fetchRegions]);

  // Función para seleccionar una región
  const onSelectRegionList = useCallback((region: Region) => {
    setSelectedRegion(region);
  }, []);

  // Función para limpiar la selección
  const clearSelection = useCallback(() => {
    setSelectedRegion(undefined);
  }, []);


  // Cargar regiones al montar el componente
  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  return {
    regionsList,
    isLoading,
    error,
    selectedRegionList,
    onSelectRegionList,
    onRefresh,
    clearSelection,
  };
};