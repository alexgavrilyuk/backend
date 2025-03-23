// modules/dataProcessing/comparisonAnalysis.js

/**
 * Performs analysis on comparison data with multiple time periods
 * Specialized analysis for complex queries that compare different time periods
 */

const _ = require('lodash');
const { calculateMedian, calculatePercentile, isValidDate } = require('./baseAnalysis');

/**
 * Analyze comparison data with multiple periods
 * @param {Object} data - Comparison data from aggregator
 * @param {Object} queryPlan - The query execution plan
 * @param {string} queryType - Type of query
 * @returns {Object} Analysis results
 */
function analyzeComparisonData(data, queryPlan, queryType) {
  // Extract the actual data array
  const actualData = data.data || data;

  if (!Array.isArray(actualData) || actualData.length === 0) {
    return {
      comparisons: [],
      insights: []
    };
  }

  // Analyze comparisons between periods
  const comparisons = analyzeComparisons(actualData);

  // Generate insights based on comparisons
  const insights = generateComparisonInsights(actualData, comparisons);

  return {
    comparisons,
    insights
  };
}

/**
 * Analyze period-to-period comparisons
 * @param {Array} data - Comparison data with period columns
 * @returns {Array} Comparison analysis results
 */
function analyzeComparisons(data) {
  const comparisons = [];

  // Skip if insufficient data
  if (!data || data.length === 0) {
    return comparisons;
  }

  // Find comparison column pairs (e.g., value_period1, value_period2)
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  // Find dimension columns (non-comparison columns)
  const diffColumns = columns.filter(col => col.includes('_diff'));
  const pctColumns = columns.filter(col => col.includes('_pct_change'));

  // Find period column pairs
  const periodPairs = [];

  // Look for explicit column pairs (e.g., sales_2022, sales_2023)
  columns.forEach(col1 => {
    if (col1.includes('_')) {
      const parts = col1.split('_');
      const base = parts.slice(0, -1).join('_');
      const period1 = parts[parts.length - 1];

      columns.forEach(col2 => {
        if (col2 !== col1 && col2.includes(base + '_')) {
          const parts2 = col2.split('_');
          const period2 = parts2[parts2.length - 1];

          if (period1 !== period2) {
            periodPairs.push({
              base,
              period1,
              period2,
              col1,
              col2
            });
          }
        }
      });
    }
  });

  // Analyze each detected comparison
  periodPairs.forEach(pair => {
    // Get comparison values
    const values1 = data.map(row => Number(row[pair.col1])).filter(val => !isNaN(val));
    const values2 = data.map(row => Number(row[pair.col2])).filter(val => !isNaN(val));

    // Skip if insufficient data
    if (values1.length === 0 || values2.length === 0) {
      return;
    }

    // Calculate aggregate comparison
    const sum1 = values1.reduce((sum, val) => sum + val, 0);
    const sum2 = values2.reduce((sum, val) => sum + val, 0);

    const percentChange = sum1 !== 0 ? ((sum2 - sum1) / sum1) * 100 : null;

    comparisons.push({
      type: 'period-comparison',
      base: pair.base,
      period1: pair.period1,
      period2: pair.period2,
      sum1,
      sum2,
      absoluteChange: sum2 - sum1,
      percentChange,
      description: `${pair.base} ${percentChange !== null ? (percentChange >= 0 ? 'increased' : 'decreased') : 'changed'} by ${percentChange !== null ? Math.abs(percentChange).toFixed(2) + '%' : 'N/A'} from ${pair.period1} to ${pair.period2}`
    });
  });

  // Also analyze specific diff columns if available
  diffColumns.forEach(diffCol => {
    // Try to extract the base metric name
    const baseMetric = diffCol.replace('_diff', '');

    // Get diff values
    const diffValues = data.map(row => Number(row[diffCol])).filter(val => !isNaN(val));

    // Skip if insufficient data
    if (diffValues.length === 0) {
      return;
    }

    // Calculate stats on diffs
    const sumDiff = diffValues.reduce((sum, val) => sum + val, 0);
    const avgDiff = sumDiff / diffValues.length;
    const positiveDiffs = diffValues.filter(val => val > 0).length;
    const negativeDiffs = diffValues.filter(val => val < 0).length;

    comparisons.push({
      type: 'diff-analysis',
      metric: baseMetric,
      totalDiff: sumDiff,
      averageDiff: avgDiff,
      positiveDiffCount: positiveDiffs,
      negativeDiffCount: negativeDiffs,
      description: `${baseMetric} shows an average change of ${avgDiff.toFixed(2)} with ${positiveDiffs} increases and ${negativeDiffs} decreases`
    });
  });

  // Analyze percentage change columns
  pctColumns.forEach(pctCol => {
    // Try to extract the base metric name
    const baseMetric = pctCol.replace('_pct_change', '');

    // Get percentage change values
    const pctValues = data.map(row => Number(row[pctCol])).filter(val => !isNaN(val));

    // Skip if insufficient data
    if (pctValues.length === 0) {
      return;
    }

    // Calculate stats on percentage changes
    const avgPct = pctValues.reduce((sum, val) => sum + val, 0) / pctValues.length;
    const positivePcts = pctValues.filter(val => val > 0).length;
    const negativePcts = pctValues.filter(val => val < 0).length;

    comparisons.push({
      type: 'pct-analysis',
      metric: baseMetric,
      averagePctChange: avgPct,
      positivePctCount: positivePcts,
      negativePctCount: negativePcts,
      description: `${baseMetric} shows an average percentage change of ${avgPct.toFixed(2)}% with ${positivePcts} increases and ${negativePcts} decreases`
    });
  });

  return comparisons;
}

