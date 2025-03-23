// modules/reports/services/insightService.js

/**
 * Service for extracting insights from query results
 * Identifies trends, patterns, anomalies, and key findings from data
 */
class InsightService {
  /**
   * Extract insights from query result data
   * @param {Array} data - Query result data
   * @param {string} sql - SQL query used to generate the data
   * @param {Array} columns - Dataset column definitions
   * @param {string} reportType - Type of report being generated
   * @returns {Promise<Array>} Insights extracted from data
   */
  async extractInsights(data, sql, columns, reportType) {
    try {
      if (!data || data.length === 0) {
        console.log('No data available for insight extraction');
        return [];
      }

      console.log(`Extracting insights from ${data.length} rows of data`);

      // Extract insights based on data characteristics and SQL query
      const insights = [];

      // 1. Determine if this is a dimensional query (has GROUP BY)
      const isDimensionalQuery = this.isDimensionalQuery(sql);

      // 2. Get sample row for column detection
      const sampleRow = data[0];
      const columnNames = Object.keys(sampleRow);

      // 3. Detect column types from data
      const columnTypes = this.detectColumnTypes(data, columnNames);

      // 4. Extract appropriate insights based on data patterns
      if (isDimensionalQuery) {
        // Handle dimensional queries (with aggregations)
        const dimensionalInsights = this.extractDimensionalInsights(
          data, columnNames, columnTypes, sql
        );
        insights.push(...dimensionalInsights);
      } else if (data.length === 1) {
        // Single row results (summary data)
        const summaryInsights = this.extractSummaryInsights(
          data[0], columnNames, columnTypes
        );
        insights.push(...summaryInsights);
      } else {
        // Standard data table (multiple rows, not aggregated)
        const standardInsights = this.extractStandardInsights(
          data, columnNames, columnTypes
        );
        insights.push(...standardInsights);
      }

      // 5. Add basic data statistics insight if no other insights were generated
      if (insights.length === 0) {
        insights.push({
          type: 'statistic',
          title: 'Data Overview',
          description: `Query returned ${data.length} rows with ${columnNames.length} columns.`
        });
      }

      console.log(`Extracted ${insights.length} insights from data`);
      return insights;
    } catch (error) {
      console.error('Error extracting insights:', error);
      // Return a basic insight as fallback
      return [{
        type: 'statistic',
        title: 'Data Retrieved',
        description: `Query successfully returned ${data ? data.length : 0} rows of data.`
      }];
    }
  }

  /**
   * Detect if a query is dimensional (has GROUP BY clause)
   * @param {string} sql - The SQL query
   * @returns {boolean} True if query is dimensional
   */
  isDimensionalQuery(sql) {
    return sql.toLowerCase().includes('group by');
  }

  /**
   * Detect column types from data
   * @param {Array} data - The data rows
   * @param {Array} columnNames - Column names
   * @returns {Object} Map of column types
   */
  detectColumnTypes(data, columnNames) {
    const columnTypes = {};

    // Process each column
    columnNames.forEach(column => {
      // Get non-null values for type detection
      const values = data
        .map(row => row[column])
        .filter(val => val !== null && val !== undefined);

      if (values.length === 0) {
        columnTypes[column] = 'unknown';
        return;
      }

      // Check if all values are numbers
      const allNumbers = values.every(val =>
        !isNaN(parseFloat(val)) && isFinite(val)
      );

      if (allNumbers) {
        columnTypes[column] = 'numeric';
        return;
      }

      // Check if values are dates
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
      const allDates = values.every(val =>
        datePattern.test(String(val))
      );

      if (allDates) {
        columnTypes[column] = 'date';
        return;
      }

      // Check if categorical (few unique values)
      const uniqueValues = new Set(values);
      if (uniqueValues.size <= 15 && uniqueValues.size < values.length / 2) {
        columnTypes[column] = 'categorical';
        return;
      }

      // Default to string
      columnTypes[column] = 'string';
    });

    return columnTypes;
  }

