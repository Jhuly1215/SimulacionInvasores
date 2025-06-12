import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { Species, GenerateSpeciesRequest } from '../types';
import { invasiveSpeciesAPI } from '../api/species';

interface SpeciesFilters {
  type?: string;
  habitat?: string;
  yearRange?: [number, number];
  impactLevel?: string;
}

const buildGenerateSpeciesRequest = (regionId?: string): GenerateSpeciesRequest => ({
  region_id: regionId ?? '',
});

export const useSpeciesCatalog = (regionId?: string) => {
  const [filters, setFilters] = useState<SpeciesFilters>({});

  const { data: species, isLoading, error, refetch } = useQuery<Species[]>({
    queryKey: ['invasiveSpecies', regionId],
    queryFn: async () => {
      if (!buildGenerateSpeciesRequest(regionId)) {
        return [];
      }

      // Assuming the API returns an object with a 'species' array property
      const result = await invasiveSpeciesAPI.generateSpeciesList(buildGenerateSpeciesRequest(regionId));
      return Array.isArray(result) ? result : result.species_list ?? [];
    },
    enabled: !!buildGenerateSpeciesRequest(regionId),
  });

  const updateRegion = useCallback((newRegionId?: string) => {
    setFilters(prev => ({ ...prev }));
    refetch();
  }, [refetch]);

  const filteredSpecies = useMemo(() => {
    if (!species) return [];

    return species.filter(species => {
      const typeMatch = !filters.type || species.status === filters.type;
      
      const habitatMatch = !filters.habitat || 
        species.primaryHabitat.some(h => h.toLowerCase().includes(filters.habitat!.toLowerCase()));
         
      const impactMatch = !filters.impactLevel || species.impactSummary === filters.impactLevel;

      return typeMatch && habitatMatch && impactMatch;
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

