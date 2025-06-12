import { useState, useCallback } from 'react';
import { simulationAPI } from '../api/simulation';
import { SimulationRequest, SimulationResponse, SimulationStatusRequest } from '../types';

interface UseSimulationState {
  isLoading: boolean;
  error: string | null;
  simulationData: SimulationResponse | null;
  isSimulationRunning: boolean;
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
  });

  const startSimulation = useCallback(async (request: SimulationRequest) => {
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      isSimulationRunning: true 
    }));

    try {
      const response = await simulationAPI.startSimulation(request);
      setState(prev => ({
        ...prev,
        isLoading: false,
        simulationData: response,
        isSimulationRunning: !response.completed_at, // Si no tiene completed_at, sigue corriendo
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al iniciar simulación';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isSimulationRunning: false,
      }));
    }
  }, []);

  const getSimulationStatus = useCallback(async (statusRequest: SimulationStatusRequest) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await simulationAPI.getSimulationStatus(statusRequest);
      setState(prev => ({
        ...prev,
        isLoading: false,
        simulationData: response,
        isSimulationRunning: !response.completed_at, // Si no tiene completed_at, sigue corriendo
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener estado';
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
    setState({
      isLoading: false,
      error: null,
      simulationData: null,
      isSimulationRunning: false,
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