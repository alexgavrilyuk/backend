// models/indexColumns.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const DatasetIndex = require('./datasetIndex');

const IndexColumn = sequelize.define('index_column', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  indexId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'index_id',
    references: {
      model: DatasetIndex,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  columnName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'column_name'
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  timestamps: false,
  underscored: true,
  indexes: [
    {
      name: 'idx_index_columns',
      fields: ['index_id']
    }
  ]
});

DatasetIndex.hasMany(IndexColumn, { foreignKey: 'index_id', as: 'columns' });
IndexColumn.belongsTo(DatasetIndex, { foreignKey: 'index_id' });

module.exports = IndexColumn;