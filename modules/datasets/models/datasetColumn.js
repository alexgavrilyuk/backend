// modules/datasets/models/datasetColumns.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const Dataset = require('./dataset');

const DatasetColumn = sequelize.define('dataset_column', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  nullable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  primaryKey: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'primary_key'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_dataset_columns',
      fields: ['dataset_id']
    }
  ]
});

Dataset.hasMany(DatasetColumn, { foreignKey: 'dataset_id', as: 'columns' });
DatasetColumn.belongsTo(Dataset, { foreignKey: 'dataset_id' });

module.exports = DatasetColumn;