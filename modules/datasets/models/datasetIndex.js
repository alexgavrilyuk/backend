// modules/datasets/models/datasetIndexes.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const Dataset = require('./dataset');

const DatasetIndex = sequelize.define('dataset_index', {
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
  uniqueIndex: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'unique_index'
  }
}, {
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_dataset_indexes',
      fields: ['dataset_id']
    }
  ]
});

Dataset.hasMany(DatasetIndex, { foreignKey: 'dataset_id', as: 'indexes' });
DatasetIndex.belongsTo(Dataset, { foreignKey: 'dataset_id' });

module.exports = DatasetIndex;