// modules/dataProcessing/baseAnalysis.js

/**
 * Performs basic statistical analysis on query results
 * Core functionality for data analysis
 */

const _ = require('lodash');

/**
 * Determine the structure of the data for analysis
 * @param {Array|Object} data - Query results
 * @returns {Object} Data structure description
 */
function determineDataStructure(data) {
  // Check if data is array
  if (Array.isArray(data)) {
    return {
      type: 'simple-array',
      rowCount: data.length,
      columnCount: data.length > 0 ? Object.keys(data[0] || {}).length : 0
    };
  }

  // Check if comparison data with multiple periods
  if (data &&
      Array.isArray(data.data) &&
      data.data.length > 0 &&
      Object.keys(data.data[0]).some(key =>
        key.includes('_diff') || key.includes('_pct_change') ||
        key.endsWith('_current') || key.endsWith('_previous') ||
        key.endsWith('_period1') || key.endsWith('_period2')
      )) {
    return {
      type: 'comparison',
      rowCount: data.data.length,
      columnCount: data.data.length > 0 ? Object.keys(data.data[0] || {}).length : 0
    };
  }

  // Check if trend-and-summary structure
  if (data && data.trends && data.summary) {
    return {
      type: 'multi-dataset',
      subType: 'trend-summary',
      datasets: {
        trends: data.trends ? data.trends.length : 0,
        summary: data.summary ? data.summary.length : 0,
        combined: data.combined ? data.combined.length : 0
      }
    };
  }

  // Check if performers-with-details structure
  if (data && data.performers && data.details) {
    return {
      type: 'multi-dataset',
      subType: 'performers-details',
      datasets: {
        performers: data.performers ? data.performers.length : 0,
        details: data.details ? data.details.length : 0,
        combined: data.combined ? data.combined.length : 0
      }
    };
  }

  // Check if historical-prediction structure
  if (data && data.historical && data.prediction) {
    return {
      type: 'multi-dataset',
      subType: 'historical-prediction',
      datasets: {
        historical: data.historical ? data.historical.length : 0,
        prediction: data.prediction ? data.prediction.length : 0,
        timeseries: data.timeseries ? data.timeseries.length : 0
      }
    };
  }

  // Default case - unknown structure
  return {
    type: 'unknown',
    isObject: typeof data === 'object',
    hasProperties: typeof data === 'object' ? Object.keys(data).length : 0
  };
}

/**
 * Analyze simple array data
 * @param {Array} data - Query results as array of records
 * @returns {Object} Analysis results
 */
function analyzeSimpleData(data) {
  if (!data || data.length === 0) {
    return {
      basicStats: {},
      patterns: [],
      insights: []
    };
  }

  // Generate basic statistics
  const basicStats = generateBasicStats(data);

  // Find patterns in the data
  const patterns = identifyPatterns(data);

  // Generate insights
  const insights = generateInsights(data, patterns, basicStats);

  return {
    basicStats,
    patterns,
    insights
  };
}

/**
 * Generate basic statistics for a dataset
 * @param {Array} data - Query results
 * @returns {Object} Basic statistics
 */
