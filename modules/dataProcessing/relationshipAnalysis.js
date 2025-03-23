// modules/dataProcessing/relationshipAnalysis.js

/**
 * Analyzes relationships between multiple datasets
 * Identifies connections, dependencies, and insights that span across related datasets
 */

const _ = require('lodash');
const { isValidDate } = require('./baseAnalysis');

/**
 * Analyze data with multiple datasets
 * @param {Object} data - Multi-dataset data from aggregator
 * @param {Object} queryPlan - The query execution plan
 * @param {string} queryType - Type of query
 * @returns {Object} Analysis results
 */
function analyzeMultiDatasetData(data, queryPlan, queryType) {
  // Skip if not a multi-dataset structure
  if (!data || typeof data !== 'object') {
    return {
      relationships: [],
      insights: []
    };
  }

  // Analyze relationships between datasets
  const relationships = analyzeDatasetRelationships(data, queryType);

  // Generate insights based on relationships
  const insights = generateMultiDatasetInsights(data, relationships);

  return {
    relationships,
    insights
  };
}

/**
 * Analyze relationships between multiple datasets
 * @param {Object} data - Multi-dataset data
 * @param {string} queryType - Type of query
 * @returns {Array} Analysis of dataset relationships
 */
function analyzeDatasetRelationships(data, queryType) {
  const relationships = [];

  // Skip if insufficient data
  if (!data) {
    return relationships;
  }

  // Handle different multi-dataset types
  if (queryType === 'trend-and-summary' ||
      (data.trends && data.summary)) {
    relationships.push(...analyzeTrendSummaryRelationship(data));
  }
  else if (queryType === 'performers-with-details' ||
           (data.performers && data.details)) {
    relationships.push(...analyzePerformersDetailsRelationship(data));
  }
  else if (queryType === 'historical-prediction' ||
           (data.historical && data.prediction)) {
    relationships.push(...analyzeHistoricalPredictionRelationship(data));
  }

  return relationships;
}

/**
 * Analyze relationship between trend and summary data
 * @param {Object} data - Trend and summary datasets
 * @returns {Array} Relationship analysis
 */
function analyzeTrendSummaryRelationship(data) {
  const relationships = [];

  const trends = data.trends || [];
  const summary = data.summary || [];

  if (trends.length === 0 || summary.length === 0) {
    return relationships;
  }

  // Find time dimension in trends
  const trendColumns = Object.keys(trends[0] || {});
  const timeCandidates = ['date', 'month', 'year', 'quarter', 'week', 'day', 'time', 'period'];

  let timeDimension = null;

  // Try to find time dimension
  for (const candidate of timeCandidates) {
    const match = trendColumns.find(col =>
      col.toLowerCase() === candidate || col.toLowerCase().includes(candidate)
    );

    if (match) {
      timeDimension = match;
      break;
    }
  }

  // Find numeric measures in trends
  const numericMeasures = trendColumns.filter(col =>
    col !== timeDimension &&
    trends.every(row => row[col] !== null && !isNaN(Number(row[col])))
  );

  // Find numeric measures in summary
  const summaryColumns = Object.keys(summary[0] || {});

  const summaryMeasures = summaryColumns.filter(col =>
    summary.every(row => row[col] !== null && !isNaN(Number(row[col])))
  );

  // Compare trend totals with summary values
  if (timeDimension && numericMeasures.length > 0 && summaryMeasures.length > 0) {
    numericMeasures.forEach(trendMeasure => {
      // Calculate total from trend data
      const trendTotal = trends.reduce((sum, row) => sum + Number(row[trendMeasure]), 0);

      // Look for matching summary measure
      summaryMeasures.forEach(summaryMeasure => {
        // Simplify names for comparison
        const simpleTrendName = trendMeasure.toLowerCase().replace(/[_-]/g, '');
        const simpleSummaryName = summaryMeasure.toLowerCase().replace(/[_-]/g, '');

        // Check if measures might be related
        if (simpleTrendName.includes(simpleSummaryName) ||
            simpleSummaryName.includes(simpleTrendName) ||
            (simpleTrendName.includes('total') && simpleSummaryName.includes('total'))) {

          // Get summary value (take the first one if multiple)
          const summaryValue = Number(summary[0][summaryMeasure]);

          // Calculate difference
          const diff = Math.abs(trendTotal - summaryValue);
          const pctDiff = trendTotal !== 0 ? (diff / trendTotal) * 100 : null;

          // If values are close, they're likely related
          if (pctDiff !== null && pctDiff < 5) {
            relationships.push({
              type: 'trend-summary-match',
              trendMeasure,
              summaryMeasure,
              trendTotal,
              summaryValue,
              difference: diff,
              percentDifference: pctDiff,
              description: `${trendMeasure} total from trend data (${trendTotal.toFixed(2)}) approximately matches ${summaryMeasure} in summary (${summaryValue.toFixed(2)})`
            });
          }
        }
      });
    });
  }

  // Analyze time range of trend data
  if (timeDimension && trends.length > 1) {
    try {
      // Sort trend data by time dimension
      const sortedTrends = [...trends].sort((a, b) => {
        const aVal = a[timeDimension];
        const bVal = b[timeDimension];

        if (isValidDate(aVal) && isValidDate(bVal)) {
          return new Date(aVal) - new Date(bVal);
        }

        return String(aVal).localeCompare(String(bVal));
      });

      // Get first and last time values
      const firstTime = sortedTrends[0][timeDimension];
      const lastTime = sortedTrends[sortedTrends.length - 1][timeDimension];

      // Format for display
      const firstTimeDisplay = isValidDate(firstTime)
        ? new Date(firstTime).toISOString().split('T')[0]
        : firstTime;

      const lastTimeDisplay = isValidDate(lastTime)
        ? new Date(lastTime).toISOString().split('T')[0]
        : lastTime;

      relationships.push({
        type: 'trend-time-range',
        timeDimension,
        firstTime: firstTimeDisplay,
        lastTime: lastTimeDisplay,
        pointCount: trends.length,
        description: `Trend data spans from ${firstTimeDisplay} to ${lastTimeDisplay} with ${trends.length} data points`
      });
    } catch (error) {
      console.warn('Error analyzing trend time range:', error);
    }
  }

  return relationships;
}