/**
 * Analyze growth categories in comparison data
 * @param {Array} data - Comparison data
 * @returns {Array} Growth category analysis results
 */
function analyzeGrowthCategories(data) {
  const growthAnalysis = [];

  // Skip if insufficient data
  if (!data || data.length === 0) {
    return growthAnalysis;
  }

  // Find columns with percentage changes
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  const pctColumns = columns.filter(col => col.includes('_pct_change'));

  // Skip if no percentage change columns
  if (pctColumns.length === 0) {
    return growthAnalysis;
  }

  // Use first percentage change column for analysis
  const pctColumn = pctColumns[0];

  // Try to identify the dimension column
  const dimensionColumn = findDimensionColumn(data, columns, pctColumn);

  if (!dimensionColumn) {
    return growthAnalysis;
  }

  // Group data into growth categories
  const strongGrowth = [];
  const moderateGrowth = [];
  const stable = [];
  const moderateDecline = [];
  const strongDecline = [];

  data.forEach(row => {
    const pctChange = Number(row[pctColumn]);

    if (isNaN(pctChange)) {
      return; // Skip rows with non-numeric values
    }

    if (pctChange >= 20) {
      strongGrowth.push(row);
    } else if (pctChange >= 5) {
      moderateGrowth.push(row);
    } else if (pctChange >= -5) {
      stable.push(row);
    } else if (pctChange >= -20) {
      moderateDecline.push(row);
    } else {
      strongDecline.push(row);
    }
  });

  // Create analysis object
  growthAnalysis.push({
    type: 'growth-categories',
    dimension: dimensionColumn,
    measureChange: pctColumn,
    categories: {
      strongGrowth: {
        count: strongGrowth.length,
        percentage: (strongGrowth.length / data.length) * 100,
        items: strongGrowth.map(row => row[dimensionColumn])
      },
      moderateGrowth: {
        count: moderateGrowth.length,
        percentage: (moderateGrowth.length / data.length) * 100,
        items: moderateGrowth.map(row => row[dimensionColumn])
      },
      stable: {
        count: stable.length,
        percentage: (stable.length / data.length) * 100,
        items: stable.map(row => row[dimensionColumn])
      },
      moderateDecline: {
        count: moderateDecline.length,
        percentage: (moderateDecline.length / data.length) * 100,
        items: moderateDecline.map(row => row[dimensionColumn])
      },
      strongDecline: {
        count: strongDecline.length,
        percentage: (strongDecline.length / data.length) * 100,
        items: strongDecline.map(row => row[dimensionColumn])
      }
    },
    description: generateGrowthCategoryDescription(dimensionColumn,
      strongGrowth.length, moderateGrowth.length, stable.length,
      moderateDecline.length, strongDecline.length, data.length)
  });

  return growthAnalysis;
}