function generateBasicStats(data) {
  if (!data || data.length === 0) {
    return {
      rowCount: 0,
      columnCount: 0
    };
  }

  // Get column names
  const columns = Object.keys(data[0]);

  // Initialize statistics object
  const stats = {
    rowCount: data.length,
    columnCount: columns.length,
    columns: {}
  };

  // Analyze each column
  columns.forEach(column => {
    const values = data.map(row => row[column]).filter(val => val != null);

    // Initialize column stats
    stats.columns[column] = {
      valueCount: values.length,
      nullCount: data.length - values.length,
      uniqueCount: new Set(values).size
    };

    // For numeric columns, calculate additional statistics
    if (values.length > 0 && values.every(val => !isNaN(Number(val)))) {
      const numericValues = values.map(val => Number(val));

      // Sort values for percentile calculations
      const sortedValues = [...numericValues].sort((a, b) => a - b);

      // Calculate statistics
      stats.columns[column] = {
        ...stats.columns[column],
        type: 'numeric',
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        sum: numericValues.reduce((sum, val) => sum + val, 0),
        mean: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length,
        median: calculateMedian(sortedValues),
        standardDeviation: calculateStandardDeviation(numericValues),
        percentiles: {
          p25: calculatePercentile(sortedValues, 25),
          p50: calculatePercentile(sortedValues, 50),
          p75: calculatePercentile(sortedValues, 75),
          p90: calculatePercentile(sortedValues, 90)
        }
      };
    }
    // For date columns, calculate date range
    else if (values.length > 0 && values.every(val => isValidDate(val))) {
      const dates = values.map(val => new Date(val));

      stats.columns[column] = {
        ...stats.columns[column],
        type: 'date',
        min: new Date(Math.min(...dates)),
        max: new Date(Math.max(...dates)),
        range: Math.ceil((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)) // in days
      };
    }
    // For categorical columns, calculate frequency distribution
    else if (values.length > 0 && new Set(values).size <= Math.min(10, values.length / 2)) {
      const frequency = {};
      values.forEach(val => {
        frequency[val] = (frequency[val] || 0) + 1;
      });

      // Sort by frequency
      const sortedFrequency = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});

      stats.columns[column] = {
        ...stats.columns[column],
        type: 'categorical',
        frequency: sortedFrequency,
        mostFrequent: Object.keys(sortedFrequency)[0],
        mostFrequentCount: Object.values(sortedFrequency)[0]
      };
    }
    // Default to string type
    else {
      stats.columns[column] = {
        ...stats.columns[column],
        type: 'string',
        avgLength: values.length > 0
          ? values.reduce((sum, val) => sum + String(val).length, 0) / values.length
          : 0,
        minLength: values.length > 0
          ? Math.min(...values.map(val => String(val).length))
          : 0,
        maxLength: values.length > 0
          ? Math.max(...values.map(val => String(val).length))
          : 0
      };
    }
  });

  return stats;
}

/**
 * Identify patterns in a dataset
 * @param {Array} data - Query results
 * @returns {Array} Identified patterns
 */
function identifyPatterns(data) {
  if (!data || data.length === 0) {
    return [];
  }

  const patterns = [];
  const columns = Object.keys(data[0]);

  // Look for time-series patterns
  const timeColumns = columns.filter(col =>
    col.toLowerCase().includes('date') ||
    col.toLowerCase().includes('time') ||
    col.toLowerCase().includes('year') ||
    col.toLowerCase().includes('month') ||
    col.toLowerCase().includes('day')
  );

  if (timeColumns.length > 0) {
    const timeColumn = timeColumns[0];
    patterns.push(...identifyTimeSeriesPatterns(data, timeColumn));
  }

  // Look for correlation patterns between numeric columns
  const numericColumns = columns.filter(col =>
    data.every(row => row[col] !== null && !isNaN(Number(row[col])))
  );

  if (numericColumns.length >= 2) {
    patterns.push(...identifyCorrelations(data, numericColumns));
  }

  // Look for distribution patterns
  numericColumns.forEach(column => {
    patterns.push(...identifyDistributionPatterns(data, column));
  });

  // Look for category patterns
  const categoricalColumns = columns.filter(col =>
    data.every(row => row[col] !== null) &&
    new Set(data.map(row => row[col])).size <= Math.min(10, data.length / 2)
  );

  categoricalColumns.forEach(column => {
    patterns.push(...identifyCategoryPatterns(data, column));
  });

  return patterns;
}

/**
 * Identify time series patterns
 * @param {Array} data - Query results
 * @param {string} timeColumn - Column containing time data
 * @returns {Array} Time series patterns
 */
