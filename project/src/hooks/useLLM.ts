import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BoundingBox, LLMAnalysis } from '../types';
import { getLLMAnalysis, mockAPI } from '../api';

export const useLLM = () => {
  const [analysisRegion, setAnalysisRegion] = useState<BoundingBox | null>(null);

  const {
    data: llmAnalysis,
    isLoading,
    error,
    refetch,
  } = useQuery<LLMAnalysis>({
    queryKey: ['llmAnalysis', analysisRegion],
    queryFn: () => {
      if (!analysisRegion) {
        throw new Error('No region selected');
      }
      
      // In development, use mock data
      if (import.meta.env.DEV) {
        return mockAPI.getLLMAnalysis();
      }
      
      return getLLMAnalysis(analysisRegion);
    },
    enabled: false, // Don't fetch on mount, only when triggered
  });

  const analyzeRegion = useCallback((bbox: BoundingBox) => {
    setAnalysisRegion(bbox);
    refetch();
  }, [refetch]);

  return {
    analyzeRegion,
    llmAnalysis,
    isLoading,
    error,
    hasAnalysis: !!llmAnalysis,
  };
};