/**
 * Analyze relationship between performers and details data
 * @param {Object} data - Performers and details datasets
 * @returns {Array} Relationship analysis
 */
function analyzePerformersDetailsRelationship(data) {
  const relationships = [];

  const performers = data.performers || [];
  const details = data.details || [];

  if (performers.length === 0 || details.length === 0) {
    return relationships;
  }

  // Find potential join keys between performers and details
  const performerColumns = Object.keys(performers[0] || {});
  const detailColumns = Object.keys(details[0] || {});

  const commonColumns = performerColumns.filter(col => detailColumns.includes(col));

  if (commonColumns.length === 0) {
    return relationships;
  }

  // Use first common column as join key
  const joinKey = commonColumns[0];

  // Count how many performers have matching details
  const performerValues = new Set(performers.map(row => row[joinKey]));
  const detailValues = new Set(details.map(row => row[joinKey]));

  const matchingValues = [...performerValues].filter(val => detailValues.has(val));

  // Calculate match percentage
  const matchPercentage = (matchingValues.length / performerValues.size) * 100;

  relationships.push({
    type: 'performer-detail-coverage',
    joinKey,
    performerCount: performerValues.size,
    matchingCount: matchingValues.length,
    matchPercentage,
    description: `${matchingValues.length} out of ${performerValues.size} performers (${matchPercentage.toFixed(1)}%) have matching detail records`
  });

  // Analyze average number of detail records per performer
  const detailsPerPerformer = {};

  details.forEach(row => {
    const performerValue = row[joinKey];
    detailsPerPerformer[performerValue] = (detailsPerPerformer[performerValue] || 0) + 1;
  });

  const performersWithDetails = Object.keys(detailsPerPerformer);
  const totalDetails = Object.values(detailsPerPerformer).reduce((sum, count) => sum + count, 0);
  const avgDetailsPerPerformer = performersWithDetails.length > 0
    ? totalDetails / performersWithDetails.length
    : 0;

  relationships.push({
    type: 'detail-distribution',
    joinKey,
    totalDetails,
    performersWithDetails: performersWithDetails.length,
    avgDetailsPerPerformer,
    description: `On average, each performer has ${avgDetailsPerPerformer.toFixed(2)} detail records`
  });

  // Check for correlation between performer metrics and detail count
  const performerMetrics = performerColumns.filter(col =>
    col !== joinKey &&
    performers.every(row => !isNaN(Number(row[col])))
  );

  performerMetrics.forEach(metric => {
    try {
      // Create dataset with performer metric and detail count
      const correlationData = performers.map(performer => {
        const performerValue = performer[joinKey];
        const metricValue = Number(performer[metric]);
        const detailCount = detailsPerPerformer[performerValue] || 0;

        return {
          [metric]: metricValue,
          detailCount
        };
      });

      // Calculate correlation between metric and detail count
      const correlation = calculateCorrelation(
        correlationData.map(row => row[metric]),
        correlationData.map(row => row.detailCount)
      );

      // Only add if correlation is significant
      if (Math.abs(correlation) >= 0.5) {
        relationships.push({
          type: 'metric-detail-correlation',
          metric,
          correlation,
          direction: correlation > 0 ? 'positive' : 'negative',
          description: `${correlation > 0 ? 'Positive' : 'Negative'} correlation (${correlation.toFixed(2)}) between ${metric} and the number of detail records`
        });
      }
    } catch (error) {
      console.warn(`Error calculating correlation for ${metric}:`, error);
    }
  });

  return relationships;
}

