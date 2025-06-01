import React, { useState, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MapContainer from './components/Map/MapContainer';
import Sidebar from './components/Sidebar/Sidebar';
import { useSpeciesCatalog } from './hooks/useSpeciesCatalog';
import { useEnvironmentLayers } from './hooks/useEnvironmentLayers';
import { useSimulation } from './hooks/useSimulation';
import { useLLM } from './hooks/useLLM';
import { BoundingBox, GeoPolygon } from './types';

function App() {
  const [selectedRegion, setSelectedRegion] = useState<{
    bbox: BoundingBox;
    polygon: GeoPolygon;
    regionId: string;
  } | null>(null);

  // Initialize hooks
  const {
    species,
    isLoading: speciesLoading,
    error: speciesError,
    updateFilters: updateSpeciesFilters,
    updateRegion: updateSpeciesRegion,
  } = useSpeciesCatalog();

  const {
    layers: environmentLayers,
    isLoading: layersLoading,
    toggleLayer,
    visibleLayers,
  } = useEnvironmentLayers(selectedRegion?.regionId);

  const {
    simulationParams,
    setSimulationParams,
    selectedSpecies,
    setSelectedSpecies,
    currentTimeStep,
    setCurrentTimeStep,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    simulationResult,
    isLoading: simulationLoading,
    runSimulation,
    startPlayback,
    stopPlayback,
    resetPlayback,
  } = useSimulation();

  const {
    analyzeRegion,
    llmAnalysis,
    isLoading: llmLoading,
  } = useLLM();

  // Handle region selection on map
  const handleRegionSelected = (bbox: BoundingBox, polygon: GeoPolygon) => {
    const regionId = `region_${Math.random().toString(36).substring(2, 11)}`;
    setSelectedRegion({ bbox, polygon, regionId });
    
    // Update species catalog with the new region
    updateSpeciesRegion(bbox);
    
    // Update simulation params with the new region
    setSimulationParams(prev => ({ ...prev, regionPolygon: polygon }));
  };

  // Handle selected species for simulation
  const handleSpeciesSelected = (species: any) => {
    setSelectedSpecies(species);
  };

  // Handle custom species creation
  const handleCustomSpeciesCreated = (customSpecies: any) => {
    setSelectedSpecies(null);
    setSimulationParams(prev => ({ ...prev, customSpecies }));
  };

  // Request LLM analysis for the selected region
  const handleRequestLLMAnalysis = () => {
    if (selectedRegion) {
      analyzeRegion(selectedRegion.bbox);
    }
  };

  // Get the current timestep from simulation results
  const getCurrentTimeStepData = () => {
    if (!simulationResult || currentTimeStep >= simulationResult.timeSteps.length) {
      return null;
    }
    return simulationResult.timeSteps[currentTimeStep];
  };

  // Total number of simulation time steps
  const totalTimeSteps = simulationResult ? simulationResult.timeSteps.length : 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-96 flex-shrink-0 overflow-hidden">
        <Sidebar
          species={species}
          speciesLoading={speciesLoading}
          speciesError={speciesError}
          onSpeciesFilterChange={updateSpeciesFilters}
          onSelectSpecies={handleSpeciesSelected}
          selectedSpecies={selectedSpecies}
          
          environmentLayers={environmentLayers}
          layersLoading={layersLoading}
          onToggleLayer={toggleLayer}
          
          onUpdateSimulationParams={setSimulationParams}
          onRunSimulation={runSimulation}
          onCreateCustomSpecies={handleCustomSpeciesCreated}
          
          isSimulating={simulationLoading}
          isPlaying={isPlaying}
          onPlay={startPlayback}
          onPause={stopPlayback}
          onReset={resetPlayback}
          playbackSpeed={playbackSpeed}
          onUpdatePlaybackSpeed={setPlaybackSpeed}
          currentTimeStep={currentTimeStep}
          totalTimeSteps={totalTimeSteps}
          onUpdateTimeStep={setCurrentTimeStep}
          
          simulationResult={simulationResult}
          llmAnalysis={llmAnalysis}
          llmLoading={llmLoading}
          onRequestLLMAnalysis={handleRequestLLMAnalysis}
        />
      </div>
      
      {/* Main map area */}
      <div className="flex-1 overflow-hidden">
        <MapContainer
          onRegionSelected={handleRegionSelected}
          currentTimeStep={getCurrentTimeStepData()}
          environmentLayers={environmentLayers.filter(layer => layer.visible)}
        />
      </div>
      
      <ToastContainer position="bottom-right" />
    </div>
  );
}

export default App;