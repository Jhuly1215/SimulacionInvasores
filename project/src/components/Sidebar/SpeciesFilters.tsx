import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

interface SpeciesFiltersProps {
  onFilterChange: (filters: any) => void;
  availableHabitats?: string[];
}

const SpeciesFilters: React.FC<SpeciesFiltersProps> = ({ onFilterChange, availableHabitats = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const [filters, setFilters] = useState({
    type: '',
    habitat: '',
    yearRange: [1900, 2025] as [number, number],
    impactLevel: '',
  });

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleYearRangeChange = (index: number, value: number) => {
    const newYearRange = [...filters.yearRange] as [number, number];
    newYearRange[index] = value;
    handleFilterChange('yearRange', newYearRange);
  };

  return (
    <div className="mb-4 border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 bg-gray-50 text-primary-700 hover:bg-gray-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center">
          <Filter size={18} className="mr-2" />
          Filter Species
        </span>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          {/* Type filter */}
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="type-filter"
              className="w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="plant">Plants</option>
              <option value="animal">Animals</option>
              <option value="fungi">Fungi</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Habitat filter */}
          <div>
            <label htmlFor="habitat-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Habitat
            </label>
            <select
              id="habitat-filter"
              className="w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={filters.habitat}
              onChange={(e) => handleFilterChange('habitat', e.target.value)}
            >
              <option value="">All Habitats</option>
              <option value="freshwater">Freshwater</option>
              <option value="marine">Marine</option>
              <option value="forest">Forest</option>
              <option value="wetland">Wetland</option>
              <option value="grassland">Grassland</option>
              <option value="urban">Urban</option>
            </select>
          </div>

          {/* Year range filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Observed Year Range
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                className="w-1/2 rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min="1900"
                max={filters.yearRange[1]}
                value={filters.yearRange[0]}
                onChange={(e) => handleYearRangeChange(0, parseInt(e.target.value))}
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                className="w-1/2 rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min={filters.yearRange[0]}
                max="2025"
                value={filters.yearRange[1]}
                onChange={(e) => handleYearRangeChange(1, parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Impact level filter */}
          <div>
            <label htmlFor="impact-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Impact Level
            </label>
            <select
              id="impact-filter"
              className="w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={filters.impactLevel}
              onChange={(e) => handleFilterChange('impactLevel', e.target.value)}
            >
              <option value="">All Impact Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="severe">Severe</option>
            </select>
          </div>

          {/* Reset filters */}
          <button
            className="w-full mt-2 py-2 px-4 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            onClick={() => {
              const resetFilters = {
                type: '',
                habitat: '',
                yearRange: [1900, 2025] as [number, number],
                impactLevel: '',
              };
              setFilters(resetFilters);
              onFilterChange(resetFilters);
            }}
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default SpeciesFilters;