/**
 * Analyze relationship between historical and prediction data
 * @param {Object} data - Historical and prediction datasets
 * @returns {Array} Relationship analysis
 */
function analyzeHistoricalPredictionRelationship(data) {
  const relationships = [];

  const historical = data.historical || [];
  const prediction = data.prediction || [];

  if (historical.length === 0 || prediction.length === 0) {
    return relationships;
  }

  // Find time dimensions in both datasets
  const historicalColumns = Object.keys(historical[0] || {});
  const predictionColumns = Object.keys(prediction[0] || {});

  const timeCandidates = ['date', 'month', 'year', 'quarter', 'week', 'day', 'time', 'period'];

  let historicalTimeDim = null;
  let predictionTimeDim = null;

  // Try to find time dimensions
  for (const candidate of timeCandidates) {
    const historicalMatch = historicalColumns.find(col =>
      col.toLowerCase() === candidate || col.toLowerCase().includes(candidate)
    );

    if (historicalMatch) {
      historicalTimeDim = historicalMatch;
    }

    const predictionMatch = predictionColumns.find(col =>
      col.toLowerCase() === candidate || col.toLowerCase().includes(candidate)
    );

    if (predictionMatch) {
      predictionTimeDim = predictionMatch;
    }

    if (historicalTimeDim && predictionTimeDim) {
      break;
    }
  }

  // If no time dimensions found, try common columns
  if (!historicalTimeDim || !predictionTimeDim) {
    const commonColumns = historicalColumns.filter(col => predictionColumns.includes(col));

    if (commonColumns.length > 0) {
      historicalTimeDim = predictionTimeDim = commonColumns[0];
    }
  }

  // If we have time dimensions, analyze time continuity
  if (historicalTimeDim && predictionTimeDim) {
    // Check if historical and prediction time periods are adjacent
    try {
      // Sort datasets by time
      const sortedHistorical = [...historical].sort((a, b) => {
        const aVal = a[historicalTimeDim];
        const bVal = b[historicalTimeDim];

        if (isValidDate(aVal) && isValidDate(bVal)) {
          return new Date(aVal) - new Date(bVal);
        }

        return String(aVal).localeCompare(String(bVal));
      });

      const sortedPrediction = [...prediction].sort((a, b) => {
        const aVal = a[predictionTimeDim];
        const bVal = b[predictionTimeDim];

        if (isValidDate(aVal) && isValidDate(bVal)) {
          return new Date(aVal) - new Date(bVal);
        }

        return String(aVal).localeCompare(String(bVal));
      });

      // Get last historical time and first prediction time
      const lastHistoricalTime = sortedHistorical[sortedHistorical.length - 1][historicalTimeDim];
      const firstPredictionTime = sortedPrediction[0][predictionTimeDim];

      // Format for display
      const lastHistoricalDisplay = isValidDate(lastHistoricalTime)
        ? new Date(lastHistoricalTime).toISOString().split('T')[0]
        : lastHistoricalTime;

      const firstPredictionDisplay = isValidDate(firstPredictionTime)
        ? new Date(firstPredictionTime).toISOString().split('T')[0]
        : firstPredictionTime;

      // Check if they're adjacent or if prediction starts after historical
      let continuity = "unknown";

      if (isValidDate(lastHistoricalTime) && isValidDate(firstPredictionTime)) {
        const lastHistDate = new Date(lastHistoricalTime);
        const firstPredDate = new Date(firstPredictionTime);

        if (firstPredDate > lastHistDate) {
          continuity = "continuous";
        } else {
          continuity = "overlapping";
        }
      } else if (lastHistoricalTime !== firstPredictionTime) {
        continuity = "gapped";
      }

      relationships.push({
        type: 'historical-prediction-continuity',
        historicalTimeDimension: historicalTimeDim,
        predictionTimeDimension: predictionTimeDim,
        lastHistoricalTime: lastHistoricalDisplay,
        firstPredictionTime: firstPredictionDisplay,
        continuity,
        description: `Historical data ends at ${lastHistoricalDisplay} and prediction data starts at ${firstPredictionDisplay}`
      });
    } catch (error) {
      console.warn('Error analyzing time continuity:', error);
    }
  }

  // Find common measures to compare historical and prediction end points
  const historicalNumericCols = historicalColumns.filter(col =>
    col !== historicalTimeDim &&
    historical.every(row => row[col] !== null && !isNaN(Number(row[col])))
  );

  const predictionNumericCols = predictionColumns.filter(col =>
    col !== predictionTimeDim &&
    prediction.every(row => row[col] !== null && !isNaN(Number(row[col])))
  );

  // Find measures that match by name
  const commonMeasures = [];

  historicalNumericCols.forEach(histCol => {
    const simpleHistName = histCol.toLowerCase().replace(/[_-]/g, '');

    predictionNumericCols.forEach(predCol => {
      const simplePredName = predCol.toLowerCase().replace(/[_-]/g, '');

      if (simpleHistName === simplePredName ||
          simpleHistName.includes(simplePredName) ||
          simplePredName.includes(simpleHistName)) {
        commonMeasures.push({
          historicalColumn: histCol,
          predictionColumn: predCol
        });
      }
    });
  });

  // Compare last historical value with first prediction value for common measures
  if (commonMeasures.length > 0 && historical.length > 0 && prediction.length > 0) {
    try {
      // Sort datasets by time
      const sortedHistorical = [...historical].sort((a, b) => {
        const aVal = a[historicalTimeDim];
        const bVal = b[historicalTimeDim];

        if (isValidDate(aVal) && isValidDate(bVal)) {
          return new Date(aVal) - new Date(bVal);
        }

        return String(aVal).localeCompare(String(bVal));
      });

      const sortedPrediction = [...prediction].sort((a, b) => {
        const aVal = a[predictionTimeDim];
        const bVal = b[predictionTimeDim];

        if (isValidDate(aVal) && isValidDate(bVal)) {
          return new Date(aVal) - new Date(bVal);
        }

        return String(aVal).localeCompare(String(bVal));
      });

      // Get last historical row and first prediction row
      const lastHistoricalRow = sortedHistorical[sortedHistorical.length - 1];
      const firstPredictionRow = sortedPrediction[0];

      // Compare common measures
      commonMeasures.forEach(({ historicalColumn, predictionColumn }) => {
        const lastHistValue = Number(lastHistoricalRow[historicalColumn]);
        const firstPredValue = Number(firstPredictionRow[predictionColumn]);

        const absDiff = Math.abs(firstPredValue - lastHistValue);
        const pctDiff = lastHistValue !== 0 ? (absDiff / Math.abs(lastHistValue)) * 100 : null;

        relationships.push({
          type: 'historical-prediction-transition',
          historicalMeasure: historicalColumn,
          predictionMeasure: predictionColumn,
          lastHistoricalValue: lastHistValue,
          firstPredictionValue: firstPredValue,
          absoluteDifference: absDiff,
          percentageDifference: pctDiff,
          description: `${historicalColumn} transitions from ${lastHistValue.toFixed(2)} (historical) to ${firstPredValue.toFixed(2)} (prediction) with ${pctDiff !== null ? pctDiff.toFixed(2) + '%' : 'N/A'} change`
        });
      });
    } catch (error) {
      console.warn('Error analyzing measure transitions:', error);
    }
  }

  // Analyze prediction accuracy if timeseries with both historical and prediction data
  if (data.timeseries && data.timeseries.length > 0) {
    try {
      const timeseries = data.timeseries;
      const timeseriesColumns = Object.keys(timeseries[0] || {});

      // Find dataType column indicating historical vs prediction
      const typeColumn = timeseriesColumns.find(col =>
        col === 'dataType' || col === 'type' || col === 'source'
      );

      if (typeColumn) {
        // Find common numeric measures
        const numericMeasures = timeseriesColumns.filter(col =>
          col !== typeColumn &&
          col !== historicalTimeDim &&
          col !== predictionTimeDim &&
          timeseries.every(row => row[col] !== null && !isNaN(Number(row[col])))
        );

        // Find overlapping time periods
        const historicalRows = timeseries.filter(row => row[typeColumn] === 'historical');
        const predictionRows = timeseries.filter(row => row[typeColumn] === 'prediction');

        const historicalTimes = new Set(historicalRows.map(row =>
          row[historicalTimeDim] || row[predictionTimeDim]
        ));

        const predictionTimes = new Set(predictionRows.map(row =>
          row[predictionTimeDim] || row[historicalTimeDim]
        ));

        const overlappingTimes = [...historicalTimes].filter(time => predictionTimes.has(time));

        if (overlappingTimes.length > 0) {
          // Create pairs of historical and prediction rows for same time
          const comparisonPairs = [];

          overlappingTimes.forEach(time => {
            const historicalRow = historicalRows.find(row =>
              (row[historicalTimeDim] || row[predictionTimeDim]) === time
            );

            const predictionRow = predictionRows.find(row =>
              (row[predictionTimeDim] || row[historicalTimeDim]) === time
            );

            if (historicalRow && predictionRow) {
              comparisonPairs.push({
                time,
                historical: historicalRow,
                prediction: predictionRow
              });
            }
          });

          // Calculate prediction accuracy for each measure
          numericMeasures.forEach(measure => {
            // Calculate mean absolute percentage error (MAPE)
            const errors = comparisonPairs.map(pair => {
              const actual = Number(pair.historical[measure]);
              const predicted = Number(pair.prediction[measure]);

              if (actual === 0) return null; // Avoid division by zero

              return Math.abs((actual - predicted) / actual) * 100;
            }).filter(error => error !== null);

            if (errors.length > 0) {
              const mape = errors.reduce((sum, error) => sum + error, 0) / errors.length;

              relationships.push({
                type: 'prediction-accuracy',
                measure,
                mape,
                comparePoints: errors.length,
                description: `Prediction accuracy for ${measure}: MAPE of ${mape.toFixed(2)}% across ${errors.length} comparison points`
              });
            }
          });
        }
      }
    } catch (error) {
      console.warn('Error analyzing prediction accuracy:', error);
    }
  }

  return relationships;
}

