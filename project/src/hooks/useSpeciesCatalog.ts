import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { Species, GenerateSpeciesRequest, SpeciesGenerationResult } from '../types';
import { invasiveSpeciesAPI } from '../api/species';

interface SpeciesFilters {
  type?: string;
  habitat?: string;
  yearRange?: [number, number];
  impactLevel?: string;
}

const buildGenerateSpeciesRequest = (regionId: string): GenerateSpeciesRequest => ({
  region_id: regionId,
});

export const useSpeciesCatalog = (regionId?: string) => {
  const [filters, setFilters] = useState<SpeciesFilters>({});
  const queryClient = useQueryClient();

  // Query para obtener especies existentes
  const { 
    data: speciesResult, 
    isLoading: isLoadingSpecies, 
    error: speciesError,
    refetch: refetchSpecies 
  } = useQuery<SpeciesGenerationResult>({
    queryKey: ['invasiveSpecies', regionId],
    queryFn: async () => {
      if (!regionId) {
        throw new Error('Region ID is required');
      }
      return await invasiveSpeciesAPI.getSpeciesList(regionId);
    },
    enabled: !!regionId,
    retry: false, // No reintentar automáticamente si no existe
  });

  // Mutation para generar nueva lista de especies
  const generateSpeciesMutation = useMutation({
    mutationFn: async (requestData: GenerateSpeciesRequest) => {
      return await invasiveSpeciesAPI.generateSpeciesList(requestData);
    },
    onSuccess: (data) => {
      // Actualizar el cache con los nuevos datos
      queryClient.setQueryData(['invasiveSpecies', regionId], data);
    },
    onError: (error) => {
      console.error('Error generating species:', error);
    }
  });

  // Query para obtener el status de generación
  const { data: generationStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['speciesStatus', regionId],
    queryFn: async () => {
      if (!regionId) return null;
      return await invasiveSpeciesAPI.getGenerationStatus(regionId);
    },
    enabled: !!regionId && generateSpeciesMutation.isPending,
    refetchInterval: generateSpeciesMutation.isPending ? 2000 : false, // Poll cada 2 segundos si está generando
  });

  // Extraer la lista de especies del resultado
  const species = useMemo(() => {
    if (!speciesResult) return [];
    return Array.isArray(speciesResult) ? speciesResult : speciesResult.species_list ?? [];
  }, [speciesResult]);

  // Filtrar especies según los filtros aplicados
  const filteredSpecies = useMemo(() => {
    if (!species) return [];

    return species.filter(speciesItem => {
      const typeMatch = !filters.type || speciesItem.status === filters.type;
      
      const habitatMatch = !filters.habitat || 
        speciesItem.primaryHabitat?.some((h: string) => 
          h.toLowerCase().includes(filters.habitat!.toLowerCase())
        );
      
      const impactMatch = !filters.impactLevel || speciesItem.impactSummary === filters.impactLevel;

      return typeMatch && habitatMatch && impactMatch;
    });
  }, [species, filters]);

  // Función para generar especies
  const generateSpecies = useCallback(async (newRegionId?: string) => {
    const targetRegionId = newRegionId || regionId;
    if (!targetRegionId) {
      throw new Error('Region ID is required to generate species');
    }

    const requestData = buildGenerateSpeciesRequest(targetRegionId);
    return await generateSpeciesMutation.mutateAsync(requestData);
  }, [regionId, generateSpeciesMutation]);

  // Función para actualizar filtros
  const updateFilters = useCallback((newFilters: Partial<SpeciesFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Función para limpiar filtros
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Función para refrescar datos
  const refreshData = useCallback(() => {
    refetchSpecies();
  }, [refetchSpecies]);

  // Estados combinados
  const isLoading = isLoadingSpecies || generateSpeciesMutation.isPending;
  const error = speciesError || generateSpeciesMutation.error;

  return {
    // Datos
    species: filteredSpecies,
    allSpecies: species,
    speciesResult,
    
    // Estados
    isLoading,
    isLoadingSpecies,
    isGenerating: generateSpeciesMutation.isPending,
    isLoadingStatus,
    error,
    generationStatus,
    
    // Filtros
    filters,
    updateFilters,
    clearFilters,
    
    // Acciones
    generateSpecies,
    refreshData,
    
    // Utilidades
    hasSpecies: !!species && species.length > 0,
    hasFilteredSpecies: filteredSpecies.length > 0,
    totalSpecies: species.length,
    filteredCount: filteredSpecies.length,
  };
};