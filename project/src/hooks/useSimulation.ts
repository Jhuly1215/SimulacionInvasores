import { useState, useCallback } from 'react';
import { simulationAPI } from '../api/simulation';
import { SimulationRequest, SimulationResponse, SimulationStatusRequest, SimulationResult } from '../types';

interface UseSimulationState {
  isLoading: boolean;
  error: string | null;
  simulationData: SimulationResponse | null;
  isSimulationRunning: boolean;
  simulationResult: SimulationResult | null;
}

interface UseSimulationReturn extends UseSimulationState {
  startSimulation: (request: SimulationRequest) => Promise<void>;
  getSimulationStatus: (statusRequest: SimulationStatusRequest) => Promise<void>;
  clearError: () => void;
  resetSimulation: () => void;
}

export const useSimulation = (): UseSimulationReturn => {
  const [state, setState] = useState<UseSimulationState>({
    isLoading: false,
    error: null,
    simulationData: null,
    isSimulationRunning: false,
    simulationResult: null,
  });

  const extractSimulationResult = (response: SimulationResponse): SimulationResult | null => {
    try {
      console.log('🔍 Extracting simulation result from response:', response);
      
      if (response.timesteps && Array.isArray(response.timesteps)) {
        const result: SimulationResult = {
          Time_stemp_URL: response.timesteps
        };
        
        console.log('✅ Successfully extracted timesteps:', {
          count: result.Time_stemp_URL.length,
          timesteps: result.Time_stemp_URL
        });
        
        return result;
      } else {
        console.log('⚠️ No timesteps found in response or timesteps is not an array');
        return null;
      }
    } catch (error) {
      console.error('❌ Error extracting simulation result:', error);
      return null;
    }
  };

  const startSimulation = useCallback(async (request: SimulationRequest) => {
    console.log('🚀 Starting simulation with request:', request);
    
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      isSimulationRunning: true,
      simulationResult: null
    }));

    try {
      const response = await simulationAPI.startSimulation(request);
      
      const isCompleted = !!response.status;
      console.log('Simulation completed:', isCompleted);
      
      let simulationResult: SimulationResult | null = null;
      
      if (isCompleted) {
        console.log('Simulation is completed, extracting results...');
        simulationResult = extractSimulationResult(response);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        simulationData: response,
        isSimulationRunning: !isCompleted,
        simulationResult,
      }));
      
      console.log('📊 State updated:', {
        isCompleted,
        hasSimulationResult: !!simulationResult,
        isSimulationRunning: !isCompleted
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al iniciar simulación';
      console.error('❌ Error starting simulation:', error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isSimulationRunning: false,
      }));
    }
  }, []);

  const getSimulationStatus = useCallback(async (statusRequest: SimulationStatusRequest) => {
    console.log('🔄 Getting simulation status for:', statusRequest);
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await simulationAPI.getSimulationStatus(statusRequest);
      
      const isCompleted = !!response.status;
      console.log('Simulation completed:', isCompleted);
      
      let simulationResult: SimulationResult | null = null;
      
      if (isCompleted) {
        simulationResult = extractSimulationResult(response);
        console.log('🎯 Simulation is completed, extracting results:', simulationResult);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        simulationData: response,
        isSimulationRunning: !isCompleted,
        simulationResult: isCompleted ? simulationResult : prev.simulationResult,
      }));
      
      console.log('📊 State updated:', {
        isCompleted,
        hasSimulationResult: !!simulationResult,
        isSimulationRunning: !isCompleted
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener estado';
      console.error('❌ Error getting simulation status:', error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const resetSimulation = useCallback(() => {
    console.log('🔄 Resetting simulation state');
    setState({
      isLoading: false,
      error: null,
      simulationData: null,
      isSimulationRunning: false,
      simulationResult: null,
    });
  }, []);

  return {
    ...state,
    startSimulation,
    getSimulationStatus,
    clearError,
    resetSimulation,
  };
};