/**
 * Generate insights from multi-dataset analysis
 * @param {Object} data - Multi-dataset data
 * @param {Array} relationships - Dataset relationship analyses
 * @returns {Array} Generated insights
 */
function generateMultiDatasetInsights(data, relationships) {
  const insights = [];

  // Add basic observation
  insights.push({
    type: 'observation',
    importance: 'low',
    description: `Analysis includes multiple related datasets.`
  });

  // Generate insights from relationships
  relationships.forEach(relationship => {
    switch (relationship.type) {
      case 'trend-summary-match':
        insights.push({
          type: 'data-consistency',
          importance: 'medium',
          description: relationship.description,
          measures: [relationship.trendMeasure, relationship.summaryMeasure],
          percentDifference: relationship.percentDifference
        });
        break;

      case 'trend-time-range':
        insights.push({
          type: 'time-coverage',
          importance: 'medium',
          description: relationship.description,
          timeDimension: relationship.timeDimension,
          range: [relationship.firstTime, relationship.lastTime]
        });
        break;

      case 'performer-detail-coverage':
        insights.push({
          type: 'data-coverage',
          importance: 'medium',
          description: relationship.description,
          joinKey: relationship.joinKey,
          coverage: relationship.matchPercentage
        });
        break;

      case 'detail-distribution':
        insights.push({
          type: 'data-distribution',
          importance: 'low',
          description: relationship.description,
          average: relationship.avgDetailsPerPerformer
        });
        break;

      case 'metric-detail-correlation':
        insights.push({
          type: 'correlation',
          importance: 'medium',
          description: relationship.description,
          metric: relationship.metric,
          correlationType: relationship.direction,
          strength: Math.abs(relationship.correlation)
        });
        break;

      case 'historical-prediction-continuity':
        insights.push({
          type: 'time-continuity',
          importance: 'high',
          description: relationship.description,
          continuity: relationship.continuity,
          periods: [relationship.lastHistoricalTime, relationship.firstPredictionTime]
        });
        break;

      case 'historical-prediction-transition':
        insights.push({
          type: 'measure-transition',
          importance: 'high',
          description: relationship.description,
          measures: [relationship.historicalMeasure, relationship.predictionMeasure],
          percentageDifference: relationship.percentageDifference
        });
        break;

      case 'prediction-accuracy':
        insights.push({
          type: 'accuracy-assessment',
          importance: 'high',
          description: relationship.description,
          measure: relationship.measure,
          mape: relationship.mape
        });
        break;
    }
  });

  // Add insights specific to certain dataset combinations

  // For trend and summary data
  if (data.trends && data.summary) {
    // Check if there's a clear trend direction
    const trendDirectionInsight = identifyTrendDirection(data.trends);
    if (trendDirectionInsight) {
      insights.push(trendDirectionInsight);
    }
  }

  // For performers and details data
  if (data.performers && data.details) {
    // Identify if top performers have more/less details than average
    const topPerformerDetailInsight = analyzeTopPerformerDetails(data.performers, data.details);
    if (topPerformerDetailInsight) {
      insights.push(topPerformerDetailInsight);
    }
  }

  // For historical and prediction data
  if (data.historical && data.prediction) {
    // Compare overall trend direction between historical and prediction
    const trendComparisonInsight = compareHistoricalPredictionTrends(data.historical, data.prediction);
    if (trendComparisonInsight) {
      insights.push(trendComparisonInsight);
    }
  }

  return insights;
}

