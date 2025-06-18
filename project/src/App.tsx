import React, { useState, useCallback } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MapContainer from './components/Map/MapContainer';
import Sidebar from './components/Sidebar/Sidebar';
import GeoTiffLayer from './components/GeoTiffLayer';
import { useSpeciesList } from './hooks/useSpeciesList';
import { useEnvironmentLayers } from './hooks/useEnvironmentLayers';
import { useSimulation } from './hooks/useSimulation';
import { useMapInteraction } from './hooks/useMapInteraction';
import { useRegionList } from './hooks/useRegionList';
import { Region, SimulationRequest, SimulationResult } from './types';

// Helper function to calculate region center
const calculateRegionCenter = (points: Array<{latitude: number, longitude: number}>) => {
  if (!points || points.length === 0) return null;
  
  const lat = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  
  return { lat, lng };
};

function App() {
  
  const [AppRegion, setAppRegion] = useState<string | undefined>(undefined);
  const [selectedUrl, setSelectedUrl] = useState<number>(0);
  const [simulationRequest, setSimulationRequest] = useState<SimulationRequest | undefined>(undefined);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);

  // Region list hook - manages regions and their interactions
  const {  
    regionsList,
    isLoading,
    error,
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
    initializeDrawControl,
    clearDrawings,
    createRegion,
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
    error: speciesError,
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
    resetSimulation,
    simulationResult
  } = useSimulation();

  // handler para selectedUrl
  const handleSelectedUrlChange = useCallback((url: number) => {
    setSelectedUrl(url);
    console.log("selected url: ", url)
  }, []);

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

  // Enhanced function to handle region selection with map movement
  const handleSelectRegion = useCallback((regionId: string) => {
    setAppRegion(regionId);
    console.log('Region selected from list:', regionId);
    
    // Find the selected region and move map to its center
    const selectedRegion = regionsList.find(region => region.id === regionId);
    if (selectedRegion && selectedRegion.points && selectedRegion.points.length > 0) {
      const center = calculateRegionCenter(selectedRegion.points);
      if (center) {
        setMapCenter(center);
        console.log('Moving map to region center:', center);
        toast.info(`Navegando a región: ${selectedRegion.name}`);
      }
    }
  }, [regionsList]);

  // Handle starting a simulation
  const handleRunSimulation = useCallback(async (simulationRequest: SimulationRequest) => {
    console.log('Simulation request received in App:', simulationRequest);
    setSimulationRequest(simulationRequest)
    
    if (!AppRegion) {
      return;
    }
    
    await startSimulation(simulationRequest);
  }, [AppRegion, startSimulation]);

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
    setMapCenter(null); // Clear map center
    toast.info('Todos los datos han sido limpiados');
    setSelectedUrl(0);
  }, [clearDrawings, clearSpecies, resetSimulation, setVisibleLayers]);

  // simulation check
  React.useEffect(() => {
    console.log('🎯 SimulationResult changed in App:', simulationResult);
  }, [simulationResult]);

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
          selectedRegion={AppRegion}
          boundingBox={boundingBox}
          canCreateRegion={canCreateRegion}
          isCreatingRegion={isCreating}
          regions={regionsList}
          AppRegion={AppRegion}
          onCreateRegion={handleCreateRegion}
          onSelectRegion={handleSelectRegion} // Enhanced function with map movement
          onClearDrawings={clearDrawings}

          //region list
          isLoading={isLoading}
          error={error}
          selectedRegionId={AppRegion}
          onSelectRegionList={handleSelectRegion} // Enhanced function with map movement
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
          // Simulation Steps
          selectedUrl={selectedUrl}
          onSelectedUrlChange={handleSelectedUrlChange}
          simulationRequest={simulationRequest}

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
          
          // Map center for navigation
          mapCenter={mapCenter}
          onMapCenterProcessed={() => setMapCenter(null)} // Clear center after processing
        >
          {simulationResult?.Time_stemp_URL && simulationResult.Time_stemp_URL[selectedUrl] && (
            <GeoTiffLayer 
              key={`geotiff-${selectedUrl}`}
              storagePath={simulationResult.Time_stemp_URL[selectedUrl]} 
            />
          )}
        </MapContainer>
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