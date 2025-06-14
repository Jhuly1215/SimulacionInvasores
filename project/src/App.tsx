import React, { useState, useCallback } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MapContainer from './components/Map/MapContainer';
import Sidebar from './components/Sidebar/Sidebar';
import { useSpeciesList } from './hooks/useSpeciesList';
import { useEnvironmentLayers } from './hooks/useEnvironmentLayers';
import { useSimulation } from './hooks/useSimulation';
import { useMapInteraction } from './hooks/useMapInteraction';
import { Region, SimulationRequest } from './types';

function App() {
  
  const [selectedRegionId, setSelectedRegionId] = useState<string | undefined>(undefined);

  // Map interaction hook - handles drawing and region creation
  const {
    selectedRegion,
    boundingBox,
    isCreating,
    regions,
    canCreateRegion,
    lastCreatedRegionId,
    initializeDrawControl,
    clearDrawings,
    createRegion,
    getRegion,
  } = useMapInteraction({
    onRegionSelected: (region: Region) => {
      console.log('Region selected:', region);
      console.log('Region id:', region.id);
      setSelectedRegionId(region.id);
      toast.success(`Región "${region.name}" creada exitosamente`);
    },
    onError: (error: Error) => {
      console.error('Map interaction error:', error);
      toast.error(`Error: ${error.message}`);
    },
  });

  // Species list hook - manages species data
  const {
    species,
    loading: speciesLoading,
    error: speciesError,
    fetchSpeciesFromRegion,
    getSpeciesByStatus,
    getSpeciesByImpact,
    getSpeciesCount,
    getImpactDistribution,
    replaceAllSpecies,
    clearSpecies,
  } = useSpeciesList({
    initialRegionId: selectedRegionId || undefined,
    selectedRegionId,
  });

  // Environment layers hook - manages map layers
  const {
    layers: environmentLayers,
    groupedLayers,
    isLoading: layersLoading,
    error: layersError,
    toggleLayer,
    visibleLayers,
    setVisibleLayers,
    getLayerDescription,
  } = useEnvironmentLayers(selectedRegionId || undefined);

  // Simulation hook - manages species simulations
  const {
    isLoading: simulationLoading,
    error: simulationError,
    simulationData,
    isSimulationRunning,
    startSimulation,
    getSimulationStatus,
    clearError: clearSimulationError,
    resetSimulation,
  } = useSimulation();

  // Handle creating a new region
  const handleCreateRegion = useCallback(async (name: string, speciesList: any[] = []) => {
    if (!canCreateRegion) {
      toast.error('No hay una región dibujada para crear');
      return;
    }

    try {
      await createRegion(name, speciesList);
    } catch (error) {
      console.error('Error creating region:', error);
    }
  }, [canCreateRegion, createRegion]);

  // Handle region selection from existing regions
  const handleSelectExistingRegion = useCallback(async (regionId: string) => {
    try {
      const region = await getRegion(regionId);
      setSelectedRegionId(regionId);
      toast.success(`Región "${region.name}" seleccionada`);
    } catch (error) {
      console.error('Error selecting region:', error);
      toast.error('Error al seleccionar la región');
    }
  }, [getRegion]);

  // Handle starting a simulation
  const handleRunSimulation = useCallback(async (params: SimulationRequest) => {
    if (!selectedRegion || !selectedRegionId) {
      toast.error('Selecciona una región primero');
      return;
    }
    
    const request: SimulationRequest = {
      region_id: selectedRegionId,
      species_name: params.species_name,
      initial_population: params.initial_population,
      growth_rate: params.growth_rate,
      dispersal_kernel: params.dispersal_kernel,
      timesteps: params.timesteps,
    };
    
    await startSimulation(request);
  }, [selectedRegion, selectedRegionId, startSimulation]);

  // Handle species filtering
  const handleSpeciesFilter = useCallback((filters: any) => {
    // Implement filtering logic based on your requirements
    console.log('Applying species filters:', filters);
  }, []);

  // Handle layer visibility changes
  const handleToggleLayer = useCallback((layerId: string) => {
    toggleLayer(layerId);
  }, [toggleLayer]);

  // Clear all selections and data
  const handleClearAll = useCallback(() => {
    clearDrawings();
    clearSpecies();
    resetSimulation();
    setSelectedRegionId(undefined);
    setVisibleLayers([]);
    toast.info('Todos los datos han sido limpiados');
  }, [clearDrawings, clearSpecies, resetSimulation, setVisibleLayers]);

  // Handle errors
  React.useEffect(() => {
    if (speciesError) {
      toast.error(`Error en especies: ${speciesError}`);
    }
    if (layersError) {
      toast.error(`Error en capas: ${layersError}`);
    }
    if (simulationError) {
      toast.error(`Error en simulación: ${simulationError}`);
    }
  }, [speciesError, layersError, simulationError]);

  // LOG cuando cambia la región seleccionada
  React.useEffect(() => {
      console.log('Saved region id:', selectedRegionId,);
  }, [selectedRegionId]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <div className="w-96 flex-shrink-0 overflow-hidden bg-white shadow-lg">
        <Sidebar
          // Region management
          selectedRegion={selectedRegion}
          boundingBox={boundingBox}
          canCreateRegion={canCreateRegion}
          isCreatingRegion={isCreating}
          regions={regions}
          selectedRegionId={selectedRegionId}
          onCreateRegion={handleCreateRegion}
          onSelectRegion={handleSelectExistingRegion}
          onClearDrawings={clearDrawings}

          // Species data
          species={species}
          speciesLoading={speciesLoading}
          speciesCount={getSpeciesCount()}
          impactDistribution={getImpactDistribution()}
          onSpeciesFilter={handleSpeciesFilter}
          onFetchSpecies={fetchSpeciesFromRegion}
          onReplaceSpecies={replaceAllSpecies}

          // Environment layers
          environmentLayers={environmentLayers}
          groupedLayers={groupedLayers}
          layersLoading={layersLoading}
          layersError={layersError}
          visibleLayers={visibleLayers}
          onToggleLayer={handleToggleLayer}
          getLayerDescription={getLayerDescription}

          // Simulation
          simulationData={simulationData}
          isSimulating={simulationLoading || isSimulationRunning}
          onRunSimulation={handleRunSimulation}
          onResetSimulation={resetSimulation}

          // Utility functions
          onClearAll={handleClearAll}
        />
      </div>

      {/* Main map area */}
      <div className="flex-1 overflow-hidden relative">
        <MapContainer
          // Map initialization
          onMapReady={initializeDrawControl}
          
          // Region data
          selectedRegion={selectedRegion}
          boundingBox={boundingBox}
          regions={regions}
          
          // Layers
          environmentLayers={environmentLayers.filter(layer => layer.visible)}
          
          // Simulation data
          simulationData={simulationData}
          
          // Event handlers
          onRegionClick={handleSelectExistingRegion}
        />
      </div>

      {/* Toast notifications */}
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}

export default App;