/**
 * Identify overall trend direction in trend data
 * @param {Array} trends - Trend data
 * @returns {Object|null} Trend direction insight or null if no clear trend
 */
function identifyTrendDirection(trends) {
  if (!trends || trends.length < 3) {
    return null;
  }

  try {
    // Find time dimension
    const columns = Object.keys(trends[0] || {});
    const timeCandidates = ['date', 'month', 'year', 'quarter', 'week', 'day', 'time', 'period'];

    let timeDimension = null;

    // Try to find time dimension
    for (const candidate of timeCandidates) {
      const match = columns.find(col =>
        col.toLowerCase() === candidate || col.toLowerCase().includes(candidate)
      );

      if (match) {
        timeDimension = match;
        break;
      }
    }

    if (!timeDimension) {
      return null;
    }

    // Sort by time dimension
    const sortedTrends = [...trends].sort((a, b) => {
      const aVal = a[timeDimension];
      const bVal = b[timeDimension];

      if (isValidDate(aVal) && isValidDate(bVal)) {
        return new Date(aVal) - new Date(bVal);
      }

      return String(aVal).localeCompare(String(bVal));
    });

    // Find numeric measures
    const numericMeasures = columns.filter(col =>
      col !== timeDimension &&
      trends.every(row => row[col] !== null && !isNaN(Number(row[col])))
    );

    if (numericMeasures.length === 0) {
      return null;
    }

    // Analyze primary measure (first numeric column)
    const primaryMeasure = numericMeasures[0];

    // Extract values
    const values = sortedTrends.map(row => Number(row[primaryMeasure]));

    // Calculate differences between start and end
    const firstValue = values[0];
    const lastValue = values[values.length - 1];

    const absoluteChange = lastValue - firstValue;
    const percentChange = firstValue !== 0 ? (absoluteChange / firstValue) * 100 : null;

    // Check if there's a clear trend
    if (percentChange === null) {
      return null;
    }

    if (Math.abs(percentChange) < 5) {
      return {
        type: 'trend-direction',
        importance: 'medium',
        description: `${primaryMeasure} shows relatively stable trend over time (${percentChange.toFixed(1)}% overall change)`,
        measure: primaryMeasure,
        direction: 'stable',
        percentChange
      };
    } else if (percentChange > 0) {
      return {
        type: 'trend-direction',
        importance: 'high',
        description: `${primaryMeasure} shows an increasing trend over time (${percentChange.toFixed(1)}% overall growth)`,
        measure: primaryMeasure,
        direction: 'increasing',
        percentChange
      };
    } else {
      return {
        type: 'trend-direction',
        importance: 'high',
        description: `${primaryMeasure} shows a decreasing trend over time (${Math.abs(percentChange).toFixed(1)}% overall decline)`,
        measure: primaryMeasure,
        direction: 'decreasing',
        percentChange
      };
    }
  } catch (error) {
    console.warn('Error identifying trend direction:', error);
    return null;
  }
}

