import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EnvironmentLayer } from '../types';
import { fetchEnvironmentLayers, mockAPI } from '../api';

export const useEnvironmentLayers = (regionId?: string) => {
  const [visibleLayers, setVisibleLayers] = useState<string[]>([]);
  
  const { data: availableLayers, isLoading, error } = useQuery<EnvironmentLayer[]>({
    queryKey: ['environmentLayers', regionId],
    queryFn: async () => {
      if (!regionId) {
        return [];
      }

      // In development, use mock data
      if (import.meta.env.DEV) {
        return mockAPI.getEnvironmentLayers();
      }
      
      return fetchEnvironmentLayers(regionId);
    },
    enabled: !!regionId,
  });

  const toggleLayer = useCallback((layerId: string) => {
    setVisibleLayers(prev => {
      if (prev.includes(layerId)) {
        return prev.filter(id => id !== layerId);
      } else {
        return [...prev, layerId];
      }
    });
  }, []);

  const layersWithVisibility = availableLayers?.map(layer => ({
    ...layer,
    visible: visibleLayers.includes(layer.id)
  })) || [];

  const groupedLayers = layersWithVisibility.reduce((acc, layer) => {
    const group = acc[layer.type] || [];
    return {
      ...acc,
      [layer.type]: [...group, layer]
    };
  }, {} as Record<string, EnvironmentLayer[]>);

  return {
    layers: layersWithVisibility,
    groupedLayers,
    isLoading,
    error,
    toggleLayer,
    visibleLayers,
    setVisibleLayers,
  };
};