/**
 * Analyze relative performance in comparison data
 * @param {Array} data - Comparison data
 * @returns {Array} Relative performance analysis results
 */
function analyzeRelativePerformance(data) {
  const performanceAnalysis = [];

  // Skip if insufficient data
  if (!data || data.length === 0) {
    return performanceAnalysis;
  }

  // Find columns with values from both periods
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  // Find potential period column pairs
  const periodPairs = [];

  columns.forEach(col1 => {
    if (col1.includes('_')) {
      const parts = col1.split('_');
      const base = parts.slice(0, -1).join('_');
      const period1 = parts[parts.length - 1];

      columns.forEach(col2 => {
        if (col2 !== col1 && col2.includes(base + '_')) {
          const parts2 = col2.split('_');
          const period2 = parts2[parts2.length - 1];

          if (period1 !== period2) {
            periodPairs.push({
              base,
              period1,
              period2,
              col1,
              col2
            });
          }
        }
      });
    }
  });

  // Skip if no period pairs found
  if (periodPairs.length === 0) {
    return performanceAnalysis;
  }

  // Use first period pair for analysis
  const pair = periodPairs[0];

  // Try to identify the dimension column
  const dimensionColumn = findDimensionColumn(data, columns, pair.col1);

  if (!dimensionColumn) {
    return performanceAnalysis;
  }

  // Calculate improved and declined performers
  const improved = [];
  const declined = [];

  data.forEach(row => {
    const value1 = Number(row[pair.col1]);
    const value2 = Number(row[pair.col2]);

    if (isNaN(value1) || isNaN(value2)) {
      return; // Skip rows with non-numeric values
    }

    if (value2 > value1) {
      improved.push({
        dimension: row[dimensionColumn],
        value1,
        value2,
        change: value2 - value1,
        percentChange: value1 !== 0 ? ((value2 - value1) / value1) * 100 : null
      });
    } else if (value2 < value1) {
      declined.push({
        dimension: row[dimensionColumn],
        value1,
        value2,
        change: value2 - value1,
        percentChange: value1 !== 0 ? ((value2 - value1) / value1) * 100 : null
      });
    }
  });

  // Sort by percentage change
  improved.sort((a, b) => (b.percentChange || 0) - (a.percentChange || 0));
  declined.sort((a, b) => (a.percentChange || 0) - (b.percentChange || 0));

  // Create analysis object
  performanceAnalysis.push({
    type: 'relative-performance',
    dimension: dimensionColumn,
    period1: pair.period1,
    period2: pair.period2,
    measure: pair.base,
    improvedCount: improved.length,
    declinedCount: declined.length,
    noChangeCount: data.length - improved.length - declined.length,
    topImproved: improved.slice(0, 5),
    topDeclined: declined.slice(0, 5),
    description: `${improved.length} ${dimensionColumn}s improved from ${pair.period1} to ${pair.period2}, while ${declined.length} declined. ${data.length - improved.length - declined.length} showed no change.`
  });

  return performanceAnalysis;
}

/**
 * Find the dimension column in a dataset
 * @param {Array} data - Dataset to analyze
 * @param {Array} columns - All column names
 * @param {string} valueColumn - Column known to be a value column
 * @returns {string|null} Dimension column name or null if not found
 */
function findDimensionColumn(data, columns, valueColumn) {
  // Find all non-numeric columns
  const nonNumericColumns = columns.filter(col => {
    // Skip the known value column
    if (col === valueColumn) {
      return false;
    }

    // Check if column values are mostly non-numeric
    const values = data.map(row => row[col]);
    const numericCount = values.filter(val => !isNaN(Number(val))).length;

    return numericCount < values.length * 0.5;
  });

  // If no non-numeric columns, return null
  if (nonNumericColumns.length === 0) {
    return null;
  }

  // Prioritize columns with name hints
  const dimensionHints = ['name', 'category', 'region', 'product', 'customer', 'segment'];

  for (const hint of dimensionHints) {
    const match = nonNumericColumns.find(col =>
      col.toLowerCase().includes(hint)
    );

    if (match) {
      return match;
    }
  }

  // Default to first non-numeric column
  return nonNumericColumns[0];
}

