import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../UI/Tabs';
import RegionsList from './RegionsList';
import SimulationPanel from './SimulationPanel';
import LayersPanel from './LayersPanel';
import ResultsPanel from './ResultsPanel';
import { Species, Layer, SimulationResult, SimulationRequest, Region } from '../../types';

interface SidebarProps {
  regions: Region[];
  isLoading: boolean;
  error: Error | null;
  selectedRegionId: string | undefined;
  onSelectRegion: (region: Region) => void;
  onRefresh: () => void;
  showFilters: boolean;

  species: Species[];
  speciesLoading: boolean;
  speciesError: Error | null;
  onSpeciesFilterChange: (filters: any) => void;
  onSelectSpecies: (species: Species) => void;
  selectedSpecies: Species | null;
  
  environmentLayers: Layer[];
  layersLoading: boolean;
  onToggleLayer: (layerId: string) => void;
  
  simulationData: any
  selectedRegion: any
  onResetSimulation: () => void
  onUpdateSimulationParams: (params: any) => void;
  onRunSimulation: (params: SimulationRequest) => Promise<void>; 
  onCreateCustomSpecies: (customSpecies: any) => void;
  
  isSimulating: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onUpdatePlaybackSpeed: (speed: number) => void;
  currentTimeStep: number;
  totalTimeSteps: number;
  onUpdateTimeStep: (step: number) => void;
  
  simulationResult: SimulationResult | null;
  onRequestLLMAnalysis: () => void;
}
  /*
  // LOG cuando cambia 
  React.useEffect(() => {
      console.log('region Sidebar:', RegionsList);
  }, [RegionsList]);*/

const Sidebar: React.FC<SidebarProps> = ({
  // region props
  regions,
  isLoading,
  error,
  selectedRegionId,
  onSelectRegion,
  onRefresh,
  showFilters,

  // species props
  selectedSpecies,

  //layers props
  environmentLayers,
  layersLoading,
  onToggleLayer,

  // simulation props
  simulationData,
  selectedRegion,
  onRunSimulation,
  onResetSimulation,

  isSimulating,
  simulationResult,
}) => {
  const [activeTab, setActiveTab] = useState('species');
  
  // If a simulation is running or has results, switch to the simulation tab
  React.useEffect(() => {
    if (isSimulating || simulationResult) {
      setActiveTab('simulation');
    }
  }, [isSimulating, simulationResult]);
  
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50 shadow-lg">
      <div className="p-4 bg-primary-600 text-white">
        <h2 className="text-xl font-bold">Invasive Species Simulator</h2>
        <p className="text-sm opacity-75">Visualize and predict biological invasions</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="p-2 bg-white border-b">
          <TabsTrigger value="species">Regions</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
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
            selectedRegion={selectedRegion}
            selectedSpecies={selectedSpecies}
            onRunSimulation={onRunSimulation}
            simulationData={simulationData}
            isSimulating={isSimulating}
            onReset={onResetSimulation}
            />
          </TabsContent>
          
          <TabsContent value="layers">
            <LayersPanel
              layers={environmentLayers}
              isLoading={layersLoading}
              onToggleLayer={onToggleLayer}
            />
          </TabsContent>
          
          <TabsContent value="results">
            <ResultsPanel simulationResult={simulationResult} />
          </TabsContent>
          
        </div>
      </Tabs>
    </div>
  );
};

export default Sidebar;