/**
 * Analyze if top performers have more or fewer details than average
 * @param {Array} performers - Performers data
 * @param {Array} details - Details data
 * @returns {Object|null} Top performer detail insight or null if analysis not possible
 */
function analyzeTopPerformerDetails(performers, details) {
  if (!performers || !details || performers.length === 0 || details.length === 0) {
    return null;
  }

  try {
    // Find potential join keys between performers and details
    const performerColumns = Object.keys(performers[0] || {});
    const detailColumns = Object.keys(details[0] || {});

    const commonColumns = performerColumns.filter(col => detailColumns.includes(col));

    if (commonColumns.length === 0) {
      return null;
    }

    // Use first common column as join key
    const joinKey = commonColumns[0];

    // Find numeric metric column in performers
    const metricColumns = performerColumns.filter(col =>
      col !== joinKey &&
      performers.every(row => row[col] !== null && !isNaN(Number(row[col])))
    );

    if (metricColumns.length === 0) {
      return null;
    }

    // Use first metric column for ranking
    const metricColumn = metricColumns[0];

    // Sort performers by metric (descending)
    const sortedPerformers = [...performers].sort((a, b) =>
      Number(b[metricColumn]) - Number(a[metricColumn])
    );

    // Take top 20% or at least 3 performers
    const topCount = Math.max(3, Math.ceil(performers.length * 0.2));
    const topPerformers = sortedPerformers.slice(0, topCount);

    // Count details per performer
    const detailsPerPerformer = {};

    details.forEach(row => {
      const performerValue = row[joinKey];
      detailsPerPerformer[performerValue] = (detailsPerPerformer[performerValue] || 0) + 1;
    });

    // Calculate average details for all performers
    const allPerformerIds = performers.map(row => row[joinKey]);
    const allDetailCounts = allPerformerIds.map(id => detailsPerPerformer[id] || 0);
    const avgDetailsAll = allDetailCounts.reduce((sum, count) => sum + count, 0) / allPerformerIds.length;

    // Calculate average details for top performers
    const topPerformerIds = topPerformers.map(row => row[joinKey]);
    const topDetailCounts = topPerformerIds.map(id => detailsPerPerformer[id] || 0);
    const avgDetailsTop = topDetailCounts.reduce((sum, count) => sum + count, 0) / topPerformerIds.length;

    // Compare averages
    const ratio = avgDetailsTop / avgDetailsAll;

    if (Math.abs(ratio - 1) < 0.1) {
      return {
        type: 'top-performer-detail-distribution',
        importance: 'low',
        description: `Top performers have a similar number of detail records (${avgDetailsTop.toFixed(1)}) compared to the average (${avgDetailsAll.toFixed(1)})`,
        joinKey,
        topPerformerAvg: avgDetailsTop,
        overallAvg: avgDetailsAll,
        ratio
      };
    } else if (ratio > 1) {
      return {
        type: 'top-performer-detail-distribution',
        importance: 'medium',
        description: `Top performers have ${ratio.toFixed(1)}x more detail records (${avgDetailsTop.toFixed(1)}) than the average (${avgDetailsAll.toFixed(1)})`,
        joinKey,
        topPerformerAvg: avgDetailsTop,
        overallAvg: avgDetailsAll,
        ratio
      };
    } else {
      return {
        type: 'top-performer-detail-distribution',
        importance: 'medium',
        description: `Top performers have ${(1/ratio).toFixed(1)}x fewer detail records (${avgDetailsTop.toFixed(1)}) than the average (${avgDetailsAll.toFixed(1)})`,
        joinKey,
        topPerformerAvg: avgDetailsTop,
        overallAvg: avgDetailsAll,
        ratio
      };
    }
  } catch (error) {
    console.warn('Error analyzing top performer details:', error);
    return null;
  }
}

