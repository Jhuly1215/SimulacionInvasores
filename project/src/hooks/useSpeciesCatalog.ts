import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { BoundingBox, InvasiveSpecies } from '../types';
import { fetchInvasiveSpecies, mockAPI } from '../api';

interface SpeciesFilters {
  type?: string;
  habitat?: string;
  yearRange?: [number, number];
  impactLevel?: string;
}

export const useSpeciesCatalog = (initialBbox?: BoundingBox) => {
  const [filters, setFilters] = useState<SpeciesFilters>({});
  const [currentBbox, setCurrentBbox] = useState<BoundingBox | undefined>(initialBbox);

  const { data: species, isLoading, error, refetch } = useQuery<InvasiveSpecies[]>({
    queryKey: ['invasiveSpecies', currentBbox],
    queryFn: async () => {
      if (!currentBbox) {
        return [];
      }

      // In development, use mock data
      if (import.meta.env.DEV) {
        return mockAPI.getInvasiveSpecies();
      }
      
      return fetchInvasiveSpecies(currentBbox);
    },
    enabled: !!currentBbox,
  });

  const updateRegion = useCallback((bbox: BoundingBox) => {
    setCurrentBbox(bbox);
    refetch();
  }, [refetch]);

  const filteredSpecies = useMemo(() => {
    if (!species) return [];

    return species.filter(species => {
      const typeMatch = !filters.type || species.type === filters.type;
      
      const habitatMatch = !filters.habitat || 
        species.habitat.some(h => h.toLowerCase().includes(filters.habitat!.toLowerCase()));
      
      const yearMatch = !filters.yearRange || 
        (species.firstObservedYear >= filters.yearRange[0] && 
         species.firstObservedYear <= filters.yearRange[1]);
         
      const impactMatch = !filters.impactLevel || species.impactLevel === filters.impactLevel;

      return typeMatch && habitatMatch && yearMatch && impactMatch;
    });
  }, [species, filters]);

  const updateFilters = useCallback((newFilters: Partial<SpeciesFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    species: filteredSpecies,
    isLoading,
    error,
    filters,
    updateFilters,
    updateRegion,
    hasSpecies: !!species && species.length > 0,
  };
};