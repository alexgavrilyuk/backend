// modules/dataProcessing/aggregator.js

/**
 * Combines results from multiple SQL queries
 * Performs data transformations and joins
 * Prepares combined datasets for analysis and visualization
 */

const _ = require('lodash');

/**
 * Combine multiple query results based on a query plan
 * @param {Array} queryResults - Array of query results, each with an id and data
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Combined and transformed dataset
 */
function combineQueryResults(queryResults, queryPlan) {
  try {
    console.log(`Combining ${queryResults.length} query results according to plan`);

    // For simple plans with a single result, return it directly
    if (queryPlan.type === 'simple' || queryResults.length === 1) {
      return {
        type: 'simple',
        data: queryResults[0].data,
        metadata: {
          queryCount: 1,
          combinationMethod: 'direct'
        }
      };
    }

    // Map results by their ID for easier lookup
    const resultsById = queryResults.reduce((map, result) => {
      map[result.id] = result.data;
      return map;
    }, {});

    // Determine combination method based on query type
    const queryType = queryPlan.queryType || 'unknown';
    let combinedData;

    switch (queryType) {
      case 'temporal-comparison':
        combinedData = combineTemporalComparison(resultsById, queryPlan);
        break;
      case 'multi-dimensional-aggregation':
        combinedData = combineMultiDimensionalAggregation(resultsById, queryPlan);
        break;
      case 'trend-and-summary':
        combinedData = combineTrendAndSummary(resultsById, queryPlan);
        break;
      case 'performers-with-details':
        combinedData = combinePerformersWithDetails(resultsById, queryPlan);
        break;
      case 'historical-prediction':
        combinedData = combineHistoricalPrediction(resultsById, queryPlan);
        break;
      default:
        // Generic combination for unknown query types
        combinedData = combineGeneric(resultsById, queryPlan);
    }

    return {
      type: 'complex',
      queryType,
      data: combinedData,
      metadata: {
        queryCount: queryResults.length,
        combinationMethod: queryType
      }
    };
  } catch (error) {
    console.error('Error combining query results:', error);
    // Return the first result as fallback
    return {
      type: 'simple',
      error: 'Error combining query results',
      data: queryResults[0]?.data || [],
      metadata: {
        queryCount: queryResults.length,
        combinationMethod: 'error-fallback'
      }
    };
  }
}

/**
 * Combine results from temporal comparison queries
 * @param {Object} resultsById - Map of query results by ID
 * @param {Object} queryPlan - The query execution plan
 * @returns {Array} Combined dataset
 */
function combineTemporalComparison(resultsById, queryPlan) {
  // Find steps with period data
  const periodSteps = queryPlan.steps.filter(step =>
    step.outputType === 'aggregated' &&
    step.description.toLowerCase().includes('period')
  );

  // If we don't have multiple period queries, fall back to generic combination
  if (periodSteps.length < 2) {
    return combineGeneric(resultsById, queryPlan);
  }

  // Find common dimension for joining
  let joinDimension = findCommonDimension(
    resultsById[periodSteps[0].id],
    resultsById[periodSteps[1].id]
  );

  // If no common dimension, try to use time/date dimensions
  if (!joinDimension) {
    joinDimension = findTimeDimension(resultsById[periodSteps[0].id]);
  }

  // If still no dimension, use first column
  if (!joinDimension && resultsById[periodSteps[0].id].length > 0) {
    joinDimension = Object.keys(resultsById[periodSteps[0].id][0])[0];
  }

  // Create period identifiers for the combined data
  const period1Id = extractPeriodIdentifier(periodSteps[0].description);
  const period2Id = extractPeriodIdentifier(periodSteps[1].description);

  // Prepare combined dataset
  let combinedData = [];

  // Get data for both periods
  const period1Data = resultsById[periodSteps[0].id] || [];
  const period2Data = resultsById[periodSteps[1].id] || [];

  // Find value columns (non-dimension columns)
  const valueColumns = period1Data.length > 0
    ? Object.keys(period1Data[0]).filter(col => col !== joinDimension)
    : [];

  // Create period lookup maps
  const period1Map = _.keyBy(period1Data, joinDimension);
  const period2Map = _.keyBy(period2Data, joinDimension);

  // Get all dimension values
  const allDimensionValues = _.union(
    period1Data.map(row => row[joinDimension]),
    period2Data.map(row => row[joinDimension])
  );

  // Create combined rows for each dimension value
  allDimensionValues.forEach(dimensionValue => {
    const period1Values = period1Map[dimensionValue] || {};
    const period2Values = period2Map[dimensionValue] || {};

    const combinedRow = {
      [joinDimension]: dimensionValue
    };

    // Add values from period 1
    valueColumns.forEach(col => {
      combinedRow[`${col}_${period1Id}`] = period1Values[col] || null;
    });

    // Add values from period 2
    valueColumns.forEach(col => {
      combinedRow[`${col}_${period2Id}`] = period2Values[col] || null;
    });

    // Calculate differences and percentages
    valueColumns.forEach(col => {
      const value1 = period1Values[col] || 0;
      const value2 = period2Values[col] || 0;

      if (value1 !== 0 && value2 !== 0) {
        combinedRow[`${col}_diff`] = value2 - value1;
        combinedRow[`${col}_pct_change`] = ((value2 - value1) / value1) * 100;
      }
    });

    combinedData.push(combinedRow);
  });

  return combinedData;
}

