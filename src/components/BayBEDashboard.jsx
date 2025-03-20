import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Brush, ReferenceLine, ReferenceArea,
  BarChart, Bar, Cell, ComposedChart, Area
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import _ from 'lodash';

// Sample optimization data structure
const createSampleData = (iterations = 35) => {
  // Parameters
  const params = [
    "T1Celsius", "t1min", "T2Celsius", "t2min", 
    "EquivalentsReagent1", "EquivalentsBASE1", "ConcentrationMolar"
  ];
  
  // Initialize with reasonable ranges
  const ranges = {
    "T1Celsius": [20, 200],
    "t1min": [10, 60],
    "T2Celsius": [20, 200],
    "t2min": [10, 60],
    "EquivalentsReagent1": [1, 2],
    "EquivalentsBASE1": [1, 5],
    "ConcentrationMolar": [0.82, 0.82]
  };
  
  const data = [];
  let bestYield = 0.2;
  let bestYieldIdx = 0;
  let lowestImpurity = 0.3;
  let lowestImpurityIdx = 0;
  let bestImpurityRatio = 1.1;
  let bestImpurityRatioIdx = 0;
  
  for (let i = 0; i < iterations; i++) {
    const entry = {
      iteration: i + 1,
      Yield: bestYield + (Math.random() * 0.1 - 0.02),
      Impurity: lowestImpurity * (0.95 + Math.random() * 0.1),
      ImpurityXRatio: bestImpurityRatio * (0.98 + Math.random() * 0.08)
    };
    
    // Make metrics tend to improve over time with occasional jumps
    if (entry.Yield > bestYield) {
      bestYield = entry.Yield;
      bestYieldIdx = i;
    }
    
    if (entry.Impurity < lowestImpurity) {
      lowestImpurity = entry.Impurity;
      lowestImpurityIdx = i;
    }
    
    if (entry.ImpurityXRatio > bestImpurityRatio) {
      bestImpurityRatio = entry.ImpurityXRatio;
      bestImpurityRatioIdx = i;
    }
    
    // Add random parameter settings
    params.forEach(param => {
      const [min, max] = ranges[param];
      entry[param] = min + Math.random() * (max - min);
    });
    
    data.push(entry);
  }
  
  // Ensure the best metrics happen at different iterations for realism
  if (bestYieldIdx === lowestImpurityIdx) {
    data[lowestImpurityIdx + 1].Impurity = lowestImpurity * 0.9;
  }
  
  return data;
};

// Get a sample of data from optimization.csv
const fetchOptimizationData = async () => {
  try {
    let data;
    
    // First attempt: Try using window.fs if available
    if (window.fs && typeof window.fs.readFile === 'function') {
      try {
        console.log("Attempting to read file with window.fs...");
        const response = await window.fs.readFile('optimization.csv', { encoding: 'utf8' });
        console.log("Successfully read file:", response.slice(0, 100) + "...");
        
        // Parse the CSV data
        data = parseCSVData(response);
        console.log('Successfully parsed CSV data from window.fs:', data.length, 'rows');
        return data;
      } catch (fsError) {
        console.warn('Error reading file with window.fs:', fsError);
        // Continue to next method if this fails
      }
    }
    
    // Second attempt: Try using fetch API
    try {
      console.log("Attempting to fetch optimization.csv via fetch API...");
      const response = await fetch('/optimization.csv');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const text = await response.text();
      data = parseCSVData(text);
      console.log('Successfully loaded optimization.csv via fetch:', data.length, 'rows');
      return data;
    } catch (fetchError) {
      console.warn('Error fetching CSV file:', fetchError);
    }
    
    // Fallback: Return sample data if both methods fail
    console.warn('Using sample data as fallback');
    return createSampleData();
  } catch (error) {
    console.error('Critical error in fetchOptimizationData:', error);
    // Make sure we always return something to prevent rendering errors
    return createSampleData();
  }
};

// Separate parsing logic to improve maintainability
const parseCSVData = (csvText) => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map((line, index) => {
    const values = line.split(',');
    const entry = { iteration: index + 1 };
    
    headers.forEach((header, i) => {
      if (i < values.length) {
        entry[header] = parseFloat(values[i]);
      }
    });
    
    return entry;
  });
};


