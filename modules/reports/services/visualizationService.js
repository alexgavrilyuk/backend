// modules/reports/services/visualizationService.js

/**
 * Service for generating visualization specifications based on data
 * Determines appropriate visualizations based on data types and query intent
 */
class VisualizationService {
  /**
   * Generate appropriate visualizations based on query results
   * @param {Array} data - Query result data
   * @param {string} sql - SQL query used to generate the data
   * @param {Array} columns - Dataset column definitions
   * @param {string} reportType - Type of report being generated
   * @returns {Promise<Array>} Visualization specifications
   */
  async generateVisualizations(data, sql, columns, reportType) {
    try {
      if (!data || data.length === 0) {
        console.log('No data available for visualization generation');
        return [];
      }

      console.log(`Generating visualizations for ${data.length} rows of data`);

      // Generate visualizations based on data characteristics and SQL query
      const visualizations = [];

      // 1. Determine if this is a dimensional query (has GROUP BY)
      const isDimensionalQuery = this.isDimensionalQuery(sql);

      // 2. Get sample row for column detection
      const sampleRow = data[0];
      const columnNames = Object.keys(sampleRow);

      // 3. Detect column types from data
      const columnTypes = this.detectColumnTypes(data, columnNames);

      // 4. Generate appropriate visualizations based on data patterns
      if (isDimensionalQuery) {
        // Handle dimensional queries (with aggregations)
        const dimensionViz = this.generateDimensionalVisualizations(
          data, columnNames, columnTypes, sql
        );
        visualizations.push(...dimensionViz);
      } else if (data.length === 1) {
        // Single row results (summary data)
        const singleRowViz = this.generateSingleRowVisualizations(
          data[0], columnNames, columnTypes
        );
        visualizations.push(...singleRowViz);
      } else {
        // Standard data table (multiple rows, not aggregated)
        visualizations.push(this.generateTableVisualization(
          data, columnNames, `Data Table: ${data.length} Rows`
        ));

        // Add additional visualizations if appropriate
        const additionalViz = this.generateStandardVisualizations(
          data, columnNames, columnTypes
        );
        visualizations.push(...additionalViz);
      }

      // 5. Ensure we have at least a table visualization
      if (visualizations.length === 0) {
        visualizations.push(this.generateTableVisualization(
          data, columnNames, `Data Table: ${data.length} Rows`
        ));
      }

      console.log(`Generated ${visualizations.length} visualizations`);
      return visualizations;
    } catch (error) {
      console.error('Error generating visualizations:', error);
      // Return table visualization as fallback
      return [
        this.generateTableVisualization(
          data,
          data[0] ? Object.keys(data[0]) : [],
          'Data Table'
        )
      ];
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
   * Generate visualizations for dimensional queries (with GROUP BY)
   * @param {Array} data - The data rows
   * @param {Array} columnNames - Column names
   * @param {Object} columnTypes - Column type mapping
   * @param {string} sql - The SQL query
   * @returns {Array} Visualization specifications
   */
  generateDimensionalVisualizations(data, columnNames, columnTypes, sql) {
    const visualizations = [];

    // Add table visualization
    visualizations.push(this.generateTableVisualization(
      data, columnNames, 'Aggregated Data Table'
    ));

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
      return visualizations;
    }

    // Get primary dimension and measure
    const dimension = dimensions[0];

    // Generate chart for each measure
    measures.forEach(measure => {
      // Name formatting
      const measureName = measure.replace(/_/g, ' ').toLowerCase();
      const dimensionName = dimension.replace(/_/g, ' ').toLowerCase();

      // For time/date dimensions, use line chart
      if (columnTypes[dimension] === 'date') {
        visualizations.push({
          type: 'line',
          title: `${measureName} over Time`,
          data: data,
          config: {
            xAxis: dimension,
            yAxis: measure,
            sortBy: dimension
          }
        });
      }
      // For categorical dimensions with few values, use bar chart
      else if (columnTypes[dimension] === 'categorical' ||
               new Set(data.map(row => row[dimension])).size <= 15) {
        visualizations.push({
          type: 'bar',
          title: `${measureName} by ${dimensionName}`,
          data: data,
          config: {
            xAxis: dimension,
            yAxis: measure,
            sortBy: measure,
            sortDirection: 'desc'
          }
        });
      }
      // For numeric dimensions, use scatter plot
      else if (columnTypes[dimension] === 'numeric') {
        visualizations.push({
          type: 'scatter',
          title: `${measureName} vs ${dimensionName}`,
          data: data,
          config: {
            xAxis: dimension,
            yAxis: measure
          }
        });
      }
    });

    // If we have multiple measures and one dimension, add combination chart
    if (measures.length > 1 && dimensions.length === 1) {
      visualizations.push({
        type: 'combo',
        title: `${measures.map(m => m.replace(/_/g, ' ')).join(' & ')} by ${dimension}`,
        data: data,
        config: {
          xAxis: dimension,
          series: measures.map(measure => ({
            name: measure.replace(/_/g, ' '),
            key: measure
          })),
          sortBy: dimension
        }
      });
    }

    // If we have many values, limit displayed data for better visualization
    if (data.length > 20) {
      const topData = [...data].sort((a, b) => b[measures[0]] - a[measures[0]]).slice(0, 20);

      visualizations.push({
        type: 'bar',
        title: `Top 20 ${dimensionName} by ${measures[0]}`,
        data: topData,
        config: {
          xAxis: dimension,
          yAxis: measures[0],
          sortBy: measures[0],
          sortDirection: 'desc'
        }
      });
    }

    return visualizations;
  }

  /**
   * Generate visualizations for single row results (summaries)
   * @param {Object} data - The single data row
   * @param {Array} columnNames - Column names
   * @param {Object} columnTypes - Column type mapping
   * @returns {Array} Visualization specifications
   */
  generateSingleRowVisualizations(data, columnNames, columnTypes) {
    const visualizations = [];

    // Always add a simple table for single row results
    visualizations.push(this.generateTableVisualization(
      [data], columnNames, 'Summary Data'
    ));

    // If we have multiple numeric fields, show them as a KPI card collection
    const numericColumns = columnNames.filter(
      col => columnTypes[col] === 'numeric'
    );

    if (numericColumns.length > 0) {
      visualizations.push({
        type: 'kpi',
        title: 'Key Metrics',
        data: numericColumns.map(col => ({
          label: col.replace(/_/g, ' '),
          value: data[col],
          key: col
        }))
      });
    }

    return visualizations;
  }

  /**
   * Generate standard visualizations for regular tabular data
   * @param {Array} data - The data rows
   * @param {Array} columnNames - Column names
   * @param {Object} columnTypes - Column type mapping
   * @returns {Array} Visualization specifications
   */
  generateStandardVisualizations(data, columnNames, columnTypes) {
    const visualizations = [];

    // Identify potential visualization candidates
    const dateColumns = columnNames.filter(col => columnTypes[col] === 'date');
    const numericColumns = columnNames.filter(col => columnTypes[col] === 'numeric');
    const categoricalColumns = columnNames.filter(col => columnTypes[col] === 'categorical');

    // If we have date and numeric columns, create time series chart
    if (dateColumns.length > 0 && numericColumns.length > 0) {
      const dateCol = dateColumns[0];

      numericColumns.slice(0, 3).forEach(numCol => {
        visualizations.push({
          type: 'line',
          title: `${numCol.replace(/_/g, ' ')} Over Time`,
          data: data,
          config: {
            xAxis: dateCol,
            yAxis: numCol,
            sortBy: dateCol
          }
        });
      });
    }

    // If we have categorical and numeric columns, create bar charts
    if (categoricalColumns.length > 0 && numericColumns.length > 0) {
      const catCol = categoricalColumns[0];

      // Count unique values to check if suitable for chart
      const uniqueValues = new Set(data.map(row => row[catCol]));

      if (uniqueValues.size > 1 && uniqueValues.size <= 20) {
        numericColumns.slice(0, 2).forEach(numCol => {
          visualizations.push({
            type: 'bar',
            title: `${numCol.replace(/_/g, ' ')} by ${catCol.replace(/_/g, ' ')}`,
            data: this.aggregateDataForChart(data, catCol, numCol),
            config: {
              xAxis: catCol,
              yAxis: numCol,
              sortBy: numCol,
              sortDirection: 'desc'
            }
          });
        });
      }
    }

    // If we have multiple numeric columns, create a scatter plot
    if (numericColumns.length >= 2) {
      visualizations.push({
        type: 'scatter',
        title: `${numericColumns[0].replace(/_/g, ' ')} vs ${numericColumns[1].replace(/_/g, ' ')}`,
        data: data,
        config: {
          xAxis: numericColumns[0],
          yAxis: numericColumns[1]
        }
      });
    }

    return visualizations;
  }

  /**
   * Generate a table visualization
   * @param {Array} data - The data rows
   * @param {Array} columnNames - Column names
   * @param {string} title - Visualization title
   * @returns {Object} Table visualization specification
   */
  generateTableVisualization(data, columnNames, title) {
    return {
      type: 'table',
      title: title,
      data: data,
      config: {
        columns: columnNames.map(col => ({
          key: col,
          label: col.replace(/_/g, ' ')
        }))
      }
    };
  }

  /**
   * Aggregate data for chart visualization
   * @param {Array} data - The data rows
   * @param {string} categoryColumn - Categorical column name
   * @param {string} valueColumn - Numeric column name
   * @returns {Array} Aggregated data
   */
  aggregateDataForChart(data, categoryColumn, valueColumn) {
    const aggregated = {};

    // Group by category column
    data.forEach(row => {
      const category = row[categoryColumn];
      const value = parseFloat(row[valueColumn]) || 0;

      if (!aggregated[category]) {
        aggregated[category] = {
          [categoryColumn]: category,
          [valueColumn]: 0,
          count: 0
        };
      }

      aggregated[category][valueColumn] += value;
      aggregated[category].count += 1;
    });

    return Object.values(aggregated);
  }
}

// Export a singleton instance
module.exports = new VisualizationService();