/**
 * Combine results from multi-dimensional aggregation queries
 * @param {Object} resultsById - Map of query results by ID
 * @param {Object} queryPlan - The query execution plan
 * @returns {Array} Combined dataset
 */
function combineMultiDimensionalAggregation(resultsById, queryPlan) {
  // Identify dimension steps
  const dimensionSteps = queryPlan.steps.filter(step =>
    step.outputType === 'aggregated'
  );

  // If only one aggregation, return it directly
  if (dimensionSteps.length < 2) {
    return resultsById[dimensionSteps[0]?.id] || [];
  }

  // Create a combined dataset with all dimensions
  // Start with detailed data if available
  const detailedDataStep = queryPlan.steps.find(step => step.outputType === 'raw-data');
  let combinedData = detailedDataStep ? resultsById[detailedDataStep.id] || [] : [];

  // If no detailed data, start with the first dimension result
  if (combinedData.length === 0 && dimensionSteps.length > 0) {
    combinedData = resultsById[dimensionSteps[0].id] || [];
  }

  // For each dimension, add aggregated data keyed by the dimension
  for (let i = 1; i < dimensionSteps.length; i++) {
    const dimensionStep = dimensionSteps[i];
    const dimensionData = resultsById[dimensionStep.id] || [];
    if (dimensionData.length === 0) continue;

    // Extract the dimension name from step description
    const dimensionName = extractDimensionName(dimensionStep.description);

    // Find the dimension column
    const dimensionColumns = Object.keys(dimensionData[0]);
    const valueColumns = dimensionColumns.filter(col =>
      !isNaN(dimensionData[0][col]) &&
      col.includes('sum_') || col.includes('avg_') || col.includes('count_') ||
      col.includes('total_') || col.includes('average_')
    );

    // Find likely dimension column (non-numeric, not an aggregate)
    const likelyDimensionCol = dimensionColumns.find(col =>
      !valueColumns.includes(col) &&
      !col.includes('sum_') && !col.includes('avg_') && !col.includes('count_')
    ) || dimensionColumns[0];

    // Create a map of dimension values to aggregated values
    const dimensionMap = _.keyBy(dimensionData, likelyDimensionCol);

    // Add dimension aggregates to the result
    combinedData = combinedData.map(row => {
      const dimensionValue = row[likelyDimensionCol];
      const dimensionRow = dimensionMap[dimensionValue] || {};

      const enrichedRow = { ...row };

      // Add aggregated values with prefixed dimension name
      valueColumns.forEach(col => {
        if (dimensionRow[col] !== undefined) {
          enrichedRow[`${dimensionName}_${col}`] = dimensionRow[col];
        }
      });

      return enrichedRow;
    });
  }

  return combinedData;
}