/**
 * Generate description for growth category analysis
 * @param {string} dimension - Dimension column name
 * @param {number} strongGrowth - Count of strong growth items
 * @param {number} moderateGrowth - Count of moderate growth items
 * @param {number} stable - Count of stable items
 * @param {number} moderateDecline - Count of moderate decline items
 * @param {number} strongDecline - Count of strong decline items
 * @param {number} total - Total count
 * @returns {string} Growth category description
 */
function generateGrowthCategoryDescription(dimension, strongGrowth, moderateGrowth,
  stable, moderateDecline, strongDecline, total) {

  const growthCount = strongGrowth + moderateGrowth;
  const declineCount = moderateDecline + strongDecline;

  if (growthCount > declineCount * 2) {
    return `Strong overall growth: ${((growthCount / total) * 100).toFixed(1)}% of ${dimension}s showed growth, with ${((strongGrowth / total) * 100).toFixed(1)}% showing strong growth (≥20%).`;
  } else if (declineCount > growthCount * 2) {
    return `Significant overall decline: ${((declineCount / total) * 100).toFixed(1)}% of ${dimension}s showed decline, with ${((strongDecline / total) * 100).toFixed(1)}% showing strong decline (≤-20%).`;
  } else if (stable > total * 0.5) {
    return `Predominantly stable: ${((stable / total) * 100).toFixed(1)}% of ${dimension}s remained relatively stable (between -5% and +5%).`;
  } else {
    return `Mixed performance: ${((growthCount / total) * 100).toFixed(1)}% of ${dimension}s grew, ${((declineCount / total) * 100).toFixed(1)}% declined, and ${((stable / total) * 100).toFixed(1)}% remained stable.`;
  }
}

/**
 * Generate insights specifically for comparison data
 * @param {Array} data - Comparison data
 * @param {Array} comparisons - Comparison analysis results
 * @returns {Array} Generated insights
 */
