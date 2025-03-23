// modules/datasets/models/index.js

const { sequelize } = require('../database');
const Dataset = require('./dataset');
const DatasetColumn = require('./datasetColumn');
const DatasetIndex = require('./datasetIndex');
const IndexColumn = require('./indexColumn');
const DatasetProcessingJob = require('./datasetProcessingJob');
const Report = require('../../reports/models/reportModel'); // Add Report model import

// Define relationships
Dataset.hasMany(DatasetColumn, { foreignKey: 'datasetId', as: 'columns' });
DatasetColumn.belongsTo(Dataset, { foreignKey: 'datasetId' });

Dataset.hasMany(DatasetIndex, { foreignKey: 'datasetId', as: 'indexes' });
DatasetIndex.belongsTo(Dataset, { foreignKey: 'datasetId' });

DatasetIndex.hasMany(IndexColumn, { foreignKey: 'indexId', as: 'columns' });
IndexColumn.belongsTo(DatasetIndex, { foreignKey: 'indexId' });

Dataset.hasMany(DatasetProcessingJob, { foreignKey: 'datasetId', as: 'processingJobs' });
DatasetProcessingJob.belongsTo(Dataset, { foreignKey: 'datasetId' });

// Reports relationship - a dataset has many reports
Dataset.hasMany(Report, { foreignKey: 'datasetId', as: 'reports' });
Report.belongsTo(Dataset, { foreignKey: 'datasetId' });

module.exports = {
  sequelize,
  Dataset,
  DatasetColumn,
  DatasetIndex,
  IndexColumn,
  DatasetProcessingJob,
  Report // Export Report model
};