function identifyTimeSeriesPatterns(data, timeColumn) {
  const patterns = [];

  // Check if we have at least 3 rows for time series analysis
  if (data.length < 3) {
    return patterns;
  }

  // Get numeric columns
  const numericColumns = Object.keys(data[0]).filter(col =>
    col !== timeColumn &&
    data.every(row => row[col] !== null && !isNaN(Number(row[col])))
  );

  // Try to sort by time column if it contains date values
  let sortedData = [...data];
  try {
    if (isValidDate(data[0][timeColumn])) {
      sortedData = [...data].sort((a, b) =>
        new Date(a[timeColumn]) - new Date(b[timeColumn])
      );
    }
  } catch (error) {
    // If sorting fails, use original data
    console.warn(`Failed to sort by time column ${timeColumn}:`, error);
  }

  // Check each numeric column for trends
  numericColumns.forEach(column => {
    // Get values for the column
    const values = sortedData.map(row => Number(row[column]));

    // Calculate differences between consecutive values
    const differences = [];
    for (let i = 1; i < values.length; i++) {
      differences.push(values[i] - values[i - 1]);
    }

    // Check if all differences have the same sign (increasing or decreasing)
    const allPositive = differences.every(diff => diff >= 0);
    const allNegative = differences.every(diff => diff <= 0);

    if (allPositive) {
      patterns.push({
        type: 'trend',
        subType: 'increasing',
        metric: column,
        timeDimension: timeColumn,
        confidence: calculateConfidence(differences, 'trend'),
        description: `${column} shows a consistent increasing trend over ${timeColumn}`
      });
    } else if (allNegative) {
      patterns.push({
        type: 'trend',
        subType: 'decreasing',
        metric: column,
        timeDimension: timeColumn,
        confidence: calculateConfidence(differences, 'trend'),
        description: `${column} shows a consistent decreasing trend over ${timeColumn}`
      });
    }

    // Check for seasonality - simplified version
    if (values.length >= 6) {
      // Check if there's a repeating pattern (very simple version)
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));

      // Check if patterns repeat with some tolerance
      const maxFirstHalf = Math.max(...firstHalf);
      const minFirstHalf = Math.min(...firstHalf);
      const maxSecondHalf = Math.max(...secondHalf);
      const minSecondHalf = Math.min(...secondHalf);

      // If ranges are similar, might indicate seasonality
      if (Math.abs((maxFirstHalf - minFirstHalf) - (maxSecondHalf - minSecondHalf)) / (maxFirstHalf - minFirstHalf) < 0.2) {
        patterns.push({
          type: 'seasonality',
          metric: column,
          timeDimension: timeColumn,
          confidence: 0.6, // Lower confidence for this simplified check
          description: `${column} may show seasonal patterns over ${timeColumn}`
        });
      }
    }
  });

  return patterns;
}

/**
 * Identify correlations between numeric columns
 * @param {Array} data - Query results
 * @param {Array} numericColumns - Columns with numeric data
 * @returns {Array} Correlation patterns
 */
function identifyCorrelations(data, numericColumns) {
  const patterns = [];

  // Need at least 2 numeric columns and 3 rows for correlation
  if (numericColumns.length < 2 || data.length < 3) {
    return patterns;
  }

  // Check pairs of numeric columns for correlation
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const column1 = numericColumns[i];
      const column2 = numericColumns[j];

      // Get values for both columns
      const values1 = data.map(row => Number(row[column1]));
      const values2 = data.map(row => Number(row[column2]));

      // Calculate Pearson correlation coefficient
      const correlation = calculateCorrelation(values1, values2);

      // Add pattern if correlation is strong enough
      if (Math.abs(correlation) >= 0.7) {
        patterns.push({
          type: 'correlation',
          subType: correlation > 0 ? 'positive' : 'negative',
          metrics: [column1, column2],
          strength: Math.abs(correlation),
          description: `Strong ${correlation > 0 ? 'positive' : 'negative'} correlation (${correlation.toFixed(2)}) between ${column1} and ${column2}`
        });
      }
    }
  }

  return patterns;
}

/**
 * Identify distribution patterns in a numeric column
 * @param {Array} data - Query results
 * @param {string} column - Column to analyze
 * @returns {Array} Distribution patterns
 */
function identifyDistributionPatterns(data, column) {
  const patterns = [];

  // Need at least 5 rows for distribution analysis
  if (data.length < 5) {
    return patterns;
  }

  // Get values for the column
  const values = data.map(row => Number(row[column])).filter(val => !isNaN(val));

  // Calculate statistics
  const stats = {
    mean: values.reduce((sum, val) => sum + val, 0) / values.length,
    median: calculateMedian(values.sort((a, b) => a - b)),
    stdDev: calculateStandardDeviation(values)
  };

  // Check for normal distribution
  const skewness = calculateSkewness(values);

  if (Math.abs(skewness) < 0.5) {
    patterns.push({
      type: 'distribution',
      subType: 'normal',
      metric: column,
      skewness,
      description: `${column} appears to be normally distributed (bell curve)`
    });
  } else if (skewness > 0.5) {
    patterns.push({
      type: 'distribution',
      subType: 'right-skewed',
      metric: column,
      skewness,
      description: `${column} has a right-skewed distribution with more values below the mean`
    });
  } else if (skewness < -0.5) {
    patterns.push({
      type: 'distribution',
      subType: 'left-skewed',
      metric: column,
      skewness,
      description: `${column} has a left-skewed distribution with more values above the mean`
    });
  }

  // Check for outliers
  const outliers = findOutliers(values);
  if (outliers.length > 0) {
    patterns.push({
      type: 'outliers',
      metric: column,
      outlierCount: outliers.length,
      outlierPercentage: (outliers.length / values.length) * 100,
      description: `${column} has ${outliers.length} outliers (${((outliers.length / values.length) * 100).toFixed(1)}% of values)`
    });
  }

  return patterns;
}