/**
 * Compare trend directions between historical and prediction data
 * @param {Array} historical - Historical data
 * @param {Array} prediction - Prediction data
 * @returns {Object|null} Trend comparison insight or null if analysis not possible
 */
function compareHistoricalPredictionTrends(historical, prediction) {
  if (!historical || !prediction || historical.length < 3 || prediction.length < 3) {
    return null;
  }

  try {
    // Find time dimensions
    const historicalColumns = Object.keys(historical[0] || {});
    const predictionColumns = Object.keys(prediction[0] || {});

    const timeCandidates = ['date', 'month', 'year', 'quarter', 'week', 'day', 'time', 'period'];

    let historicalTimeDim = null;
    let predictionTimeDim = null;

    // Find time dimensions
    for (const candidate of timeCandidates) {
      const historicalMatch = historicalColumns.find(col =>
        col.toLowerCase() === candidate || col.toLowerCase().includes(candidate)
      );

      if (historicalMatch) {
        historicalTimeDim = historicalMatch;
      }

      const predictionMatch = predictionColumns.find(col =>
        col.toLowerCase() === candidate || col.toLowerCase().includes(candidate)
      );

      if (predictionMatch) {
        predictionTimeDim = predictionMatch;
      }

      if (historicalTimeDim && predictionTimeDim) {
        break;
      }
    }

    if (!historicalTimeDim || !predictionTimeDim) {
      return null;
    }

    // Find common numeric measures
    const historicalNumericCols = historicalColumns.filter(col =>
      col !== historicalTimeDim &&
      historical.every(row => row[col] !== null && !isNaN(Number(row[col])))
    );

    const predictionNumericCols = predictionColumns.filter(col =>
      col !== predictionTimeDim &&
      prediction.every(row => row[col] !== null && !isNaN(Number(row[col])))
    );

    // Find measures that match by name
    const commonMeasures = [];

    historicalNumericCols.forEach(histCol => {
      const simpleHistName = histCol.toLowerCase().replace(/[_-]/g, '');

      predictionNumericCols.forEach(predCol => {
        const simplePredName = predCol.toLowerCase().replace(/[_-]/g, '');

        if (simpleHistName === simplePredName ||
            simpleHistName.includes(simplePredName) ||
            simplePredName.includes(simpleHistName)) {
          commonMeasures.push({
            historicalColumn: histCol,
            predictionColumn: predCol
          });
        }
      });
    });

    if (commonMeasures.length === 0) {
      return null;
    }

    // Use first common measure for trend analysis
    const { historicalColumn, predictionColumn } = commonMeasures[0];

    // Sort both datasets by time
    const sortedHistorical = [...historical].sort((a, b) => {
      const aVal = a[historicalTimeDim];
      const bVal = b[historicalTimeDim];

      if (isValidDate(aVal) && isValidDate(bVal)) {
        return new Date(aVal) - new Date(bVal);
      }

      return String(aVal).localeCompare(String(bVal));
    });

    const sortedPrediction = [...prediction].sort((a, b) => {
      const aVal = a[predictionTimeDim];
      const bVal = b[predictionTimeDim];

      if (isValidDate(aVal) && isValidDate(bVal)) {
        return new Date(aVal) - new Date(bVal);
      }

      return String(aVal).localeCompare(String(bVal));
    });

    // Get first and last values from both datasets
    const firstHistValue = Number(sortedHistorical[0][historicalColumn]);
    const lastHistValue = Number(sortedHistorical[sortedHistorical.length - 1][historicalColumn]);

    const firstPredValue = Number(sortedPrediction[0][predictionColumn]);
    const lastPredValue = Number(sortedPrediction[sortedPrediction.length - 1][predictionColumn]);

    // Calculate trends
    const histChange = lastHistValue - firstHistValue;
    const predChange = lastPredValue - firstPredValue;

    const histPctChange = firstHistValue !== 0 ? (histChange / firstHistValue) * 100 : null;
    const predPctChange = firstPredValue !== 0 ? (predChange / firstPredValue) * 100 : null;

    // Skip if we can't calculate percentage changes
    if (histPctChange === null || predPctChange === null) {
      return null;
    }

    // Compare trend directions
    const histDirection = histPctChange > 0 ? 'increasing' : (histPctChange < 0 ? 'decreasing' : 'stable');
    const predDirection = predPctChange > 0 ? 'increasing' : (predPctChange < 0 ? 'decreasing' : 'stable');

    const histStrength = Math.abs(histPctChange) < 5 ? 'slight' : (Math.abs(histPctChange) < 20 ? 'moderate' : 'strong');
    const predStrength = Math.abs(predPctChange) < 5 ? 'slight' : (Math.abs(predPctChange) < 20 ? 'moderate' : 'strong');

    // Create appropriate insight based on trend comparison
    if (histDirection === predDirection) {
      return {
        type: 'trend-continuation',
        importance: 'high',
        description: `Prediction continues the ${histStrength} ${histDirection} historical trend (historical: ${histPctChange.toFixed(1)}%, prediction: ${predPctChange.toFixed(1)}%)`,
        historicalMeasure: historicalColumn,
        predictionMeasure: predictionColumn,
        historicalChange: histPctChange,
        predictionChange: predPctChange,
        continuity: 'same-direction'
      };
    } else {
      return {
        type: 'trend-reversal',
        importance: 'high',
        description: `Prediction shows a trend reversal from ${histStrength} ${histDirection} (${histPctChange.toFixed(1)}%) to ${predStrength} ${predDirection} (${predPctChange.toFixed(1)}%)`,
        historicalMeasure: historicalColumn,
        predictionMeasure: predictionColumn,
        historicalChange: histPctChange,
        predictionChange: predPctChange,
        continuity: 'reversal'
      };
    }
  } catch (error) {
    console.warn('Error comparing historical and prediction trends:', error);
    return null;
  }
}

/**
 * Calculate Pearson correlation coefficient
 * @param {Array} values1 - First set of values
 * @param {Array} values2 - Second set of values
 * @returns {number} Correlation coefficient (-1 to 1)
 */
function calculateCorrelation(values1, values2) {
  if (!values1 || !values2 || values1.length !== values2.length || values1.length < 3) {
    return 0;
  }

  const n = values1.length;

  // Calculate means
  const mean1 = values1.reduce((sum, val) => sum + val, 0) / n;
  const mean2 = values2.reduce((sum, val) => sum + val, 0) / n;

  // Calculate variances and covariance
  let variance1 = 0;
  let variance2 = 0;
  let covariance = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = values1[i] - mean1;
    const diff2 = values2[i] - mean2;

    variance1 += diff1 * diff1;
    variance2 += diff2 * diff2;
    covariance += diff1 * diff2;
  }

  // Avoid division by zero
  if (variance1 === 0 || variance2 === 0) {
    return 0;
  }

  return covariance / (Math.sqrt(variance1) * Math.sqrt(variance2));
}

module.exports = {
  analyzeMultiDatasetData,
  analyzeDatasetRelationships,
  generateMultiDatasetInsights
};