/**
 * Combine results from trend and summary queries
 * @param {Object} resultsById - Map of query results by ID
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Combined dataset with trend and summary sections
 */
function combineTrendAndSummary(resultsById, queryPlan) {
  // Find trend and summary steps
  const trendStep = queryPlan.steps.find(step =>
    step.description.toLowerCase().includes('trend')
  );

  const summaryStep = queryPlan.steps.find(step =>
    step.outputType === 'summary' ||
    step.description.toLowerCase().includes('summary') ||
    step.description.toLowerCase().includes('total')
  );

  // If we don't have both pieces, use generic combination
  if (!trendStep && !summaryStep) {
    return combineGeneric(resultsById, queryPlan);
  }

  // Structure to hold combined data
  const combinedResult = {
    trends: resultsById[trendStep?.id] || [],
    summary: resultsById[summaryStep?.id] || [],
    combined: [] // Will fill this with integrated data if possible
  };

  // If both trend and summary data are available, try to combine them
  if (trendStep && summaryStep &&
      combinedResult.trends.length > 0 &&
      combinedResult.summary.length > 0) {

    try {
      // Find dimension to integrate on (often time-based for trends)
      const trendData = combinedResult.trends;
      const summaryData = combinedResult.summary;

      // Try to find a common dimension for joining
      const trendColumns = Object.keys(trendData[0] || {});
      const summaryColumns = Object.keys(summaryData[0] || {});

      const commonDimensions = trendColumns.filter(col => summaryColumns.includes(col));

      if (commonDimensions.length > 0) {
        // Use first common dimension as join key
        const joinKey = commonDimensions[0];

        // Create lookup from summary data
        const summaryLookup = _.keyBy(summaryData, joinKey);

        // Integrate summary into trend data
        combinedResult.combined = trendData.map(trendRow => {
          const joinValue = trendRow[joinKey];
          const summaryRow = summaryLookup[joinValue] || {};

          // Combine trend and summary rows
          const combinedRow = { ...trendRow };

          // Add summary columns with 'summary_' prefix
          summaryColumns.forEach(col => {
            if (col !== joinKey && summaryRow[col] !== undefined) {
              combinedRow[`summary_${col}`] = summaryRow[col];
            }
          });

          return combinedRow;
        });
      }
    } catch (error) {
      console.error('Error integrating trend and summary data:', error);
      // Leave combined array empty if integration fails
    }
  }

  return combinedResult;
}

/**
 * Combine results from performers with details queries
 * @param {Object} resultsById - Map of query results by ID
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Combined dataset with performers and details
 */
function combinePerformersWithDetails(resultsById, queryPlan) {
  // Find performers and details steps
  const performersStep = queryPlan.steps.find(step =>
    step.description.toLowerCase().includes('performer') ||
    step.description.toLowerCase().includes('top') ||
    step.description.toLowerCase().includes('bottom')
  );

  const detailsStep = queryPlan.steps.find(step =>
    step.description.toLowerCase().includes('detail')
  );

  // If we don't have both pieces, use generic combination
  if (!performersStep && !detailsStep) {
    return combineGeneric(resultsById, queryPlan);
  }

  // Structure to hold combined data
  const combinedResult = {
    performers: resultsById[performersStep?.id] || [],
    details: resultsById[detailsStep?.id] || [],
    combined: [] // Will fill this with the enriched performers
  };

  // If both performers and details data are available, enrich performers with details
  if (performersStep && detailsStep &&
      combinedResult.performers.length > 0 &&
      combinedResult.details.length > 0) {

    try {
      // Find dimension to integrate on (entity ID, name, etc.)
      const performersData = combinedResult.performers;
      const detailsData = combinedResult.details;

      // Try to find a common join column
      const performerColumns = Object.keys(performersData[0] || {});
      const detailsColumns = Object.keys(detailsData[0] || {});

      const commonColumns = performerColumns.filter(col => detailsColumns.includes(col));

      if (commonColumns.length > 0) {
        // Use first common column as join key
        const joinKey = commonColumns[0];

        // Create lookup from details data
        // Use an array because there might be multiple detail rows per performer
        const detailsLookup = {};
        detailsData.forEach(detailRow => {
          const joinValue = detailRow[joinKey];
          if (!detailsLookup[joinValue]) {
            detailsLookup[joinValue] = [];
          }
          detailsLookup[joinValue].push(detailRow);
        });

        // Enrich performers with their details
        combinedResult.combined = performersData.map(performerRow => {
          const joinValue = performerRow[joinKey];
          const relatedDetails = detailsLookup[joinValue] || [];

          return {
            ...performerRow,
            details: relatedDetails
          };
        });
      }
    } catch (error) {
      console.error('Error integrating performers and details:', error);
      // Leave combined array empty if integration fails
    }
  }

  return combinedResult;
}

