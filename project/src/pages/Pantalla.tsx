// src/Pantalla.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MapContainer from '../components/Map/MapContainer';
import Sidebar from '../components/Sidebar/Sidebar';

import { useSpeciesList } from '../hooks/useSpeciesList';
import { useEnvironmentLayers } from '../hooks/useEnvironmentLayers';
import { useSimulation } from '../hooks/useSimulation';
import { useMapInteraction } from '../hooks/useMapInteraction';

import { Region, SimulationTimeStep, SimulationRequest } from '../types';

const Pantalla: React.FC = () => {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // 1) Dibujo / creación de regiones
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
      setSelectedRegionId(lastCreatedRegionId);
      toast.success(`Región "${region.name}" creada exitosamente`);
    },
    onError: (error: Error) => {
      console.error(error);
      toast.error(`Error: ${error.message}`);
    },
  });

  // 2) Lista de especies
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
    initialRegionId: selectedRegionId ?? undefined,
    selectedRegionId,
  });

  // 3) Capas de entorno
  const {
    layers: environmentLayers,
    groupedLayers,
    isLoading: layersLoading,
    error: layersError,
    toggleLayer,
    visibleLayers,
    setVisibleLayers,
    getLayerDescription,
  } = useEnvironmentLayers(selectedRegionId ?? undefined);

  // 4) Simulación
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

  // — Handlers —
  const handleCreateRegion = useCallback(
    async (name: string, speciesList: any[] = []) => {
      if (!canCreateRegion) {
        toast.error('No hay una región dibujada para crear');
        return;
      }
      try {
        await createRegion(name, speciesList);
      } catch (err) {
        console.error(err);
      }
    },
    [canCreateRegion, createRegion]
  );

  const handleSelectExistingRegion = useCallback(
    async (regionId: string) => {
      try {
        const region = await getRegion(regionId);
        setSelectedRegionId(regionId);
        toast.success(`Región "${region.name}" seleccionada`);
      } catch (err) {
        console.error(err);
        toast.error('Error al seleccionar la región');
      }
    },
    [getRegion]
  );

  const handleStartSimulation = useCallback(
    async (req: SimulationRequest) => {
      if (!selectedRegionId) {
        toast.error('Selecciona una región antes de ejecutar la simulación');
        return;
      }
      try {
        await startSimulation({ ...req, region_id: selectedRegionId });
        toast.success('Simulación iniciada exitosamente');
      } catch (err) {
        console.error(err);
        toast.error('Error al iniciar la simulación');
      }
    },
    [selectedRegionId, startSimulation]
  );

  const handleSpeciesFilter = useCallback((filters: any) => {
    // lógica de filtrado si la necesitas
    console.log('Filters:', filters);
  }, []);

  const handleToggleLayer = useCallback(
    (layerId: string) => {
      toggleLayer(layerId);
    },
    [toggleLayer]
  );

  const handleClearAll = useCallback(() => {
    clearDrawings();
    clearSpecies();
    resetSimulation();
    setSelectedRegionId(null);
    setVisibleLayers([]);
    toast.info('Todos los datos han sido limpiados');
  }, [clearDrawings, clearSpecies, resetSimulation, setVisibleLayers]);

  // — Efectos para mostrar errores globales —
  useEffect(() => {
    if (speciesError) toast.error(`Error en especies: ${speciesError}`);
    if (layersError) toast.error(`Error en capas: ${layersError}`);
    if (simulationError) toast.error(`Error en simulación: ${simulationError}`);
  }, [speciesError, layersError, simulationError]);

  // — Efecto de log cuando cambia la región —
  useEffect(() => {
    console.log('🎯 Selected Region Changed:', selectedRegionId);
  }, [selectedRegionId]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <div className="w-96 flex-shrink-0 overflow-hidden bg-white shadow-lg">
        <Sidebar
          selectedRegion={selectedRegion}
          boundingBox={boundingBox}
          canCreateRegion={canCreateRegion}
          isCreatingRegion={isCreating}
          regions={regions}
          selectedRegionId={selectedRegionId}
          onCreateRegion={handleCreateRegion}
          onSelectRegion={handleSelectExistingRegion}
          onClearDrawings={clearDrawings}
          species={species}
          speciesLoading={speciesLoading}
          speciesCount={getSpeciesCount()}
          impactDistribution={getImpactDistribution()}
          onSpeciesFilter={handleSpeciesFilter}
          onFetchSpecies={fetchSpeciesFromRegion}
          onReplaceSpecies={replaceAllSpecies}
          environmentLayers={environmentLayers}
          groupedLayers={groupedLayers}
          layersLoading={layersLoading}
          layersError={layersError}
          visibleLayers={visibleLayers}
          onToggleLayer={handleToggleLayer}
          getLayerDescription={getLayerDescription}
          simulationData={simulationData as SimulationTimeStep[]}
          simulationLoading={simulationLoading}
          simulationError={simulationError}
          isSimulationRunning={isSimulationRunning}
          onStartSimulation={handleStartSimulation}
          onGetSimulationStatus={getSimulationStatus}
          onResetSimulation={resetSimulation}
          onClearSimulationError={clearSimulationError}
          onClearAll={handleClearAll}
        />
      </div>

      {/* Main map area */}
      <div className="flex-1 overflow-hidden relative">
        <MapContainer
          onMapReady={initializeDrawControl}
          selectedRegion={selectedRegion}
          boundingBox={boundingBox}
          regions={regions}
          environmentLayers={environmentLayers.filter(l => l.visible)}
          simulationData={simulationData as SimulationTimeStep[]}
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
};

export default Pantalla;