  /**
   * Extract insights from dimensional queries (with GROUP BY)
   * @param {Array} data - The data rows
   * @param {Array} columnNames - Column names
   * @param {Object} columnTypes - Column type mapping
   * @param {string} sql - The SQL query
   * @returns {Array} Extracted insights
   */
  extractDimensionalInsights(data, columnNames, columnTypes, sql) {
    const insights = [];

    // Find dimension and measure columns
    const dimensions = [];
    const measures = [];

    columnNames.forEach(col => {
      if (columnTypes[col] === 'numeric') {
        measures.push(col);
      } else {
        dimensions.push(col);
      }
    });

    // Ensure we have at least one dimension and measure
    if (dimensions.length === 0 || measures.length === 0) {
      return insights;
    }

    // Get primary dimension and measure
    const dimension = dimensions[0];
    const measure = measures[0];

    // Add total measure insight
    const total = data.reduce((sum, row) => sum + (parseFloat(row[measure]) || 0), 0);
    insights.push({
      type: 'statistic',
      title: `Total ${measure.replace(/_/g, ' ')}`,
      description: `The total ${measure.replace(/_/g, ' ')} is ${this.formatNumber(total)}.`,
      value: total,
      metric: measure
    });

    // Add top performer insight
    if (data.length > 1) {
      const sortedData = [...data].sort((a, b) =>
        (parseFloat(b[measure]) || 0) - (parseFloat(a[measure]) || 0)
      );

      const topPerformer = sortedData[0];
      const topValue = parseFloat(topPerformer[measure]) || 0;
      const topName = topPerformer[dimension];

      insights.push({
        type: 'top_performer',
        title: `Top ${dimension.replace(/_/g, ' ')}`,
        description: `${topName} has the highest ${measure.replace(/_/g, ' ')} with ${this.formatNumber(topValue)}.`,
        value: topValue,
        dimension: dimension,
        measure: measure,
        category: topName
      });

      // Add bottom performer insight (if more than 2 items)
      if (data.length > 2) {
        const bottomPerformer = sortedData[sortedData.length - 1];
        const bottomValue = parseFloat(bottomPerformer[measure]) || 0;
        const bottomName = bottomPerformer[dimension];

        insights.push({
          type: 'bottom_performer',
          title: `Lowest ${dimension.replace(/_/g, ' ')}`,
          description: `${bottomName} has the lowest ${measure.replace(/_/g, ' ')} with ${this.formatNumber(bottomValue)}.`,
          value: bottomValue,
          dimension: dimension,
          measure: measure,
          category: bottomName
        });
      }
    }

    // Calculate distribution insights
    if (data.length > 3) {
      // Calculate average
      const average = total / data.length;
      insights.push({
        type: 'statistic',
        title: `Average ${measure.replace(/_/g, ' ')}`,
        description: `The average ${measure.replace(/_/g, ' ')} is ${this.formatNumber(average)}.`,
        value: average,
        metric: measure
      });

      // Calculate median if we have enough data points
      if (data.length > 4) {
        const sortedValues = [...data]
          .map(row => parseFloat(row[measure]) || 0)
          .sort((a, b) => a - b);

        let median;
        const midIndex = Math.floor(sortedValues.length / 2);

        if (sortedValues.length % 2 === 0) {
          median = (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2;
        } else {
          median = sortedValues[midIndex];
        }

        insights.push({
          type: 'statistic',
          title: `Median ${measure.replace(/_/g, ' ')}`,
          description: `The median ${measure.replace(/_/g, ' ')} is ${this.formatNumber(median)}.`,
          value: median,
          metric: measure
        });

        // Detect skew if median and average differ significantly
        if (Math.abs(median - average) > average * 0.2) {
          const skewType = median < average ? 'positively' : 'negatively';
          insights.push({
            type: 'distribution',
            title: `${skewType.charAt(0).toUpperCase() + skewType.slice(1)} Skewed Distribution`,
            description: `The data is ${skewType} skewed (median: ${this.formatNumber(median)}, average: ${this.formatNumber(average)}), indicating some ${median < average ? 'high' : 'low'} outliers.`
          });
        }
      }
    }

    // For time-based dimensions, detect trends
    if (columnTypes[dimension] === 'date' && data.length > 2) {
      // Sort data chronologically
      const chronologicalData = [...data].sort((a, b) => {
        return new Date(a[dimension]) - new Date(b[dimension]);
      });

      // Calculate simple trend (first to last)
      const firstValue = parseFloat(chronologicalData[0][measure]) || 0;
      const lastValue = parseFloat(chronologicalData[chronologicalData.length - 1][measure]) || 0;

      const percentChange = ((lastValue - firstValue) / firstValue) * 100;

      if (!isNaN(percentChange) && isFinite(percentChange)) {
        const trendDirection = percentChange > 0 ? 'increasing' : 'decreasing';

        insights.push({
          type: 'trend',
          title: `Overall ${trendDirection} Trend`,
          description: `${measure.replace(/_/g, ' ')} has ${trendDirection} by ${Math.abs(percentChange).toFixed(1)}% from ${chronologicalData[0][dimension]} to ${chronologicalData[chronologicalData.length - 1][dimension]}.`,
          percentChange: percentChange,
          startDate: chronologicalData[0][dimension],
          endDate: chronologicalData[chronologicalData.length - 1][dimension],
          dimension: dimension,
          measure: measure
        });
      }
    }

    // For categorical dimensions, look for concentration
    if (columnTypes[dimension] === 'categorical' && data.length > 3) {
      // Calculate total
      const totalValue = data.reduce((sum, row) =>
        sum + (parseFloat(row[measure]) || 0), 0
      );

      // Sort by measure (descending)
      const sortedByMeasure = [...data].sort((a, b) =>
        (parseFloat(b[measure]) || 0) - (parseFloat(a[measure]) || 0)
      );

      // Check if top 20% categories account for more than 80% of total (Pareto principle)
      const topN = Math.max(1, Math.ceil(data.length * 0.2));
      const topNTotal = sortedByMeasure
        .slice(0, topN)
        .reduce((sum, row) => sum + (parseFloat(row[measure]) || 0), 0);

      const topNPercent = (topNTotal / totalValue) * 100;

      if (topNPercent > 70) {
        const topCategories = sortedByMeasure
          .slice(0, topN)
          .map(row => row[dimension])
          .join(', ');

        insights.push({
          type: 'concentration',
          title: 'Notable Concentration',
          description: `The top ${topN} ${dimension.replace(/_/g, ' ')} (${topCategories}) account for ${topNPercent.toFixed(1)}% of total ${measure.replace(/_/g, ' ')}.`
        });
      }
    }

    return insights;
  }

  /**
   * Extract insights from summary data (single row)
   * @param {Object} data - The single data row
   * @param {Array} columnNames - Column names
   * @param {Object} columnTypes - Column type mapping
   * @returns {Array} Extracted insights
   */
  extractSummaryInsights(data, columnNames, columnTypes) {
    const insights = [];

    // For single row results, highlight significant metric values
    const numericColumns = columnNames.filter(
      col => columnTypes[col] === 'numeric'
    );

    // Create basic insights for each numeric column
    numericColumns.forEach(column => {
      const value = parseFloat(data[column]) || 0;

      insights.push({
        type: 'statistic',
        title: column.replace(/_/g, ' '),
        description: `${column.replace(/_/g, ' ')} is ${this.formatNumber(value)}.`,
        value: value,
        metric: column
      });
    });

    return insights;
  }

  /**
   * Extract insights from standard tabular data
   * @param {Array} data - The data rows
   * @param {Array} columnNames - Column names
   * @param {Object} columnTypes - Column type mapping
   * @returns {Array} Extracted insights
   */
  extractStandardInsights(data, columnNames, columnTypes) {
    const insights = [];

    // Add basic data statistics
    insights.push({
      type: 'statistic',
      title: 'Data Overview',
      description: `Query returned ${data.length} rows with ${columnNames.length} columns.`
    });

    // Identify numeric and categorical columns
    const numericColumns = columnNames.filter(col => columnTypes[col] === 'numeric');
    const categoricalColumns = columnNames.filter(col => columnTypes[col] === 'categorical');

    // Generate statistics for numeric columns
    numericColumns.forEach(column => {
      const values = data.map(row => parseFloat(row[column]) || 0);

      if (values.length > 0) {
        // Calculate basic statistics
        const sum = values.reduce((acc, val) => acc + val, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        // Only add insight if we have meaningful values
        if (max > 0 && max !== min) {
          insights.push({
            type: 'range',
            title: `${column.replace(/_/g, ' ')} Range`,
            description: `${column.replace(/_/g, ' ')} ranges from ${this.formatNumber(min)} to ${this.formatNumber(max)} with an average of ${this.formatNumber(avg)}.`,
            min: min,
            max: max,
            average: avg,
            metric: column
          });
        }
      }
    });

    // Generate insights for categorical columns
    categoricalColumns.forEach(column => {
      // Count occurrences of each category
      const categoryCounts = {};
      data.forEach(row => {
        const category = row[column];
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      // Find the most common category
      let maxCount = 0;
      let mostCommon = null;

      Object.entries(categoryCounts).forEach(([category, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = category;
        }
      });

      // Only add insight if we have a meaningful distribution
      if (mostCommon && maxCount > 1 && Object.keys(categoryCounts).length > 1) {
        const percentage = (maxCount / data.length) * 100;

        insights.push({
          type: 'distribution',
          title: `Most Common ${column.replace(/_/g, ' ')}`,
          description: `${mostCommon} is the most common ${column.replace(/_/g, ' ')}, appearing in ${percentage.toFixed(1)}% of the data (${maxCount} out of ${data.length} rows).`,
          category: mostCommon,
          count: maxCount,
          percentage: percentage,
          dimension: column
        });
      }
    });

    return insights;
  }

  /**
   * Format a number for display in insights
   * @param {number} value - The numeric value to format
   * @returns {string} Formatted number
   */
  formatNumber(value) {
    // Handle edge cases
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }

    // Format large numbers with commas
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString('en-US', {
        maximumFractionDigits: 2
      });
    }

    // Format small numbers appropriately
    if (Math.abs(value) < 0.01 && value !== 0) {
      return value.toExponential(2);
    }

    // Format with appropriate precision
    if (Number.isInteger(value)) {
      return value.toString();
    }

    // For decimal numbers
    return value.toFixed(2);
  }
}

// Export a singleton instance
module.exports = new InsightService();