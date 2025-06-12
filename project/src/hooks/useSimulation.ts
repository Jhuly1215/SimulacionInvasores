import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { 
  GeoPolygon, 
  Species, 
  SimulationParams,
  SimulationResponse
} from '../types';
import { runSimulation, mockAPI } from '../api';

export const useSimulation = () => {
  const [simulationParams, setSimulationParams] = useState<Partial<SimulationParams>>({
    timeSteps: 20,
    kernelType: 'exponential',
    stochastic: true,
    environmentLayers: [],
  });
  
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);
  const [currentTimeStep, setCurrentTimeStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  
  // Simulation mutation
  const simulationMutation = useMutation({
    mutationFn: runSimulation,
    onError: (error) => {
      toast.error('Failed to run simulation. Please try again.');
      console.error('Simulation error:', error);
    },
  });

  // For development we'll use mock data
  const runMockSimulation = useCallback(() => {
    if (!simulationParams.regionPolygon) {
      toast.error('Please select a region on the map first');
      return;
    }
    
    if (!selectedSpecies && !simulationParams.customSpecies) {
      toast.error('Please select a species or create a custom one');
      return;
    }
    
    const params: SimulationParams = {
      regionPolygon: simulationParams.regionPolygon as GeoPolygon,
      timeSteps: simulationParams.timeSteps || 20,
      kernelType: simulationParams.kernelType || 'exponential',
      stochastic: simulationParams.stochastic !== undefined ? simulationParams.stochastic : true,
      environmentLayers: simulationParams.environmentLayers || [],
      ...(selectedSpecies ? { speciesId: selectedSpecies.id } : {}),
      ...(simulationParams.customSpecies ? { customSpecies: simulationParams.customSpecies } : {}),
    };
    

  }, [simulationParams, selectedSpecies, simulationMutation]);

  // Playback controls
  const startPlayback = useCallback(() => {
    if (!simulationMutation.data) return;
    
    setIsPlaying(true);
    const totalSteps = simulationMutation.data.timeSteps.length;
    
    const intervalId = setInterval(() => {
      setCurrentTimeStep((prev) => {
        const next = prev + 1;
        if (next >= totalSteps) {
          clearInterval(intervalId);
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1000 / playbackSpeed);
    
    return () => clearInterval(intervalId);
  }, [simulationMutation.data, playbackSpeed]);
  
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);
  
  const resetPlayback = useCallback(() => {
    setCurrentTimeStep(0);
    setIsPlaying(false);
  }, []);

  return {
    simulationParams,
    setSimulationParams,
    selectedSpecies,
    setSelectedSpecies,
    currentTimeStep,
    setCurrentTimeStep,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    simulationResult: simulationMutation.data,
    isLoading: simulationMutation.isPending,
    error: simulationMutation.error,
    runSimulation: runMockSimulation,
    startPlayback,
    stopPlayback,
    resetPlayback,
    isSimulating: simulationMutation.isPending,
  };
};