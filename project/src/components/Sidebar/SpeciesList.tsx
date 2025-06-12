import React from 'react';
import { Species } from '../../types';
import { PlayCircle } from 'lucide-react';
import { Loader } from '../UI/Loader';

interface SpeciesListProps {
  species: Species[];
  isLoading: boolean;
  error: Error | null;
  onSelectSpecies: (species: Species) => void;
  selectedSpeciesId?: string;
}

const SpeciesList: React.FC<SpeciesListProps> = ({
  species,
  isLoading,
  error,
  onSelectSpecies,
  selectedSpeciesId,
}) => {
  if (isLoading) {
    return <Loader message="Loading species data..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-error-500 bg-error-500/10 rounded-md">
        Failed to load species data. Please try again.
      </div>
    );
  }

  if (species.length === 0) {
    return (
      <div className="p-4 text-secondary-600 bg-secondary-600/10 rounded-md">
        No invasive species found for the selected region. Please select a different region or adjust your filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Found {species.length} Invasive Species</h3>
      
      <div className="space-y-3">
        {species.map((sp) => (
          <div 
            key={sp.id}
            className={`border rounded-lg overflow-hidden transition-all ${
              selectedSpeciesId === sp.id ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-primary-300'
            }`}
          >
            <div className="flex items-center p-3">
              
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{sp.name}</h4>
                <p className="text-sm text-gray-500 italic">{sp.scientificName}</p>
                <div className="flex mt-1 space-x-2">
                  <span className="text-xs px-2 py-0.5 bg-secondary-100 text-secondary-800 rounded-full">
                    {sp.status}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getImpactBadgeColor(sp.impactSummary)}`}>
                    {sp.impactSummary} impact
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => onSelectSpecies(sp)}
                className="flex items-center justify-center w-10 h-10 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-full"
                title="Simulate this species"
              >
                <PlayCircle size={20} />
              </button>
            </div>
            
            <div className="px-3 py-2 text-sm bg-gray-50 border-t border-gray-200">
              <span className="font-medium">Habitat:</span> {sp.primaryHabitat.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function for impact level badge colors
function getImpactBadgeColor(impact: string): string {
  switch (impact) {
    case 'low':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'severe':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default SpeciesList;