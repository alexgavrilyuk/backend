// modules/datasets/models/datasetProcessingJobs.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const Dataset = require('./dataset');

const DatasetProcessingJob = sequelize.define('dataset_processing_job', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  datasetId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'dataset_id',
    references: {
      model: Dataset,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  jobType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'job_type'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'started_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  }
}, {
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_dataset_processing_jobs',
      fields: ['dataset_id']
    }
  ]
});

Dataset.hasMany(DatasetProcessingJob, { foreignKey: 'dataset_id', as: 'processingJobs' });
DatasetProcessingJob.belongsTo(Dataset, { foreignKey: 'dataset_id' });

module.exports = DatasetProcessingJob;