function generateComparisonInsights(data, comparisons) {
  const insights = [];

  // Skip if insufficient data
  if (!data || data.length === 0) {
    return insights;
  }

  // Add basic observation
  insights.push({
    type: 'observation',
    importance: 'low',
    description: `Comparison dataset contains ${data.length} rows across multiple periods.`
  });

  // Generate insights from comparisons
  comparisons.forEach(comparison => {
    switch (comparison.type) {
      case 'period-comparison':
        insights.push({
          type: 'period-comparison',
          importance: 'high',
          description: comparison.description,
          metric: comparison.base,
          periods: [comparison.period1, comparison.period2],
          percentChange: comparison.percentChange
        });
        break;

      case 'diff-analysis':
        // Only add insights for significant differences
        if (Math.abs(comparison.averageDiff) > 0.1) {
          insights.push({
            type: 'change-pattern',
            importance: 'medium',
            description: comparison.description,
            metric: comparison.metric,
            averageChange: comparison.averageDiff,
            direction: comparison.averageDiff > 0 ? 'increase' : 'decrease'
          });
        }
        break;

      case 'pct-analysis':
        // Only add insights for significant percentage changes
        if (Math.abs(comparison.averagePctChange) > 5) {
          insights.push({
            type: 'percentage-change',
            importance: 'high',
            description: comparison.description,
            metric: comparison.metric,
            averagePctChange: comparison.averagePctChange,
            direction: comparison.averagePctChange > 0 ? 'increase' : 'decrease'
          });
        }
        break;
    }
  });

  // Look for columns with dominant changes
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  const diffColumns = columns.filter(col => col.includes('_diff'));
  const pctColumns = columns.filter(col => col.includes('_pct_change'));

  // Find the column with the largest percentage change
  if (pctColumns.length > 0) {
    // Calculate average percentage change for each column
    const columnAvgChanges = {};

    pctColumns.forEach(col => {
      const values = data.map(row => Number(row[col])).filter(val => !isNaN(val));
      if (values.length > 0) {
        columnAvgChanges[col] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

    // Find column with largest absolute average change
    const sortedColumns = Object.entries(columnAvgChanges)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (sortedColumns.length > 0) {
      const [topChangeColumn, topChangeValue] = sortedColumns[0];
      const baseMetric = topChangeColumn.replace('_pct_change', '');

      insights.push({
        type: 'top-change',
        importance: 'high',
        description: `${baseMetric} shows the largest average percentage change at ${topChangeValue.toFixed(2)}%`,
        metric: baseMetric,
        percentChange: topChangeValue,
        direction: topChangeValue > 0 ? 'increase' : 'decrease'
      });
    }
  }

  // Add growth category insights
  const growthAnalysis = analyzeGrowthCategories(data);

  growthAnalysis.forEach(analysis => {
    insights.push({
      type: 'growth-distribution',
      importance: 'high',
      description: analysis.description,
      dimension: analysis.dimension,
      categories: {
        growth: analysis.categories.strongGrowth.count + analysis.categories.moderateGrowth.count,
        stable: analysis.categories.stable.count,
        decline: analysis.categories.moderateDecline.count + analysis.categories.strongDecline.count
      }
    });

    // Add standout performers if available
    if (analysis.categories.strongGrowth.count > 0) {
      insights.push({
        type: 'standout-performers',
        importance: 'medium',
        description: `${analysis.categories.strongGrowth.count} ${analysis.dimension}s showed strong growth (≥20%): ${analysis.categories.strongGrowth.items.slice(0, 3).join(', ')}${analysis.categories.strongGrowth.items.length > 3 ? '...' : ''}`,
        performers: analysis.categories.strongGrowth.items.slice(0, 5),
        direction: 'growth'
      });
    }

    if (analysis.categories.strongDecline.count > 0) {
      insights.push({
        type: 'standout-performers',
        importance: 'medium',
        description: `${analysis.categories.strongDecline.count} ${analysis.dimension}s showed strong decline (≤-20%): ${analysis.categories.strongDecline.items.slice(0, 3).join(', ')}${analysis.categories.strongDecline.items.length > 3 ? '...' : ''}`,
        performers: analysis.categories.strongDecline.items.slice(0, 5),
        direction: 'decline'
      });
    }
  });

  // Add relative performance insights
  const performanceAnalysis = analyzeRelativePerformance(data);

  performanceAnalysis.forEach(analysis => {
    insights.push({
      type: 'performance-shift',
      importance: 'high',
      description: analysis.description,
      dimension: analysis.dimension,
      measure: analysis.measure,
      periods: [analysis.period1, analysis.period2],
      improved: analysis.improvedCount,
      declined: analysis.declinedCount
    });

    // Add top improvers if available
    if (analysis.topImproved.length > 0) {
      const topImprover = analysis.topImproved[0];
      insights.push({
        type: 'top-performer',
        importance: 'medium',
        description: `Top improver: ${topImprover.dimension} (${topImprover.percentChange !== null ? topImprover.percentChange.toFixed(1) + '%' : 'N/A'} change)`,
        performer: topImprover.dimension,
        metric: analysis.measure,
        change: topImprover.percentChange
      });
    }

    // Add top decliners if available
    if (analysis.topDeclined.length > 0) {
      const topDecliner = analysis.topDeclined[0];
      insights.push({
        type: 'bottom-performer',
        importance: 'medium',
        description: `Largest decliner: ${topDecliner.dimension} (${topDecliner.percentChange !== null ? topDecliner.percentChange.toFixed(1) + '%' : 'N/A'} change)`,
        performer: topDecliner.dimension,
        metric: analysis.measure,
        change: topDecliner.percentChange
      });
    }
  });

  return insights;
}

module.exports = {
  analyzeComparisonData,
  analyzeComparisons,
  analyzeGrowthCategories,
  analyzeRelativePerformance,
  generateComparisonInsights
};