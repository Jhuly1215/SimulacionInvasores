import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../UI/Tabs';
import RegionsList from './RegionsList';
import SimulationPanel from './SimulationPanel';
import SimulationSteps from './simulationSteps';
import LayersPanel from './LayersPanel';
import ResultsPanel from './ResultsPanel';
import { Species, Layer, SimulationResult, SimulationRequest, Region } from '../../types';

interface SidebarProps {
  // Region
  regions: Region[];
  isLoading: boolean;
  error: Error | null;
  selectedRegionId: string | undefined;
  onSelectRegion: (regionId: string) => void;
  onRefresh: () => void;
  showFilters?: boolean;

  //species
  species?: Species[];
  speciesLoading?: boolean;
  speciesError?: Error | null;
  onSpeciesFilterChange?: (filters: any) => void;
  onSelectSpecies?: (species: Species) => void;
  selectedSpecies?: Species | null;
  
  // Enviroment
  environmentLayers: Layer[];
  layersLoading: boolean;
  onToggleLayer: (layerId: string) => void;

  // Simulation
  simulationData: any;
  onResetSimulation: () => void;
  onUpdateSimulationParams?: (params: any) => void;
  onRunSimulation: (params: SimulationRequest) => Promise<void>; 
  onCreateCustomSpecies?: (customSpecies: any) => void;
  
  isSimulating: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  playbackSpeed?: number;
  onUpdatePlaybackSpeed?: (speed: number) => void;
  currentTimeStep?: number;
  totalTimeSteps?: number;
  onUpdateTimeStep?: (step: number) => void;
  
  simulationResult?: SimulationResult | null;
  onRequestLLMAnalysis?: () => void;

  selectedUrl?: number;
  onSelectedUrlChange?: (url: number) => void;
  simulationRequest?: SimulationRequest | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  // region props
  regions,
  isLoading,
  error,
  selectedRegionId,
  onSelectRegion,
  onRefresh,
  showFilters = true,

  // species props
  selectedSpecies,

  // simulation props
  simulationData,
  onRunSimulation,
  onResetSimulation,
  onCreateCustomSpecies,

  // playback props
  isSimulating,
  isPlaying,
  onPlay,
  onPause,
  playbackSpeed,
  onUpdatePlaybackSpeed,
  currentTimeStep,
  totalTimeSteps,
  onUpdateTimeStep,

  // Simulation
  simulationResult,
  selectedUrl = 0,
  onSelectedUrlChange,
  simulationRequest,
}) => {
  const [activeTab, setActiveTab] = useState('species');
  
  // If a simulation is running or has results, switch to the simulation tab
  React.useEffect(() => {
    if (isSimulating || simulationResult) {
      setActiveTab('simulation');
    }
  }, [isSimulating, simulationResult]);

  // Debug: Log when selectedRegionId changes
  React.useEffect(() => {
    console.log('Sidebar selectedRegionId changed:', selectedRegionId);
  }, [selectedRegionId]);

  // Debug: Log when selectedRegionId changes
  React.useEffect(() => {
    console.log('cargando staps con:', simulationRequest?.timesteps, " y ", simulationRequest?.dt_years);
  }, [simulationRequest]);
  
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50 shadow-lg">
      <div className="p-4 bg-primary-600 text-white">
        <h2 className="text-xl font-bold">Invasive Species Simulator</h2>
        <p className="text-sm opacity-75">Visualize and predict biological invasions</p>
        {/* Mostrar la región seleccionada actual */}
        {selectedRegionId && (
          <p className="text-xs mt-1 bg-white/20 px-2 py-1 rounded">
            Selected Region: {selectedRegionId}
          </p>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="p-2 bg-white border-b">
          <TabsTrigger value="species">Regions</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-y-auto p-4">
            <TabsContent value="species">
              <RegionsList
                regions={regions}
                isLoading={isLoading}
                error={error}
                onSelectRegion={onSelectRegion} 
                selectedRegionId={selectedRegionId}
                showFilters={showFilters}
                onRefresh={onRefresh}
              />
            </TabsContent>
          
          <TabsContent value="simulation">
            <SimulationPanel
              selectedRegionId={selectedRegionId}
              selectedSpecies={selectedSpecies}
              onRunSimulation={onRunSimulation}
              simulationData={simulationData}
              isSimulating={isSimulating}
              onReset={onResetSimulation}
              onCreateCustomSpecies={onCreateCustomSpecies}
              // Playback controls
              isPlaying={isPlaying}
              onPlay={onPlay}
              onPause={onPause}
              playbackSpeed={playbackSpeed}
              onUpdatePlaybackSpeed={onUpdatePlaybackSpeed}
              currentTimeStep={currentTimeStep}
              totalTimeSteps={totalTimeSteps}
              onUpdateTimeStep={onUpdateTimeStep}
            />
            {simulationRequest && (
              <div className="mt-4">
                <SimulationSteps
                  timesteps={simulationRequest.timesteps}
                  dt_years={simulationRequest.dt_years}
                  selectedUrl={selectedUrl}
                  onSelectedUrlChange={onSelectedUrlChange || (() => {})}
                  isPlaying={isPlaying}
                  onPlay={onPlay}
                  onPause={onPause}
                />
              </div>
            )}

          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default Sidebar;