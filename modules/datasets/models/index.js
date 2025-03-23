// modules/datasets/models/index.js

const { sequelize } = require('../database');
const Dataset = require('./dataset');
const DatasetColumn = require('./datasetColumn');
const DatasetIndex = require('./datasetIndex');
const IndexColumn = require('./indexColumn');
const DatasetProcessingJob = require('./datasetProcessingJob');
const Report = require('../../reports/models/reportModel'); // Add Report model import

// Define relationships with completely unique aliases
Dataset.hasMany(DatasetColumn, { foreignKey: 'datasetId', as: 'datasetColumns' });
DatasetColumn.belongsTo(Dataset, { foreignKey: 'datasetId' });

Dataset.hasMany(DatasetIndex, { foreignKey: 'datasetId', as: 'datasetIndexes' });
DatasetIndex.belongsTo(Dataset, { foreignKey: 'datasetId' });

DatasetIndex.hasMany(IndexColumn, { foreignKey: 'indexId', as: 'indexColumns' });
IndexColumn.belongsTo(DatasetIndex, { foreignKey: 'indexId' });

Dataset.hasMany(DatasetProcessingJob, { foreignKey: 'datasetId', as: 'datasetProcessingJobs' });
DatasetProcessingJob.belongsTo(Dataset, { foreignKey: 'datasetId' });

// Reports relationship - a dataset has many reports
Dataset.hasMany(Report, { foreignKey: 'datasetId', as: 'datasetReports' });
Report.belongsTo(Dataset, { foreignKey: 'datasetId' });

// Make sure to update all exports
module.exports = {
  sequelize,
  Dataset,
  DatasetColumn,
  DatasetIndex,
  IndexColumn,
  DatasetProcessingJob,
  Report
};