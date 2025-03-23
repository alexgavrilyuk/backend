// modules/reports/utils/reportUtils.js

/**
 * Utility functions for report processing
 */

/**
 * Format a report for API response
 * @param {Object} report - Report database model
 * @param {Object} reportData - Generated report data
 * @returns {Object} Formatted report for API response
 */
function formatReportResponse(report, reportData = {}) {
  // Parse JSON fields if needed
  const visualizations = reportData.visualizations ||
    (report.visualizations ? JSON.parse(report.visualizations) : []);

  const insights = reportData.insights ||
    (report.insights ? JSON.parse(report.insights) : []);

  const data = reportData.data ||
    (report.reportData ? JSON.parse(report.reportData) : []);

  return {
    id: report.id,
    query: report.query,
    status: report.status,
    reportType: report.reportType,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    datasetId: report.datasetId,
    generatedSql: reportData.generatedSql || report.generatedSql || '',
    narrative: reportData.narrative || report.narrative || '',
    visualizations: visualizations,
    insights: insights,
    data: data,
    metadata: reportData.metadata || {}
  };
}

/**
 * Validate a visualization specification
 * @param {Object} visualization - Visualization specification to validate
 * @returns {boolean} Whether the visualization is valid
 */
function validateVisualization(visualization) {
  // Check required fields
  if (!visualization || !visualization.type || !visualization.title) {
    return false;
  }

  // Validate based on visualization type
  switch (visualization.type) {
    case 'table':
      return !!visualization.data && Array.isArray(visualization.data);

    case 'bar':
    case 'line':
    case 'scatter':
      return !!visualization.data &&
             Array.isArray(visualization.data) &&
             !!visualization.config &&
             !!visualization.config.xAxis &&
             !!visualization.config.yAxis;

    case 'pie':
    case 'donut':
      return !!visualization.data &&
             Array.isArray(visualization.data) &&
             !!visualization.config &&
             !!visualization.config.valueField &&
             !!visualization.config.labelField;

    case 'combo':
      return !!visualization.data &&
             Array.isArray(visualization.data) &&
             !!visualization.config &&
             !!visualization.config.xAxis &&
             Array.isArray(visualization.config.series);

    case 'kpi':
      return Array.isArray(visualization.data) &&
             visualization.data.every(item => item.label && item.value !== undefined);

    default:
      return true; // Allow unknown types for forward compatibility
  }
}

/**
 * Validate an insight object
 * @param {Object} insight - Insight to validate
 * @returns {boolean} Whether the insight is valid
 */
function validateInsight(insight) {
  // Check required fields
  if (!insight || !insight.type || !insight.title || !insight.description) {
    return false;
  }

  // All insights require a type, title, and description
  return true;
}

/**
 * Check if a report exceeds size limits
 * @param {Object} report - Report data to check
 * @returns {boolean} Whether the report exceeds size limits
 */
function checkReportSizeLimits(report) {
  try {
    // Rough estimate of report size
    const reportJSON = JSON.stringify({
      data: report.data || [],
      visualizations: report.visualizations || [],
      insights: report.insights || [],
      narrative: report.narrative || ''
    });

    // Check if report exceeds 10MB
    const sizeInMB = reportJSON.length / (1024 * 1024);
    return sizeInMB > 10;
  } catch (error) {
    console.error('Error checking report size:', error);
    return true; // Assume it exceeds if we can't check
  }
}

/**
 * Truncate report data to meet size limits
 * @param {Object} report - Report data to truncate
 * @returns {Object} Truncated report data
 */
function truncateReportData(report) {
  const maxRows = 1000;

  // Clone report to avoid modifying original
  const truncatedReport = {
    ...report,
    data: report.data ? [...report.data] : [],
    visualizations: report.visualizations ? [...report.visualizations] : [],
    insights: report.insights ? [...report.insights] : []
  };

  // Truncate data array if needed
  if (truncatedReport.data && truncatedReport.data.length > maxRows) {
    truncatedReport.data = truncatedReport.data.slice(0, maxRows);

    // Add note about truncation to metadata
    if (!truncatedReport.metadata) {
      truncatedReport.metadata = {};
    }

    truncatedReport.metadata.truncated = true;
    truncatedReport.metadata.originalRowCount = report.data.length;
    truncatedReport.metadata.truncatedRowCount = maxRows;
  }

  // Truncate very large visualizations if needed
  if (truncatedReport.visualizations && truncatedReport.visualizations.length > 0) {
    truncatedReport.visualizations.forEach(viz => {
      if (viz.data && viz.data.length > maxRows) {
        viz.data = viz.data.slice(0, maxRows);
        viz.title = `${viz.title} (Truncated to ${maxRows} rows)`;
      }
    });
  }

  return truncatedReport;
}

/**
 * Convert insights to a structured format for frontend
 * @param {Array} insights - Raw insights
 * @returns {Array} Formatted insights with categories
 */
function categorizeInsights(insights) {
  if (!insights || !Array.isArray(insights)) {
    return [];
  }

  // Define categories
  const categories = {
    'key_metrics': {
      title: 'Key Metrics',
      insights: []
    },
    'trends': {
      title: 'Trends',
      insights: []
    },
    'comparative': {
      title: 'Comparative Analysis',
      insights: []
    },
    'distribution': {
      title: 'Distribution',
      insights: []
    },
    'other': {
      title: 'Other Insights',
      insights: []
    }
  };

  // Categorize insights
  insights.forEach(insight => {
    switch (insight.type) {
      case 'statistic':
        categories.key_metrics.insights.push(insight);
        break;

      case 'trend':
        categories.trends.insights.push(insight);
        break;

      case 'top_performer':
      case 'bottom_performer':
        categories.comparative.insights.push(insight);
        break;

      case 'distribution':
      case 'concentration':
      case 'range':
        categories.distribution.insights.push(insight);
        break;

      default:
        categories.other.insights.push(insight);
        break;
    }
  });

  // Return only categories with insights
  return Object.values(categories)
    .filter(category => category.insights.length > 0);
}

/**
 * Generate a report export filename
 * @param {string} reportName - Report title or query
 * @param {string} format - Export format
 * @returns {string} Sanitized filename
 */
function generateExportFilename(reportName, format = 'pdf') {
  // Sanitize report name for filename
  const sanitized = reportName
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 50)
    .trim()
    .toLowerCase();

  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  return `report_${sanitized}_${timestamp}.${format}`;
}

module.exports = {
  formatReportResponse,
  validateVisualization,
  validateInsight,
  checkReportSizeLimits,
  truncateReportData,
  categorizeInsights,
  generateExportFilename
};