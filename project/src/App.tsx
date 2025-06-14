import React, { useState, useCallback } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MapContainer from './components/Map/MapContainer';
import Sidebar from './components/Sidebar/Sidebar';
import { useSpeciesList } from './hooks/useSpeciesList';
import { useEnvironmentLayers } from './hooks/useEnvironmentLayers';
import { useSimulation } from './hooks/useSimulation';
import { useMapInteraction } from './hooks/useMapInteraction';
import { useRegionList } from './hooks/useRegionList';
import { Region, SimulationRequest } from './types';

function App() {
  
  const [AppRegion, setAppRegion] = useState<string | undefined>(undefined);

  // Region list hook - manages regions and their interactions
  const {  
    regionsList,
    isLoading,
    error,
    selectedRegionList,
    onSelectRegionList,
    onRefresh,
    clearSelection,
  } = useRegionList();

  // Map interaction hook - handles drawing and region creation
  const {
    selectedRegion,
    boundingBox,
    isCreating,
    regions,
    canCreateRegion,
    lastCreatedRegion,
    initializeDrawControl,
    clearDrawings,
    createRegion,
    getRegion,
  } = useMapInteraction({
    onRegionSelected: (region: Region) => {
      console.log('Region selected:', region);
      console.log('Region id:', region.id);
      setAppRegion(region.id);
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
    initialRegionId: AppRegion || undefined,
    AppRegion,
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
  } = useEnvironmentLayers(AppRegion || undefined);

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

  // Función simplificada para manejar selección de región
  const handleSelectRegion = useCallback((regionId: string) => {
    setAppRegion(regionId);
    console.log('Region selected from list:', regionId);
    // Solo guarda el ID, no hace nada más
  }, []);

  // Handle starting a simulation
  const handleRunSimulation = useCallback(async (params: SimulationRequest) => {
    if (!selectedRegion || !AppRegion) {
      toast.error('Selecciona una región primero');
      return;
    }
    
    const request: SimulationRequest = {
      region_id: AppRegion,
      species_name: params.species_name,
      initial_population: params.initial_population,
      growth_rate: params.growth_rate,
      dispersal_kernel: params.dispersal_kernel,
      timesteps: params.timesteps,
    };
    
    await startSimulation(request);
  }, [selectedRegion, AppRegion, startSimulation]);

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
    setAppRegion(undefined);
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

  // LOG cuando cambia AppRegion
  React.useEffect(() => {
      console.log('AppRegion changed to:', AppRegion);
  }, [AppRegion]);

  // LOG cuando cambia regionsList
  React.useEffect(() => {
      console.log('Regions list:', regionsList);
  }, [regionsList]);

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
          regions={regionsList}
          AppRegion={AppRegion}
          onCreateRegion={handleCreateRegion}
          onSelectRegion={handleSelectRegion} // Función simplificada
          onClearDrawings={clearDrawings}

          //region list
          isLoading={isLoading}
          error={error}
          selectedRegionId={AppRegion} // Usar AppRegion directamente
          onSelectRegionList={handleSelectRegion} // Misma función simplificada
          onRefresh={onRefresh}
          clearSelection={clearSelection}

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
          
          // Event handlers - removido onRegionClick para simplificar
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