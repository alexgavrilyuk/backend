// modules/reports/controller.js

const { ValidationError, NotFoundError, asyncHandler } = require('../../core/middleware/errorHandler');
const { runBigQueryQuery } = require('../bigquery');
const { naturalLanguageToSql } = require('../queries/services/nlpService');
const db = require('../datasets/models');
const reportGenerationService = require('./services/reportGenerationService');
const visualizationService = require('./services/visualizationService');
const insightService = require('./services/insightService');
const reportUtils = require('./utils/reportUtils');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a new report based on a natural language query
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const generateReport = asyncHandler(async (req, res) => {
  const { query, datasetId, reportType, conversationHistory = [] } = req.body;
  const userId = req.user.id;

  // Validate required parameters
  if (!query) {
    throw new ValidationError('Report query is required');
  }

  if (!datasetId) {
    throw new ValidationError('Dataset ID is required');
  }

  // Log report generation request
  console.log(`Generating report for query: "${query}" on dataset: ${datasetId}`);

  // Check if dataset exists and belongs to user
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId }
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found or access denied');
  }

  // Check if dataset is available
  if (dataset.status !== 'available') {
    throw new ValidationError(`Dataset is not available for reporting (current status: ${dataset.status})`);
  }

  // Get dataset columns
  const columns = await db.DatasetColumn.findAll({
    where: { datasetId },
    order: [['position', 'ASC']]
  });

  if (!columns.length) {
    throw new ValidationError('Dataset schema information not available');
  }

  try {
    // Generate a unique ID for the report
    const reportId = uuidv4();

    // Create initial report record
    const report = await db.Report.create({
      id: reportId,
      userId,
      datasetId,
      query,
      status: 'processing',
      reportType: reportType || 'standard'
    });

    // Generate report asynchronously
    const reportData = await reportGenerationService.generateReport({
      query,
      datasetId,
      userId,
      dataset,
      columns,
      reportId,
      reportType: reportType || 'standard',
      conversationHistory
    });

    // Update report status
    await report.update({
      status: 'completed',
      generatedSql: reportData.generatedSql,
      visualizations: JSON.stringify(reportData.visualizations),
      insights: JSON.stringify(reportData.insights),
      narrative: reportData.narrative,
      reportData: JSON.stringify(reportData.data)
    });

    // Return response with report data
    return res.status(201).json({
      success: true,
      message: 'Report generated successfully',
      reportId,
      report: reportUtils.formatReportResponse(report, reportData)
    });
  } catch (error) {
    console.error('Error generating report:', error);

    // Create failed report record if error occurs
    const failedReport = await db.Report.create({
      id: uuidv4(),
      userId,
      datasetId,
      query,
      status: 'error',
      reportType: reportType || 'standard',
      errorMessage: error.message
    });

    throw new Error(`Report generation failed: ${error.message}`);
  }
});

/**
 * Get a specific report by ID
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;

  // Find report
  const report = await db.Report.findOne({
    where: { id: reportId, userId }
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  // Get dataset information
  const dataset = await db.Dataset.findOne({
    where: { id: report.datasetId }
  });

  // Parse JSON fields
  const reportData = {
    visualizations: report.visualizations ? JSON.parse(report.visualizations) : [],
    insights: report.insights ? JSON.parse(report.insights) : [],
    data: report.reportData ? JSON.parse(report.reportData) : {},
    narrative: report.narrative || '',
    generatedSql: report.generatedSql || ''
  };

  // Return formatted report
  return res.status(200).json({
    success: true,
    report: reportUtils.formatReportResponse(report, reportData),
    dataset: {
      id: dataset.id,
      name: dataset.name
    }
  });
});

/**
 * Get all reports for a user
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getUserReports = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get all reports for the user
  const reports = await db.Report.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']]
  });

  // Get dataset information for all reports
  const datasetIds = [...new Set(reports.map(report => report.datasetId))];
  const datasets = await db.Dataset.findAll({
    where: { id: datasetIds }
  });

  // Map datasets by ID for easy lookup
  const datasetMap = datasets.reduce((map, dataset) => {
    map[dataset.id] = dataset;
    return map;
  }, {});

  // Format reports response
  const formattedReports = reports.map(report => ({
    id: report.id,
    query: report.query,
    status: report.status,
    reportType: report.reportType,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    dataset: {
      id: report.datasetId,
      name: datasetMap[report.datasetId]?.name || 'Unknown Dataset'
    }
  }));

  return res.status(200).json({
    success: true,
    reports: formattedReports
  });
});

/**
 * Delete a report
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const deleteReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;

  // Find report
  const report = await db.Report.findOne({
    where: { id: reportId, userId }
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  // Delete report
  await report.destroy();

  return res.status(200).json({
    success: true,
    message: 'Report deleted successfully'
  });
});

module.exports = {
  generateReport,
  getReport,
  getUserReports,
  deleteReport
};