// modules/datasets/models/dataset.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const Dataset = sequelize.define('dataset', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dataType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'data_type'
  },
  filePath: {
    type: DataTypes.STRING(512),
    allowNull: false,
    field: 'file_path'
  },
  rowCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'row_count'
  },
  columnCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'column_count'
  },
  fileSizeBytes: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'file_size_bytes'
  },
  previewAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'preview_available'
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'processing',
    allowNull: false
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  },
  // New fields for context information
  context: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'context'
  },
  purpose: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'purpose'
  },
  source: {
    type: DataTypes.STRING(512),
    allowNull: true,
    field: 'source'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'notes'
  }
}, {
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_datasets_user',
      fields: ['user_id']
    }
  ]
});

module.exports = Dataset;