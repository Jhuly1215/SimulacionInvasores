import { useState, useEffect, useCallback } from 'react';
import { regionAPI } from '../api/region';
import { Species, Region } from '../types';

interface UseSpeciesListState {
  species: Species[];
  loading: boolean;
  error: string | null;
}

interface UseSpeciesListReturn extends UseSpeciesListState {
  // Core operations
  fetchSpeciesFromRegion: (regionId: string) => Promise<void>;
  addSpeciesToRegion: (regionId: string, newSpecies: Species) => Promise<void>;
  removeSpeciesFromRegion: (regionId: string, speciesId: string) => Promise<void>;
  updateSpeciesInRegion: (regionId: string, updatedSpecies: Species) => Promise<void>;
  
  // Utility functions
  getSpeciesByStatus: (status: string) => Species[];
  getSpeciesByImpact: (impact: Species['impactSummary']) => Species[];
  getSpeciesByHabitat: (habitat: string) => Species[];
  filterSpeciesByRecommendedLayer: (layer: string) => Species[];
  
  // Bulk operations
  replaceAllSpecies: (regionId: string, newSpeciesList: Species[]) => Promise<void>;
  clearSpecies: () => void;
  
  // Statistics
  getSpeciesCount: () => number;
  getImpactDistribution: () => Record<Species['impactSummary'], number>;
  getStatusDistribution: () => Record<string, number>;
}

export const useSpeciesList = (initialRegionId?: string): UseSpeciesListReturn => {
  const [state, setState] = useState<UseSpeciesListState>({
    species: [],
    loading: false,
    error: null,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setSpecies = useCallback((species: Species[]) => {
    setState(prev => ({ ...prev, species }));
  }, []);

  // Fetch species from a specific region
  const fetchSpeciesFromRegion = useCallback(async (regionId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const region = await regionAPI.getRegion(regionId);
      setSpecies(region.species_list || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch species';
      setError(errorMessage);
      console.error('Error fetching species from region:', error);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSpecies]);

  // Add a new species to a region
  const addSpeciesToRegion = useCallback(async (regionId: string, newSpecies: Species) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current region data
      const region = await regionAPI.getRegion(regionId);
      const currentSpecies = region.species_list || [];
      
      // Check if species already exists
      const existingSpecies = currentSpecies.find(s => s.id === newSpecies.id);
      if (existingSpecies) {
        throw new Error('Species already exists in this region');
      }
      
      // Add new species to the list
      const updatedSpecies = [...currentSpecies, newSpecies];
      
      // Update region with new species list
      await regionAPI.updateRegion(regionId, { species_list: updatedSpecies });
      setSpecies(updatedSpecies);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add species';
      setError(errorMessage);
      console.error('Error adding species to region:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSpecies]);

  // Remove a species from a region
  const removeSpeciesFromRegion = useCallback(async (regionId: string, speciesId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current region data
      const region = await regionAPI.getRegion(regionId);
      const currentSpecies = region.species_list || [];
      
      // Remove species from the list
      const updatedSpecies = currentSpecies.filter(s => s.id !== speciesId);
      
      // Update region with filtered species list
      await regionAPI.updateRegion(regionId, { species_list: updatedSpecies });
      setSpecies(updatedSpecies);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove species';
      setError(errorMessage);
      console.error('Error removing species from region:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSpecies]);

  // Update an existing species in a region
  const updateSpeciesInRegion = useCallback(async (regionId: string, updatedSpecies: Species) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current region data
      const region = await regionAPI.getRegion(regionId);
      const currentSpecies = region.species_list || [];
      
      // Find and update the species
      const speciesIndex = currentSpecies.findIndex(s => s.id === updatedSpecies.id);
      if (speciesIndex === -1) {
        throw new Error('Species not found in this region');
      }
      
      const newSpeciesList = [...currentSpecies];
      newSpeciesList[speciesIndex] = updatedSpecies;
      
      // Update region with modified species list
      await regionAPI.updateRegion(regionId, { species_list: newSpeciesList });
      setSpecies(newSpeciesList);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update species';
      setError(errorMessage);
      console.error('Error updating species in region:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSpecies]);

  // Replace all species in a region
  const replaceAllSpecies = useCallback(async (regionId: string, newSpeciesList: Species[]) => {
    try {
      setLoading(true);
      setError(null);
      
      // Update region with new species list
      await regionAPI.updateRegion(regionId, { species_list: newSpeciesList });
      setSpecies(newSpeciesList);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to replace species list';
      setError(errorMessage);
      console.error('Error replacing species list:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSpecies]);

  // Clear species from local state (doesn't affect API)
  const clearSpecies = useCallback(() => {
    setSpecies([]);
    setError(null);
  }, [setSpecies, setError]);

  // Utility functions for filtering and querying species
  const getSpeciesByStatus = useCallback((status: string) => {
    return state.species.filter(species => species.status === status);
  }, [state.species]);

  const getSpeciesByImpact = useCallback((impact: Species['impactSummary']) => {
    return state.species.filter(species => species.impactSummary === impact);
  }, [state.species]);

  const getSpeciesByHabitat = useCallback((habitat: string) => {
    return state.species.filter(species => 
      species.primaryHabitat.includes(habitat)
    );
  }, [state.species]);

  const filterSpeciesByRecommendedLayer = useCallback((layer: string) => {
    return state.species.filter(species => 
      species.recommendedLayers.includes(layer)
    );
  }, [state.species]);

  // Statistics functions
  const getSpeciesCount = useCallback(() => {
    return state.species.length;
  }, [state.species]);

  const getImpactDistribution = useCallback(() => {
    const distribution: Record<Species['impactSummary'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      severe: 0,
    };

    state.species.forEach(species => {
      distribution[species.impactSummary]++;
    });

    return distribution;
  }, [state.species]);

  const getStatusDistribution = useCallback(() => {
    const distribution: Record<string, number> = {};

    state.species.forEach(species => {
      distribution[species.status] = (distribution[species.status] || 0) + 1;
    });

    return distribution;
  }, [state.species]);

  // Auto-fetch species if initial region ID is provided
  useEffect(() => {
    if (initialRegionId) {
      fetchSpeciesFromRegion(initialRegionId);
    }
  }, [initialRegionId, fetchSpeciesFromRegion]);

  return {
    // State
    species: state.species,
    loading: state.loading,
    error: state.error,
    
    // Core operations
    fetchSpeciesFromRegion,
    addSpeciesToRegion,
    removeSpeciesFromRegion,
    updateSpeciesInRegion,
    
    // Utility functions
    getSpeciesByStatus,
    getSpeciesByImpact,
    getSpeciesByHabitat,
    filterSpeciesByRecommendedLayer,
    
    // Bulk operations
    replaceAllSpecies,
    clearSpecies,
    
    // Statistics
    getSpeciesCount,
    getImpactDistribution,
    getStatusDistribution,
  };
};