/**
 * Combine results from historical prediction queries
 * @param {Object} resultsById - Map of query results by ID
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Combined dataset with historical and prediction data
 */
function combineHistoricalPrediction(resultsById, queryPlan) {
  // Find historical and prediction steps
  const historicalStep = queryPlan.steps.find(step =>
    step.description.toLowerCase().includes('historical') ||
    step.description.toLowerCase().includes('history') ||
    step.description.toLowerCase().includes('past')
  );

  const predictionStep = queryPlan.steps.find(step =>
    step.description.toLowerCase().includes('prediction') ||
    step.description.toLowerCase().includes('forecast') ||
    step.description.toLowerCase().includes('future')
  );

  // If we don't have both pieces, use generic combination
  if (!historicalStep && !predictionStep) {
    return combineGeneric(resultsById, queryPlan);
  }

  // Structure to hold combined data
  const combinedResult = {
    historical: resultsById[historicalStep?.id] || [],
    prediction: resultsById[predictionStep?.id] || [],
    timeseries: [] // Will fill this with integrated timeline if possible
  };

  // If both historical and prediction data are available, try to combine them
  if (historicalStep && predictionStep &&
      combinedResult.historical.length > 0 &&
      combinedResult.prediction.length > 0) {

    try {
      // Assume time dimension for integration
      const historicalData = combinedResult.historical;
      const predictionData = combinedResult.prediction;

      // Find likely time columns
      const historicalColumns = Object.keys(historicalData[0] || {});
      const predictionColumns = Object.keys(predictionData[0] || {});

      // First, look for exact column matches
      const timeCandidates = ['date', 'month', 'year', 'quarter', 'week', 'day', 'time', 'period'];

      let timeColumn = null;

      // Try exact matches first
      for (const candidate of timeCandidates) {
        if (historicalColumns.includes(candidate) && predictionColumns.includes(candidate)) {
          timeColumn = candidate;
          break;
        }
      }

      // If no exact match, try partial matches
      if (!timeColumn) {
        for (const candidate of timeCandidates) {
          const historicalMatch = historicalColumns.find(col =>
            col.toLowerCase().includes(candidate)
          );

          const predictionMatch = predictionColumns.find(col =>
            col.toLowerCase().includes(candidate)
          );

          if (historicalMatch && predictionMatch && historicalMatch === predictionMatch) {
            timeColumn = historicalMatch;
            break;
          }
        }
      }

      // If we found a time column, integrate the datasets
      if (timeColumn) {
        // Merge both datasets
        const allData = [
          ...historicalData.map(row => ({ ...row, dataType: 'historical' })),
          ...predictionData.map(row => ({ ...row, dataType: 'prediction' }))
        ];

        // Sort by time column
        combinedResult.timeseries = _.sortBy(allData, timeColumn);
      }
    } catch (error) {
      console.error('Error integrating historical and prediction data:', error);
      // Leave timeseries array empty if integration fails
    }
  }

  return combinedResult;
}

