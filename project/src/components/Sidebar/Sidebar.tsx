import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../UI/Tabs';
import SpeciesList from './SpeciesList';
import SpeciesFilters from './SpeciesFilters';
import SimulationPanel from './SimulationPanel';
import LayersPanel from './LayersPanel';
import ResultsPanel from './ResultsPanel';
import { LLMAnalysisPanel } from './LLMAnalysisPanel';
import { Species, Layer, LLMAnalysis, SimulationResult } from '../../types';

interface SidebarProps {
  species: Species[];
  speciesLoading: boolean;
  speciesError: Error | null;
  onSpeciesFilterChange: (filters: any) => void;
  onSelectSpecies: (species: Species) => void;
  selectedSpecies: Species | null;
  
  environmentLayers: Layer[];
  layersLoading: boolean;
  onToggleLayer: (layerId: string) => void;
  
  onUpdateSimulationParams: (params: any) => void;
  onRunSimulation: () => void;
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
  llmAnalysis: LLMAnalysis | null;
  llmLoading: boolean;
  onRequestLLMAnalysis: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  species,
  speciesLoading,
  speciesError,
  onSpeciesFilterChange,
  onSelectSpecies,
  selectedSpecies,
  
  environmentLayers,
  layersLoading,
  onToggleLayer,
  
  onUpdateSimulationParams,
  onRunSimulation,
  onCreateCustomSpecies,
  
  isSimulating,
  isPlaying,
  onPlay,
  onPause,
  onReset,
  playbackSpeed,
  onUpdatePlaybackSpeed,
  currentTimeStep,
  totalTimeSteps,
  onUpdateTimeStep,
  
  simulationResult,
  llmAnalysis,
  llmLoading,
  onRequestLLMAnalysis,
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
          <TabsTrigger value="species">Species</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="species">
            <SpeciesFilters onFilterChange={onSpeciesFilterChange} />
            <SpeciesList
              species={species}
              isLoading={speciesLoading}
              error={speciesError}
              onSelectSpecies={onSelectSpecies}
              selectedSpeciesId={selectedSpecies?.id}
            />
          </TabsContent>
          
          <TabsContent value="simulation">
            <SimulationPanel
              selectedSpecies={selectedSpecies}
              onUnselect={() => onSelectSpecies(null as unknown as Species)}
              onUpdateParams={onUpdateSimulationParams}
              onStartSimulation={onRunSimulation}
              onCreateCustomSpecies={onCreateCustomSpecies}
              isSimulating={isSimulating}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onPause={onPause}
              onReset={onReset}
              playbackSpeed={playbackSpeed}
              onUpdatePlaybackSpeed={onUpdatePlaybackSpeed}
              currentTimeStep={currentTimeStep}
              totalTimeSteps={totalTimeSteps}
              onUpdateTimeStep={onUpdateTimeStep}
              hasSimulationResults={!!simulationResult}
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
          
          <TabsContent value="analysis">
            <LLMAnalysisPanel
              analysis={llmAnalysis}
              isLoading={llmLoading}
              onRequestAnalysis={onRequestLLMAnalysis}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default Sidebar;