const findCorrelations = (data, targets) => {
  const params = ["T1Celsius", "t1min", "T2Celsius", "t2min", 
                  "EquivalentsReagent1", "EquivalentsBASE1", "ConcentrationMolar"];
  
  const correlations = {};
  
  targets.forEach(target => {
    correlations[target] = {};
    
    params.forEach(param => {
      // Skip if the parameter has no variation
      const paramValues = data.map(d => d[param]);
      const uniqueValues = [...new Set(paramValues)];
      if (uniqueValues.length <= 1) {
        correlations[target][param] = 0;
        return;
      }
      
      // Calculate correlation
      const targetValues = data.map(d => d[target]);
      const targetMean = targetValues.reduce((a, b) => a + b, 0) / targetValues.length;
      const paramMean = paramValues.reduce((a, b) => a + b, 0) / paramValues.length;
      
      let numerator = 0;
      let denomParam = 0;
      let denomTarget = 0;
      
      for (let i = 0; i < data.length; i++) {
        const paramDiff = paramValues[i] - paramMean;
        const targetDiff = targetValues[i] - targetMean;
        
        numerator += paramDiff * targetDiff;
        denomParam += paramDiff * paramDiff;
        denomTarget += targetDiff * targetDiff;
      }
      
      const correlation = numerator / Math.sqrt(denomParam * denomTarget);
      correlations[target][param] = isNaN(correlation) ? 0 : correlation;
    });
  });
  
  return correlations;
};

const formatDecimal = (value) => {
  return parseFloat(value).toFixed(4);
};

// Helper function for calculating parameter sensitivities
const calculateParameterSensitivities = (data, target, paramRanges, sensitivityThreshold, stabilityThreshold) => {
  if (!data || !data.length || !target) return {};
  
  const sensitivities = {};
  const params = Object.keys(paramRanges);
  
  params.forEach(param => {
    // Skip if the parameter has no variation
    const paramValues = data.map(d => d[param]);
    const uniqueValues = [...new Set(paramValues)];
    if (uniqueValues.length <= 1) {
      sensitivities[param] = {
        meanGradient: 0,
        maxGradient: 0,
        safeZones: [],
        boundaries: [],
        stabilityRegions: []
      };
      return;
    }
    
    // Group data into bins based on parameter value
    const bins = 10;
    const binSize = paramRanges[param].range / bins;
    
    const binnedData = _.groupBy(data, item => {
      const normalizedValue = item[param] - paramRanges[param].min;
      return Math.min(bins - 1, Math.floor(normalizedValue / binSize));
    });
    
    // Calculate mean and std dev of target for each bin
    const binStats = Object.entries(binnedData).map(([binIndex, items]) => {
      const binValues = items.map(item => item[target]);
      const mean = binValues.length > 0 ? _.mean(binValues) : 0;
      const stdDev = binValues.length > 1 ? 
        Math.sqrt(_.sumBy(binValues, v => Math.pow(v - mean, 2)) / binValues.length) : 0;
      const paramMean = _.mean(items.map(item => item[param]));
      
      return {
        bin: parseInt(binIndex),
        paramValue: paramMean,
        mean,
        stdDev,
        count: items.length,
        // Coefficient of variation as a measure of stability
        stability: mean !== 0 ? stdDev / Math.abs(mean) : Infinity
      };
    });
    
    // Calculate gradient (sensitivity) between adjacent bins
    const gradients = [];
    for (let i = 0; i < binStats.length - 1; i++) {
      const current = binStats[i];
      const next = binStats[i + 1];
      
      if (current.count > 0 && next.count > 0) {
        const paramDelta = next.paramValue - current.paramValue;
        const targetDelta = next.mean - current.mean;
        
        // Normalize to percentage change per percent change in parameter
        const normalizedGradient = paramDelta !== 0 && current.mean !== 0 ? 
          (targetDelta / current.mean) / (paramDelta / current.paramValue) : 0;
        
        gradients.push({
          binStart: current.bin,
          paramValue: current.paramValue,
          nextParamValue: next.paramValue,
          gradient: normalizedGradient,
          normalizedGradient: Math.abs(normalizedGradient),
          stability: (current.stability + next.stability) / 2
        });
      }
    }
    
    sensitivities[param] = {
      binStats,
      gradients,
      // Overall sensitivity metrics
      meanGradient: _.meanBy(gradients, 'normalizedGradient') || 0,
      maxGradient: _.maxBy(gradients, 'normalizedGradient')?.normalizedGradient || 0,
      // Identify safe zones, boundaries and stability regions
      safeZones: gradients.filter(g => g.normalizedGradient < sensitivityThreshold)
                         .map(g => ({ 
                             start: g.paramValue, 
                             end: g.nextParamValue,
                             stability: g.stability
                         })),
      boundaries: gradients.filter(g => g.normalizedGradient >= sensitivityThreshold)
                           .map(g => ({ 
                               start: g.paramValue, 
                               end: g.nextParamValue,
                               sensitivity: g.normalizedGradient 
                           })),
      stabilityRegions: gradients.filter(g => g.stability < stabilityThreshold)
                                .map(g => ({ 
                                    start: g.paramValue, 
                                    end: g.nextParamValue,
                                    stability: g.stability 
                                }))
    };
  });
  
  // Rank parameters by sensitivity
  const rankedParams = Object.entries(sensitivities)
    .map(([param, data]) => ({
      param,
      meanSensitivity: data.meanGradient,
      maxSensitivity: data.maxGradient,
      safeZonesCount: data.safeZones.length,
      boundariesCount: data.boundaries.length,
      stabilityRegionsCount: data.stabilityRegions.length
    }))
    .sort((a, b) => b.meanSensitivity - a.meanSensitivity);
  
  return {
    parameterData: sensitivities,
    rankedParameters: rankedParams
  };
};