/**
 * Generic combination for unknown query types
 * @param {Object} resultsById - Map of query results by ID
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Combined dataset with all results
 */
function combineGeneric(resultsById, queryPlan) {
  // Create a combined object with all results keyed by step ID
  const combined = {};

  // Add each result to the combined object
  queryPlan.steps.forEach(step => {
    if (resultsById[step.id]) {
      combined[step.id] = {
        description: step.description,
        outputType: step.outputType,
        data: resultsById[step.id]
      };
    }
  });

  return combined;
}

/**
 * Find a common dimension between two datasets
 * @param {Array} dataset1 - First dataset
 * @param {Array} dataset2 - Second dataset
 * @returns {string|null} Common dimension name or null if none found
 */
function findCommonDimension(dataset1, dataset2) {
  if (!dataset1 || !dataset2 || dataset1.length === 0 || dataset2.length === 0) {
    return null;
  }

  const columns1 = Object.keys(dataset1[0]);
  const columns2 = Object.keys(dataset2[0]);

  // Find common columns
  const commonColumns = columns1.filter(col => columns2.includes(col));

  // If no common columns, return null
  if (commonColumns.length === 0) {
    return null;
  }

  // Prioritize non-numeric columns as they're likely dimensions
  for (const col of commonColumns) {
    const isNumeric1 = !isNaN(dataset1[0][col]);
    const isNumeric2 = !isNaN(dataset2[0][col]);

    if (!isNumeric1 && !isNumeric2) {
      return col;
    }
  }

  // If all common columns are numeric, return the first common column
  return commonColumns[0];
}

/**
 * Find a time dimension in a dataset
 * @param {Array} dataset - Dataset to analyze
 * @returns {string|null} Time dimension name or null if none found
 */
