import React, { useState } from 'react';
import { Download, BarChart, Maximize2 } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart as RechartsBarChart,
  Bar
} from 'recharts';
import { SimulationResult } from '../../types';

interface ResultsPanelProps {
  simulationResult: SimulationResult | null;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ simulationResult }) => {
  const [activeChart, setActiveChart] = useState<'area' | 'speed' | 'impact'>('area');
  
  if (!simulationResult) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 mb-3">
          <BarChart size={48} className="mx-auto" />
        </div>
        <h3 className="font-medium text-gray-700">No Simulation Results</h3>
        <p className="text-sm text-gray-500 mt-1">
          Run a simulation to see results and visualizations here.
        </p>
      </div>
    );
  }
  
  // Prepare data for charts
  const areaChartData = simulationResult.timeSteps.map(step => ({
    timeStep: step.timeStep,
    area: step.stats.totalArea,
  }));
  
  const speedChartData = simulationResult.timeSteps.map(step => ({
    timeStep: step.timeStep,
    speed: step.stats.invasionFrontSpeed,
  }));
  
  const impactChartData = simulationResult.timeSteps.map(step => ({
    timeStep: step.timeStep,
    impact: step.stats.ecosystemImpact,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Simulation Results</h3>
        <div className="flex space-x-2">
          <button
            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded"
            title="Export CSV Data"
          >
            <Download size={18} />
          </button>
        </div>
      </div>
      
      {/* Summary statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Max Population</div>
          <div className="text-2xl font-bold text-primary-700">
            {simulationResult.summary.maxPopulation.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Final Area</div>
          <div className="text-2xl font-bold text-primary-700">
            {simulationResult.summary.finalArea.toFixed(1)} km²
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Average Speed</div>
          <div className="text-2xl font-bold text-primary-700">
            {simulationResult.summary.averageSpeed.toFixed(1)} km/yr
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Total Impact</div>
          <div className="text-2xl font-bold text-primary-700">
            {simulationResult.summary.totalImpact.toFixed(1)}/10
          </div>
        </div>
      </div>
      
      {/* Chart tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b">
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeChart === 'area' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveChart('area')}
          >
            Area Invaded
          </button>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeChart === 'speed' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveChart('speed')}
          >
            Invasion Speed
          </button>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeChart === 'impact' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveChart('impact')}
          >
            Ecosystem Impact
          </button>
        </div>
        
        <div className="p-4 h-64">
          {activeChart === 'area' && (
            <ResponsiveContainer width="100%\" height="100%">
              <AreaChart data={areaChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timeStep" 
                  label={{ value: 'Time Step', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: 'Area (km²)', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="area" 
                  name="Invaded Area" 
                  stroke="#2D6A4F" 
                  fill="#2D6A4F" 
                  fillOpacity={0.3} 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          
          {activeChart === 'speed' && (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={speedChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timeStep" 
                  label={{ value: 'Time Step', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: 'Speed (km/yr)', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip />
                <Bar 
                  dataKey="speed" 
                  name="Invasion Speed" 
                  fill="#AA8E61" 
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          )}
          
          {activeChart === 'impact' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={impactChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timeStep" 
                  label={{ value: 'Time Step', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: 'Impact Score', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="impact" 
                  name="Ecosystem Impact" 
                  stroke="#EF4444" 
                  fill="#EF4444" 
                  fillOpacity={0.3} 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      {/* Export options */}
      <div className="flex justify-between">
        <button className="py-2 px-4 bg-secondary-600 text-white rounded hover:bg-secondary-700">
          Export Animation (GIF)
        </button>
        <button className="py-2 px-4 bg-primary-600 text-white rounded hover:bg-primary-700">
          Download Full Report (CSV)
        </button>
      </div>
    </div>
  );
};

export default ResultsPanel;