const BayBEDashboard = () => {
  const [data, setData] = useState([]);
  const [correlations, setCorrelations] = useState({});
  const [selectedTarget, setSelectedTarget] = useState('Yield');
  const [selectedParam1, setSelectedParam1] = useState('T1Celsius');
  const [selectedParam2, setSelectedParam2] = useState('t1min');
  const [currentIteration, setCurrentIteration] = useState(0);
  const [bestValues, setBestValues] = useState({
    Yield: { value: 0, iteration: 0 },
    Impurity: { value: Infinity, iteration: 0 },
    ImpurityXRatio: { value: 0, iteration: 0 }
  });
  
  // New state variables for operational window definition
  const [sensitivityThreshold, setSensitivityThreshold] = useState(0.05);
  const [stabilityThreshold, setStabilityThreshold] = useState(0.15);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showStabilityRegions, setShowStabilityRegions] = useState(true);
  
  useEffect(() => {
    const loadData = async () => {
      const optimizationData = await fetchOptimizationData();
      setData(optimizationData);
      
      if (optimizationData.length > 0) {
        setCurrentIteration(optimizationData.length);
        
        // Calculate correlations
        const targetNames = ['Yield', 'Impurity', 'ImpurityXRatio'];
        const corrs = findCorrelations(optimizationData, targetNames);
        setCorrelations(corrs);
        
        // Find best values
        const yieldMax = Math.max(...optimizationData.map(d => d.Yield));
        const yieldMaxIter = optimizationData.findIndex(d => d.Yield === yieldMax) + 1;
        
        const impurityMin = Math.min(...optimizationData.map(d => d.Impurity));
        const impurityMinIter = optimizationData.findIndex(d => d.Impurity === impurityMin) + 1;
        
        const ratioMax = Math.max(...optimizationData.map(d => d.ImpurityXRatio));
        const ratioMaxIter = optimizationData.findIndex(d => d.ImpurityXRatio === ratioMax) + 1;
        
        setBestValues({
          Yield: { value: yieldMax, iteration: yieldMaxIter },
          Impurity: { value: impurityMin, iteration: impurityMinIter },
          ImpurityXRatio: { value: ratioMax, iteration: ratioMaxIter }
        });
      }
    };
    
    loadData();
  }, []);
  
  const filteredData = data.slice(0, currentIteration);
  
  const getTopParameters = (target) => {
    if (!correlations[target]) return [];
    
    return Object.entries(correlations[target])
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([param, corr]) => ({
        parameter: param,
        correlation: corr,
        absCorrelation: Math.abs(corr)
      }));
  };
  
  const topParams = getTopParameters(selectedTarget);
  
  const parameterOptions = [
    "T1Celsius", "t1min", "T2Celsius", "t2min", 
    "EquivalentsReagent1", "EquivalentsBASE1", "ConcentrationMolar"
  ];
  
  const getDomain = (param) => {
    if (!data.length) return [0, 1];
    const values = data.map(d => d[param]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  };
  
  // Calculate parameter ranges for sensitivity analysis
  const paramRanges = useMemo(() => {
    const ranges = {};
    if (!data.length) return ranges;
    
    parameterOptions.forEach(param => {
      const values = data.map(d => d[param]);
      ranges[param] = {
        min: Math.min(...values),
        max: Math.max(...values),
        range: Math.max(...values) - Math.min(...values)
      };
    });
    return ranges;
  }, [data]);
  
  // Calculate parameter sensitivities for operational window definition
  const parameterSensitivities = useMemo(() => {
    return calculateParameterSensitivities(
      filteredData, 
      selectedTarget, 
      paramRanges, 
      sensitivityThreshold, 
      stabilityThreshold
    );
  }, [filteredData, selectedTarget, paramRanges, sensitivityThreshold, stabilityThreshold]);
  
  // Function to handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.trim().split('\n');
          const headers = lines[0].split(',');
          
          const parsedData = lines.slice(1).map((line, index) => {
            const values = line.split(',');
            const entry = { iteration: index + 1 };
            
            headers.forEach((header, i) => {
              entry[header] = parseFloat(values[i]);
            });
            
            return entry;
          });
          
          setData(parsedData);
          setCurrentIteration(parsedData.length);
          
          // Calculate correlations
          const targetNames = ['Yield', 'Impurity', 'ImpurityXRatio'];
          const corrs = findCorrelations(parsedData, targetNames);
          setCorrelations(corrs);
          
          // Find best values
          const yieldMax = Math.max(...parsedData.map(d => d.Yield));
          const yieldMaxIter = parsedData.findIndex(d => d.Yield === yieldMax) + 1;
          
          const impurityMin = Math.min(...parsedData.map(d => d.Impurity));
          const impurityMinIter = parsedData.findIndex(d => d.Impurity === impurityMin) + 1;
          
          const ratioMax = Math.max(...parsedData.map(d => d.ImpurityXRatio));
          const ratioMaxIter = parsedData.findIndex(d => d.ImpurityXRatio === ratioMax) + 1;
          
          setBestValues({
            Yield: { value: yieldMax, iteration: yieldMaxIter },
            Impurity: { value: impurityMin, iteration: impurityMinIter },
            ImpurityXRatio: { value: ratioMax, iteration: ratioMaxIter }
          });
          
          alert(`Successfully loaded ${parsedData.length} data points from the CSV file`);
        } catch (error) {
          console.error("Error parsing CSV file:", error);
          alert("Error parsing CSV file. Please make sure it's in the correct format.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex flex-col gap-4 max-w-7xl mx-auto">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold">BayBE Optimization Dashboard</CardTitle>
            <CardDescription>
              Bayesian Optimization Visualization using the BayBE Library
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.length === 0 && (
              <div className="my-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                <h3 className="text-amber-800 font-medium mb-2">No optimization data found</h3>
                <p className="text-amber-700 mb-2">
                  The dashboard couldn't find or load the "optimization.csv" file. You have two options:
                </p>
                <ol className="list-decimal list-inside text-amber-700 space-y-1 mb-3">
                  <li>Place your "optimization.csv" file in the same directory as this HTML file</li>
                  <li>Upload your optimization CSV file using the button below</li>
                </ol>
                <div className="flex items-center space-x-2">
                  <label 
                    htmlFor="csv-upload" 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700"
                  >
                    Upload CSV File
                  </label>
                  <input 
                    id="csv-upload" 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                  />
                  <span className="text-sm text-amber-600">
                    (Expecting columns: T1Celsius, t1min, T2Celsius, t2min, 
                    EquivalentsReagent1, EquivalentsBASE1, ConcentrationMolar, Yield, Impurity, ImpurityXRatio)
                  </span>
                </div>
              </div>
            )}
            
            {data.length > 0 && (
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="font-medium">Current iteration: </span>
                    <span className="text-blue-600">{currentIteration} / {data.length}</span>
                  </div>
                  <label 
                    htmlFor="csv-upload-small" 
                    className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 cursor-pointer"
                  >
                    Change Data
                  </label>
                  <input 
                    id="csv-upload-small" 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                  />
                </div>
                <div className="w-1/2">
                  <Slider 
                    value={[currentIteration]} 
                    min={1} 
                    max={data.length || 1} 
                    step={1}
                    onValueChange={(value) => setCurrentIteration(value[0])}
                    className="py-4"
                  />
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {['Yield', 'Impurity', 'ImpurityXRatio'].map(metric => (
                <Card key={metric} className={`border-l-4 ${
                  metric === 'Yield' ? 'border-l-blue-500' : 
                  metric === 'Impurity' ? 'border-l-red-500' : 'border-l-green-500'
                }`}>
                  <CardContent className="pt-4">
                    <div className="text-sm text-gray-500">{metric}</div>
                    <div className="flex justify-between items-baseline mt-1">
                      <div className="text-2xl font-semibold">
                        {metric === 'Impurity' ? 
                          formatDecimal(Math.min(...filteredData.map(d => d[metric]))) :
                          formatDecimal(Math.max(...filteredData.map(d => d[metric])))}
                      </div>
                      <div className="text-sm text-gray-500">
                        Best: {formatDecimal(bestValues[metric].value)} 
                        <span className="ml-1 text-xs">(iter {bestValues[metric].iteration})</span>
                      </div>
                    </div>
                    <div className="text-sm mt-1">
                      {metric === 'Impurity' ? 'Minimizing' : 'Maximizing'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="history">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="history">Optimization History</TabsTrigger>
            <TabsTrigger value="parameters">Parameter Effects</TabsTrigger>
            <TabsTrigger value="interactions">Parameter Interactions</TabsTrigger>
            <TabsTrigger value="surrogate">Surrogate Model</TabsTrigger>
            <TabsTrigger value="operational">Operational Window</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Optimization Progress</CardTitle>
                <CardDescription>
                  Tracking how target values evolve over iterations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="iteration" 
                        label={{ value: 'Iteration', position: 'insideBottom', offset: -5 }} 
                      />
                      <YAxis />
                      <Tooltip formatter={(value) => formatDecimal(value)} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="Yield" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Impurity" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ImpurityXRatio" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Best Values Over Time</CardTitle>
                <CardDescription>
                  Shows how the best values improve with iterations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData.map((d, i) => {
                      const prevData = filteredData.slice(0, i + 1);
                      return {
                        iteration: d.iteration,
                        BestYield: Math.max(...prevData.map(d => d.Yield)),
                        LowestImpurity: Math.min(...prevData.map(d => d.Impurity)),
                        BestImpurityXRatio: Math.max(...prevData.map(d => d.ImpurityXRatio))
                      };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="iteration" 
                        label={{ value: 'Iteration', position: 'insideBottom', offset: -5 }} 
                      />
                      <YAxis />
                      <Tooltip formatter={(value) => formatDecimal(value)} />
                      <Legend />
                      <Line 
                        type="stepAfter" 
                        dataKey="BestYield" 
                        name="Best Yield"
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="stepAfter" 
                        dataKey="LowestImpurity" 
                        name="Lowest Impurity"
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="stepAfter" 
                        dataKey="BestImpurityXRatio" 
                        name="Best ImpurityXRatio"
                        stroke="#22c55e" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="parameters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parameter Correlations</CardTitle>
                <CardDescription>
                  Relative influence of parameters on the selected target
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Target</label>
                    <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yield">Yield</SelectItem>
                        <SelectItem value="Impurity">Impurity</SelectItem>
                        <SelectItem value="ImpurityXRatio">ImpurityXRatio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topParams}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 125, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        domain={[-1, 1]}
                        ticks={[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="parameter" 
                      />
                      <Tooltip 
                        formatter={(value) => [formatDecimal(value), 'Correlation']}
                      />
                      <ReferenceLine x={0} stroke="#000" />
                      <Bar dataKey="correlation" name="Correlation">
                        {topParams.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.correlation > 0 ? '#3b82f6' : '#ef4444'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Parameter Effect Visualization</CardTitle>
                <CardDescription>
                  Shows the relationship between parameters and the selected target
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Target</label>
                    <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yield">Yield</SelectItem>
                        <SelectItem value="Impurity">Impurity</SelectItem>
                        <SelectItem value="ImpurityXRatio">ImpurityXRatio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameter</label>
                    <Select value={selectedParam1} onValueChange={setSelectedParam1}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterOptions.map(param => (
                          <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <CartesianGrid />
                      <XAxis 
                        type="number" 
                        dataKey={selectedParam1} 
                        name={selectedParam1} 
                        domain={getDomain(selectedParam1)}
                        label={{ value: selectedParam1, position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey={selectedTarget} 
                        name={selectedTarget}
                        label={{ value: selectedTarget, angle: -90, position: 'insideLeft' }}
                      />
                      <ZAxis range={[100, 100]} />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }} 
                        formatter={(value) => formatDecimal(value)}
                      />
                      <Scatter 
                        name={selectedTarget} 
                        data={filteredData} 
                        fill={
                          selectedTarget === 'Yield' ? '#3b82f6' : 
                          selectedTarget === 'Impurity' ? '#ef4444' : '#22c55e'
                        }
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="interactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parameter Interactions</CardTitle>
                <CardDescription>
                  Shows how parameter pairs influence the selected target
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Target</label>
                    <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yield">Yield</SelectItem>
                        <SelectItem value="Impurity">Impurity</SelectItem>
                        <SelectItem value="ImpurityXRatio">ImpurityXRatio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameter 1</label>
                    <Select value={selectedParam1} onValueChange={setSelectedParam1}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterOptions.map(param => (
                          <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameter 2</label>
                    <Select value={selectedParam2} onValueChange={setSelectedParam2}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterOptions.map(param => (
                          <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 20, right: 40, bottom: 20, left: 20 }}
                    >
                      <CartesianGrid />
                      <XAxis 
                        type="number" 
                        dataKey={selectedParam1} 
                        name={selectedParam1} 
                        domain={getDomain(selectedParam1)}
                        label={{ value: selectedParam1, position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey={selectedParam2} 
                        name={selectedParam2}
                        domain={getDomain(selectedParam2)}
                        label={{ value: selectedParam2, angle: -90, position: 'insideLeft' }}
                      />
                      <ZAxis 
                        type="number" 
                        dataKey={selectedTarget} 
                        name={selectedTarget} 
                        range={[60, 400]}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value, name) => {
                          if (name === 'z') {
                            return [formatDecimal(value), selectedTarget];
                          }
                          return [formatDecimal(value), name];
                        }}
                      />
                      <Scatter 
                        name="Parameters" 
                        data={filteredData.map(d => ({
                          ...d,
                          z: d[selectedTarget]
                        }))} 
                        fill={
                          selectedTarget === 'Yield' ? '#3b82f6' : 
                          selectedTarget === 'Impurity' ? '#ef4444' : '#22c55e'
                        }
                      />
                      <Brush dataKey={selectedParam1} height={30} stroke="#8884d8" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="surrogate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gaussian Process Surrogate Model</CardTitle>
                <CardDescription>
                  Visualizes the surrogate model for the selected parameter and target
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Target</label>
                    <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yield">Yield</SelectItem>
                        <SelectItem value="Impurity">Impurity</SelectItem>
                        <SelectItem value="ImpurityXRatio">ImpurityXRatio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameter</label>
                    <Select value={selectedParam1} onValueChange={setSelectedParam1}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterOptions.map(param => (
                          <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="text-center py-12 text-gray-500">
                  <p>The GP surrogate model visualization would be rendered here.</p>
                  <p className="mt-2 text-sm">
                    This would typically show the mean prediction and uncertainty bounds from the GP model
                    for the selected parameter and target, similar to the gp_surrogate_visualization component
                    in the BayBE library.
                  </p>
                </div>

                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      // Generate surrogate model visualization data
                      // This is a simplified emulation of what the GP surrogate model might predict
                      const paramMin = Math.min(...filteredData.map(d => d[selectedParam1]));
                      const paramMax = Math.max(...filteredData.map(d => d[selectedParam1]));
                      const range = paramMax - paramMin;
                      const padding = range * 0.1;
                      
                      // Generate smooth line for mean prediction
                      const points = 100;
                      const step = (range + padding * 2) / points;
                      
                      // Fit a simple polynomial to emulate GP mean prediction
                      const xs = filteredData.map(d => d[selectedParam1]);
                      const ys = filteredData.map(d => d[selectedTarget]);
                      
                      // Simple function to fit a quadratic curve to the data
                      const fitQuadratic = (x, y) => {
                        const n = x.length;
                        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumX2Y = 0, sumX3 = 0, sumX4 = 0;
                        
                        for (let i = 0; i < n; i++) {
                          sumX += x[i];
                          sumY += y[i];
                          sumXY += x[i] * y[i];
                          sumX2 += x[i] * x[i];
                          sumX2Y += x[i] * x[i] * y[i];
                          sumX3 += x[i] * x[i] * x[i];
                          sumX4 += x[i] * x[i] * x[i] * x[i];
                        }
                        
                        const a = (sumX2Y * sumX2 - sumXY * sumX3) / (sumX4 * sumX2 - sumX3 * sumX3);
                        const b = (sumXY * sumX4 - sumX2Y * sumX3) / (sumX4 * sumX2 - sumX3 * sumX3);
                        const c = (sumY - b * sumX - a * sumX2) / n;
                        
                        return [a, b, c];
                      };
                      
                      const [a, b, c] = fitQuadratic(xs, ys);
                      
                      const predict = (x) => {
                        return a * x * x + b * x + c;
                      };
                      
                      // Generate points for surrogate model visualization
                      const result = [];
                      for (let i = 0; i <= points; i++) {
                        const x = paramMin - padding + i * step;
                        const meanPrediction = predict(x);
                        
                        // Add noise-based uncertainty that reduces near observed points
                        let uncertainty = 0.1;
                        // Reduce uncertainty near observed points
                        for (const d of filteredData) {
                          const dist = Math.abs(d[selectedParam1] - x) / range;
                          if (dist < 0.1) {
                            uncertainty *= dist * 10; // Approaches zero as dist approaches zero
                          }
                        }
                        
                        result.push({
                          [selectedParam1]: x,
                          mean: meanPrediction,
                          upperBound: meanPrediction + uncertainty * Math.abs(meanPrediction),
                          lowerBound: meanPrediction - uncertainty * Math.abs(meanPrediction),
                        });
                      }
                      
                      return result;
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey={selectedParam1} 
                        label={{ value: selectedParam1, position: 'insideBottom', offset: -5 }} 
                      />
                      <YAxis 
                        label={{ value: selectedTarget, angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip formatter={(value) => formatDecimal(value)} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="mean" 
                        name="GP Mean Prediction"
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="upperBound" 
                        name="Upper Confidence Bound"
                        stroke="#8884d8" 
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="lowerBound" 
                        name="Lower Confidence Bound"
                        stroke="#8884d8" 
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                      
                      {/* Scatter points for actual observations */}
                      <Scatter 
                        name="Observations" 
                        data={filteredData.map(d => ({
                          [selectedParam1]: d[selectedParam1], 
                          mean: d[selectedTarget]
                        }))} 
                        fill="#222"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* New Operational Window Tab */}
          <TabsContent value="operational" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Operational Window Definition</CardTitle>
                <CardDescription>
                  Analyze process stability and define safe operating windows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Target</label>
                    <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yield">Yield</SelectItem>
                        <SelectItem value="Impurity">Impurity</SelectItem>
                        <SelectItem value="ImpurityXRatio">ImpurityXRatio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameter</label>
                    <Select value={selectedParam1} onValueChange={setSelectedParam1}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterOptions.map(param => (
                          <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sensitivity Threshold</label>
                    <div className="flex items-center space-x-2">
                      <Slider 
                        value={[sensitivityThreshold * 100]} 
                        min={1} 
                        max={20} 
                        step={1}
                        onValueChange={(value) => setSensitivityThreshold(value[0] / 100)}
                        className="w-32"
                      />
                      <span>{(sensitivityThreshold * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2 mb-4">
                  <Button 
                    variant={showSafeZones ? "default" : "outline"} 
                    className="text-xs h-8"
                    onClick={() => setShowSafeZones(!showSafeZones)}
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    Safe Zones
                  </Button>
                  <Button 
                    variant={showBoundaries ? "default" : "outline"} 
                    className="text-xs h-8"
                    onClick={() => setShowBoundaries(!showBoundaries)}
                  >
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    Sensitivity Boundaries
                  </Button>
                  <Button 
                    variant={showStabilityRegions ? "default" : "outline"} 
                    className="text-xs h-8"
                    onClick={() => setShowStabilityRegions(!showStabilityRegions)}
                  >
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                    Stability Regions
                  </Button>
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={filteredData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey={selectedParam1} 
                        domain={getDomain(selectedParam1)}
                        label={{ value: selectedParam1, position: 'insideBottom', offset: -5 }} 
                      />
                      <YAxis 
                        yAxisId="left"
                        label={{ value: selectedTarget, angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 'auto']}
                        label={{ value: "Variability", angle: 90, position: 'insideRight' }}
                      />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === selectedTarget) return [value.toFixed(4), name];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone"
                        dataKey={selectedTarget}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      
                      {/* Safe zones calculated from parameterSensitivities */}
                      {showSafeZones && parameterSensitivities?.parameterData?.[selectedParam1]?.safeZones.map((zone, idx) => (
                        <ReferenceArea 
                          key={`safe-${idx}`}
                          x1={zone.start} 
                          x2={zone.end} 
                          stroke="none"
                          fill="#22c55e" 
                          fillOpacity={0.2} 
                          yAxisId="left"
                        />
                      ))}
                      
                      {/* Boundaries calculated from parameterSensitivities */}
                      {showBoundaries && parameterSensitivities?.parameterData?.[selectedParam1]?.boundaries.map((zone, idx) => (
                        <ReferenceArea 
                          key={`boundary-${idx}`}
                          x1={zone.start} 
                          x2={zone.end} 
                          stroke="none"
                          fill="#ef4444" 
                          fillOpacity={0.2} 
                          yAxisId="left"
                        />
                      ))}
                      
                      {/* Stability regions calculated from parameterSensitivities */}
                      {showStabilityRegions && parameterSensitivities?.parameterData?.[selectedParam1]?.stabilityRegions.map((zone, idx) => (
                        <ReferenceArea 
                          key={`stability-${idx}`}
                          x1={zone.start} 
                          x2={zone.end} 
                          stroke="none"
                          fill="#eab308" 
                          fillOpacity={0.2} 
                          yAxisId="left"
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Operational Window Analysis</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Green areas indicate safe zones where small variations have minimal impact on {selectedTarget}.
                    Red areas show sensitivity boundaries where small changes cause significant shifts.
                    Yellow areas show stability regions where the process is most robust to parameter variation.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="text-sm text-gray-500">Safe Zones</div>
                        <div className="flex justify-between items-baseline mt-1">
                          <div className="text-2xl font-semibold">
                            {parameterSensitivities?.parameterData?.[selectedParam1]?.safeZones.length || 0}
                          </div>
                          <div className="text-sm text-gray-500">identified</div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-l-4 border-l-red-500">
                      <CardContent className="pt-4">
                        <div className="text-sm text-gray-500">Sensitivity Boundaries</div>
                        <div className="flex justify-between items-baseline mt-1">
                          <div className="text-2xl font-semibold">
                            {parameterSensitivities?.parameterData?.[selectedParam1]?.boundaries.length || 0}
                          </div>
                          <div className="text-sm text-gray-500">detected</div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-l-4 border-l-yellow-500">
                      <CardContent className="pt-4">
                        <div className="text-sm text-gray-500">Stability Regions</div>
                        <div className="flex justify-between items-baseline mt-1">
                          <div className="text-2xl font-semibold">
                            {parameterSensitivities?.parameterData?.[selectedParam1]?.stabilityRegions.length || 0}
                          </div>
                          <div className="text-sm text-gray-500">identified</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Parameter Interaction Stability</CardTitle>
                <CardDescription>
                  Analyze stability in the 2D parameter space
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameter 1</label>
                    <Select value={selectedParam1} onValueChange={setSelectedParam1}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterOptions.map(param => (
                          <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parameter 2</label>
                    <Select value={selectedParam2} onValueChange={setSelectedParam2}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterOptions.map(param => (
                          <SelectItem key={param} value={param}>{param}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <CartesianGrid />
                      <XAxis 
                        type="number" 
                        dataKey={selectedParam1} 
                        name={selectedParam1} 
                        domain={getDomain(selectedParam1)}
                        label={{ value: selectedParam1, position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey={selectedParam2} 
                        name={selectedParam2}
                        domain={getDomain(selectedParam2)}
                        label={{ value: selectedParam2, angle: -90, position: 'insideLeft' }}
                      />
                      <ZAxis 
                        type="number" 
                        dataKey={selectedTarget} 
                        range={[60, 400]}
                        name={selectedTarget}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value, name) => {
                          if (name === 'z') {
                            return [value.toFixed(4), selectedTarget];
                          }
                          return [value.toFixed(2), name];
                        }}
                      />
                      
                      {/* Color-coded scatter points based on stability */}
                      <Scatter 
                        name={selectedTarget} 
                        data={filteredData.map(d => {
                          // Calculate local stability
                          const neighbours = filteredData.filter(n => 
                            Math.abs(n[selectedParam1] - d[selectedParam1]) < (getDomain(selectedParam1)[1] - getDomain(selectedParam1)[0]) * 0.1 &&
                            Math.abs(n[selectedParam2] - d[selectedParam2]) < (getDomain(selectedParam2)[1] - getDomain(selectedParam2)[0]) * 0.1
                          );
                          
                          if (neighbours.length > 2) {
                            const values = neighbours.map(n => n[selectedTarget]);
                            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
                            const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
                            const cv = mean !== 0 ? stdDev / Math.abs(mean) : 1;
                            
                            // Assign stability level
                            return {
                              ...d,
                              z: d[selectedTarget],
                              stability: cv < 0.05 ? "high" : (cv < 0.1 ? "medium" : "low")
                            };
                          }
                          
                          return {...d, z: d[selectedTarget], stability: "unknown"};
                        })}
                      >
                        {filteredData.map((entry, index) => {
                          const stability = (() => {
                            // Calculate local stability
                            const neighbours = filteredData.filter(n => 
                              Math.abs(n[selectedParam1] - entry[selectedParam1]) < (getDomain(selectedParam1)[1] - getDomain(selectedParam1)[0]) * 0.1 &&
                              Math.abs(n[selectedParam2] - entry[selectedParam2]) < (getDomain(selectedParam2)[1] - getDomain(selectedParam2)[0]) * 0.1
                            );
                            
                            if (neighbours.length > 2) {
                              const values = neighbours.map(n => n[selectedTarget]);
                              const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
                              const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
                              const cv = mean !== 0 ? stdDev / Math.abs(mean) : 1;
                              
                              // Assign stability color
                              return cv < 0.05 ? "#22c55e" : (cv < 0.1 ? "#eab308" : "#ef4444");
                            }
                            
                            return "#8884d8"; // Default
                          })();
                          
                          return <Cell key={`cell-${index}`} fill={stability} />;
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex space-x-4 mt-4">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 mr-2"></div>
                    <span className="text-sm">High Stability</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                    <span className="text-sm">Medium Stability</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-500 mr-2"></div>
                    <span className="text-sm">Low Stability</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Parameter Control Recommendations</CardTitle>
                <CardDescription>
                  Guidance for robust process control based on sensitivity analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {parameterSensitivities?.rankedParameters?.map((param, idx) => {
                    // Generate recommendations based on parameter sensitivities
                    const sensitivityLevel = param.meanSensitivity > 0.5 ? 'high' : 
                                            (param.meanSensitivity > 0.2 ? 'medium' : 'low');
                    
                    let advice = '';
                    let controlPriority = '';
                    
                    switch (sensitivityLevel) {
                      case 'high':
                        advice = `Maintain tight control of ${param.param}. Small variations could significantly impact ${selectedTarget}.`;
                        controlPriority = 'high';
                        break;
                      case 'medium':
                        advice = `Monitor ${param.param} regularly. Moderate control is needed.`;
                        controlPriority = 'medium';
                        break;
                      case 'low':
                        advice = `${param.param} has minimal impact on ${selectedTarget}. Standard control is sufficient.`;
                        controlPriority = 'low';
                        break;
                    }
                    
                    // Add stability information if available
                    if (param.stabilityRegionsCount > 0) {
                      advice += ` Has ${param.stabilityRegionsCount} stable region(s) where process variability is minimal.`;
                    }
                    
                    return (
                      <div key={idx} className="flex p-2 border-b border-gray-200">
                        <div className="flex-shrink-0 mr-3">
                          <div className={`w-4 h-4 rounded-full ${
                            controlPriority === 'high' ? 'bg-red-500' : 
                            controlPriority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></div>
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between">
                            <h4 className="font-medium">{param.param}</h4>
                            <span className="text-xs">
                              Sensitivity: {(param.meanSensitivity * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{advice}</p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {(!parameterSensitivities?.rankedParameters || parameterSensitivities.rankedParameters.length === 0) && (
                    <div className="p-4 text-center text-gray-500">
                      Not enough data to generate control recommendations
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BayBEDashboard;