function findTimeDimension(dataset) {
  if (!dataset || dataset.length === 0) {
    return null;
  }

  const columns = Object.keys(dataset[0]);

  // Common time dimension names
  const timeDimensions = [
    'date', 'year', 'month', 'quarter', 'week', 'day', 'time', 'period'
  ];

  // Look for exact matches
  for (const timeDim of timeDimensions) {
    if (columns.includes(timeDim)) {
      return timeDim;
    }
  }

  // Look for partial matches
  for (const timeDim of timeDimensions) {
    const match = columns.find(col => col.toLowerCase().includes(timeDim));
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Extract a period identifier from a description
 * @param {string} description - Step description
 * @returns {string} Period identifier
 */
function extractPeriodIdentifier(description) {
  if (!description) {
    return 'period';
  }

  // Common period patterns
  const periodPatterns = [
    { pattern: /current|this\s+(\w+)/i, replacement: 'current' },
    { pattern: /previous|last\s+(\w+)/i, replacement: 'previous' },
    { pattern: /(\d{4})/i, replacement: '$1' }, // Year like 2023
    { pattern: /Q(\d)/i, replacement: 'Q$1' }, // Quarter like Q1
    { pattern: /(\w+)\s+(\d{4})/i, replacement: '$1_$2' } // Month Year like Jan 2023
  ];

  for (const { pattern, replacement } of periodPatterns) {
    if (pattern.test(description)) {
      const match = description.match(pattern);
      return description.replace(pattern, replacement).replace(/\s+/g, '_').toLowerCase();
    }
  }

  // Fallback
  return description.replace(/\s+/g, '_').toLowerCase().substring(0, 10);
}

/**
 * Extract a dimension name from a description
 * @param {string} description - Step description
 * @returns {string} Dimension name
 */
function extractDimensionName(description) {
  if (!description) {
    return 'dim';
  }

  // Common dimension patterns
  const dimensionPatterns = [
    { pattern: /by\s+(\w+)/i, group: 1 },
    { pattern: /(\w+)\s+dimension/i, group: 1 },
    { pattern: /(\w+)\s+breakdown/i, group: 1 }
  ];

  for (const { pattern, group } of dimensionPatterns) {
    const match = description.match(pattern);
    if (match && match[group]) {
      return match[group].toLowerCase();
    }
  }

  // Fallback
  return 'dimension';
}

/**
 * Transform combined data for visualization
 * @param {Object} combinedData - Data from combineQueryResults
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Data formatted for visualization
 */
function prepareForVisualization(combinedData, queryPlan) {
  // If it's a simple dataset, return it directly
  if (combinedData.type === 'simple') {
    return {
      type: 'single-dataset',
      primaryData: combinedData.data,
      metadata: combinedData.metadata
    };
  }

  // For complex/combined datasets, format based on query type
  const queryType = combinedData.queryType || 'unknown';
  let visualizationData;

  switch (queryType) {
    case 'temporal-comparison':
      visualizationData = prepareTemporalComparisonViz(combinedData.data, queryPlan);
      break;
    case 'multi-dimensional-aggregation':
      visualizationData = prepareMultiDimensionalViz(combinedData.data, queryPlan);
      break;
    case 'trend-and-summary':
      visualizationData = prepareTrendAndSummaryViz(combinedData.data, queryPlan);
      break;
    case 'performers-with-details':
      visualizationData = preparePerformersWithDetailsViz(combinedData.data, queryPlan);
      break;
    case 'historical-prediction':
      visualizationData = prepareHistoricalPredictionViz(combinedData.data, queryPlan);
      break;
    default:
      // Generic preparation for unknown query types
      visualizationData = prepareGenericViz(combinedData.data, queryPlan);
      break;
  }

  return {
    type: queryType,
    ...visualizationData,
    metadata: {
      ...combinedData.metadata,
      queryType
    }
  };
}

/**
 * Prepare temporal comparison data for visualization
 * @param {Array} data - Combined data
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Data formatted for visualization
 */
function prepareTemporalComparisonViz(data, queryPlan) {
  return {
    comparisonData: data,
    visualizationType: 'comparison'
  };
}

/**
 * Prepare multi-dimensional data for visualization
 * @param {Array} data - Combined data
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Data formatted for visualization
 */
function prepareMultiDimensionalViz(data, queryPlan) {
  return {
    primaryData: data,
    visualizationType: 'multi-dimensional'
  };
}

/**
 * Prepare trend and summary data for visualization
 * @param {Object} data - Combined data with trends and summary
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Data formatted for visualization
 */
function prepareTrendAndSummaryViz(data, queryPlan) {
  return {
    trendData: data.trends,
    summaryData: data.summary,
    combinedData: data.combined.length > 0 ? data.combined : null,
    visualizationType: 'trend-summary'
  };
}

/**
 * Prepare performers with details data for visualization
 * @param {Object} data - Combined data with performers and details
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Data formatted for visualization
 */
function preparePerformersWithDetailsViz(data, queryPlan) {
  return {
    performersData: data.performers,
    detailsData: data.details,
    enrichedData: data.combined.length > 0 ? data.combined : null,
    visualizationType: 'performers-details'
  };
}

/**
 * Prepare historical prediction data for visualization
 * @param {Object} data - Combined data with historical and prediction data
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Data formatted for visualization
 */
function prepareHistoricalPredictionViz(data, queryPlan) {
  return {
    historicalData: data.historical,
    predictionData: data.prediction,
    timeseriesData: data.timeseries.length > 0 ? data.timeseries : null,
    visualizationType: 'historical-prediction'
  };
}

/**
 * Prepare generic data for visualization
 * @param {Object} data - Combined data
 * @param {Object} queryPlan - The query execution plan
 * @returns {Object} Data formatted for visualization
 */
function prepareGenericViz(data, queryPlan) {
  // For generic combinations, return all datasets
  if (typeof data === 'object' && !Array.isArray(data)) {
    // It's an object with multiple datasets
    return {
      datasets: data,
      visualizationType: 'multiple'
    };
  }

  // If it's just a single array
  return {
    primaryData: data,
    visualizationType: 'single'
  };
}

module.exports = {
  combineQueryResults,
  prepareForVisualization
};