/**
 * Identify patterns in categorical data
 * @param {Array} data - Query results
 * @param {string} column - Column to analyze
 * @returns {Array} Category patterns
 */
function identifyCategoryPatterns(data, column) {
  const patterns = [];

  // Need at least 5 rows for category analysis
  if (data.length < 5) {
    return patterns;
  }

  // Count occurrences of each category
  const categoryCounts = {};
  data.forEach(row => {
    const category = row[column];
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  // Convert to array for analysis
  const categoryData = Object.entries(categoryCounts).map(([category, count]) => ({
    category,
    count,
    percentage: (count / data.length) * 100
  }));

  // Sort by count (descending)
  categoryData.sort((a, b) => b.count - a.count);

  // Check for dominant category
  if (categoryData[0].percentage > 50) {
    patterns.push({
      type: 'category',
      subType: 'dominant',
      metric: column,
      dominantCategory: categoryData[0].category,
      percentage: categoryData[0].percentage,
      description: `${column} has a dominant category: ${categoryData[0].category} (${categoryData[0].percentage.toFixed(1)}% of data)`
    });
  }

  // Check for Pareto distribution (80/20 rule)
  const sortedCategories = [...categoryData];
  const totalCount = data.length;
  let cumulativeCount = 0;
  let paretoCategories = 0;

  for (const category of sortedCategories) {
    cumulativeCount += category.count;
    paretoCategories++;

    if (cumulativeCount / totalCount >= 0.8) {
      break;
    }
  }

  const paretoPercentage = (paretoCategories / sortedCategories.length) * 100;

  if (paretoPercentage <= 25 && sortedCategories.length >= 4) {
    patterns.push({
      type: 'category',
      subType: 'pareto',
      metric: column,
      paretoCategories,
      totalCategories: sortedCategories.length,
      paretoPercentage,
      description: `${column} shows a Pareto distribution: ${paretoPercentage.toFixed(1)}% of categories account for 80% of data`
    });
  }

  return patterns;
}

/**
 * Generate insights based on data, patterns, and statistics
 * @param {Array} data - Query results
 * @param {Array} patterns - Identified patterns
 * @param {Object} stats - Basic statistics
 * @returns {Array} Generated insights
 */
function generateInsights(data, patterns, stats) {
  const insights = [];

  // Skip if insufficient data
  if (!data || data.length === 0) {
    return insights;
  }

  // Add basic data observation
  insights.push({
    type: 'observation',
    importance: 'low',
    description: `Dataset contains ${data.length} rows and ${Object.keys(data[0]).length} columns.`
  });

  // Generate insights from identified patterns
  patterns.forEach(pattern => {
    switch (pattern.type) {
      case 'trend':
        insights.push({
          type: 'trend',
          importance: 'high',
          description: pattern.description,
          metric: pattern.metric,
          trend: pattern.subType
        });
        break;

      case 'correlation':
        insights.push({
          type: 'correlation',
          importance: 'medium',
          description: pattern.description,
          metrics: pattern.metrics,
          correlationType: pattern.subType,
          strength: pattern.strength
        });
        break;

      case 'distribution':
        insights.push({
          type: 'distribution',
          importance: 'medium',
          description: pattern.description,
          metric: pattern.metric,
          distributionType: pattern.subType
        });
        break;

      case 'outliers':
        insights.push({
          type: 'outliers',
          importance: 'medium',
          description: pattern.description,
          metric: pattern.metric,
          outlierCount: pattern.outlierCount
        });
        break;

      case 'category':
        insights.push({
          type: 'category',
          importance: pattern.subType === 'dominant' ? 'high' : 'medium',
          description: pattern.description,
          metric: pattern.metric,
          categoryPattern: pattern.subType
        });
        break;

      case 'seasonality':
        insights.push({
          type: 'seasonality',
          importance: 'high',
          description: pattern.description,
          metric: pattern.metric,
          timeDimension: pattern.timeDimension
        });
        break;
    }
  });

  // Add insights from statistics
  const numericColumns = Object.entries(stats.columns)
    .filter(([_, details]) => details.type === 'numeric')
    .map(([column, _]) => column);

  // Add top and bottom values for numeric columns
  numericColumns.forEach(column => {
    const columnStats = stats.columns[column];

    // Only add insight if there's significant range
    if (columnStats.max - columnStats.min > 0) {
      insights.push({
        type: 'extremes',
        importance: 'medium',
        description: `${column} ranges from ${columnStats.min} to ${columnStats.max} with an average of ${columnStats.mean.toFixed(2)}`,
        metric: column,
        min: columnStats.min,
        max: columnStats.max,
        mean: columnStats.mean
      });
    }
  });

  // Add categorical insights
  const categoricalColumns = Object.entries(stats.columns)
    .filter(([_, details]) => details.type === 'categorical')
    .map(([column, _]) => column);

  categoricalColumns.forEach(column => {
    const columnStats = stats.columns[column];

    insights.push({
      type: 'frequency',
      importance: 'medium',
      description: `Most frequent value for ${column} is "${columnStats.mostFrequent}" (${((columnStats.mostFrequentCount / data.length) * 100).toFixed(1)}% of data)`,
      metric: column,
      mostFrequent: columnStats.mostFrequent,
      frequency: columnStats.mostFrequentCount,
      percentage: (columnStats.mostFrequentCount / data.length) * 100
    });
  });

  return insights;
}

/**
 * Find outliers in a numeric array using IQR method
 * @param {Array} values - Numeric values
 * @returns {Array} Outliers
 */
function findOutliers(values) {
  if (!values || values.length < 5) {
    return [];
  }

  // Sort values
  const sorted = [...values].sort((a, b) => a - b);

  // Calculate quartiles
  const q1 = calculatePercentile(sorted, 25);
  const q3 = calculatePercentile(sorted, 75);

  // Calculate IQR and bounds
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Find outliers
  return values.filter(val => val < lowerBound || val > upperBound);
}

/**
 * Calculate confidence level for a pattern
 * @param {Array} values - Values to calculate confidence from
 * @param {string} patternType - Type of pattern
 * @returns {number} Confidence level (0-1)
 */
function calculateConfidence(values, patternType) {
  // Default medium confidence
  return 0.7;
}

/**
 * Utility function to calculate median of numeric array
 * @param {Array} values - Numeric values
 * @returns {number} Median value
 */
function calculateMedian(values) {
  if (!values || values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Utility function to calculate percentile
 * @param {Array} sortedValues - Sorted numeric values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
function calculatePercentile(sortedValues, percentile) {
  if (!sortedValues || sortedValues.length === 0) {
    return null;
  }

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

/**
 * Utility function to calculate standard deviation
 * @param {Array} values - Numeric values
 * @returns {number} Standard deviation
 */
function calculateStandardDeviation(values) {
  if (!values || values.length === 0) {
    return null;
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Utility function to calculate skewness of a distribution
 * @param {Array} values - Numeric values
 * @returns {number} Skewness value
 */
function calculateSkewness(values) {
  if (!values || values.length < 3) {
    return 0;
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = calculateStandardDeviation(values);

  if (stdDev === 0) {
    return 0;
  }

  const n = values.length;
  const cubedDiffsSum = values.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0);

  return (n / ((n - 1) * (n - 2))) * (cubedDiffsSum / Math.pow(stdDev, 3));
}

/**
 * Utility function to calculate Pearson correlation coefficient
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

/**
 * Check if a value is a valid date
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a valid date
 */
function isValidDate(value) {
  if (!value) return false;

  // Try to create a date from the value
  const date = new Date(value);

  // Check if date is valid and not equal to "Invalid Date"
  return date instanceof Date && !isNaN(date);
}

module.exports = {
  determineDataStructure,
  analyzeSimpleData,
  generateBasicStats,
  identifyPatterns,
  generateInsights,
  // Utility functions
  calculateMedian,
  calculatePercentile,
  calculateStandardDeviation,
  calculateSkewness,
  calculateCorrelation,
  isValidDate
};