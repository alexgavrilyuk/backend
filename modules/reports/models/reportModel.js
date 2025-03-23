// modules/reports/models/reportModel.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../datasets/database');

/**
 * Report model - Stores metadata about generated reports
 */
const Report = sequelize.define('report', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'user_id'
  },
  datasetId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'dataset_id',
    references: {
      model: 'datasets',
      key: 'id'
    }
  },
  query: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  generatedSql: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'generated_sql'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'processing',
    validate: {
      isIn: [['processing', 'completed', 'error']]
    }
  },
  reportType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'standard',
    field: 'report_type'
  },
  visualizations: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON string of visualization specifications'
  },
  insights: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON string of insights extracted from data'
  },
  narrative: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Natural language explanation of report findings'
  },
  reportData: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'report_data',
    comment: 'JSON string of processed data for the report'
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
      name: 'idx_reports_user',
      fields: ['user_id']
    },
    {
      name: 'idx_reports_dataset',
      fields: ['dataset_id']
    },
    {
      name: 'idx_reports_status',
      fields: ['status']
    }
  ]
});

module.exports = Report;