// modules/datasets/controller.js

const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const db = require('./models');
const { uploadFile, deleteFile } = require('../storage');
const { utils: fileProcessingUtils } = require('../fileProcessing');
const { processDataset } = require('./services/fileProcessingService');
const { deleteBigQueryTable, runBigQueryQuery, updateTableSchema } = require('../bigquery');
const { ValidationError, NotFoundError, asyncHandler } = require('../../core/middleware');

/**
 * Upload a new dataset
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const uploadDataset = asyncHandler(async (req, res) => {
  // Validate request
  if (!req.files || !req.files.file) {
    throw new ValidationError('No file provided');
  }

  const { name, description, dataType } = req.body;
  const file = req.files.file;
  const userId = req.user.id;

  // Validate required parameters
  if (!name || !dataType) {
    throw new ValidationError('Missing required fields: name and dataType are required');
  }

  // Validate supported data types
  if (!['csv', 'excel'].includes(dataType)) {
    throw new ValidationError('Unsupported data type. Supported types: csv, excel');
  }

  // Validate file
  const fileValidation = fileProcessingUtils.validateFile(file);
  if (!fileValidation.valid) {
    throw new ValidationError(fileValidation.error);
  }

  // Validate file extension matches specified data type
  const fileExtension = file.name.split('.').pop().toLowerCase();
  if ((dataType === 'csv' && fileExtension !== 'csv') ||
      (dataType === 'excel' && !['xls', 'xlsx'].includes(fileExtension))) {
    throw new ValidationError('File type does not match specified data type');
  }

  // Generate a unique ID for the dataset
  const datasetId = uuidv4();

  // Create dataset record in database
  const dataset = await db.Dataset.create({
    id: datasetId,
    userId,
    name,
    description,
    dataType,
    filePath: `users/${userId}/datasets/${datasetId}/${file.name}`,
    status: 'processing'
  });

  // Upload file to Google Cloud Storage
  const gcsFileName = `users/${userId}/datasets/${datasetId}/${file.name}`;

  await uploadFile(file.data, gcsFileName, {
    contentType: file.mimetype,
    datasetId,
    originalName: file.name,
    uploadedBy: userId
  });

  try {
    // Process file synchronously instead of using a job queue
    await processDataset({
      datasetId,
      userId,
      filePath: gcsFileName,
      dataType
    });

    // Get the updated dataset after processing
    const updatedDataset = await db.Dataset.findOne({
      where: { id: datasetId }
    });

    // Return response to client
    return res.status(201).json({
      success: true,
      message: 'Dataset uploaded and processed successfully',
      datasetId,
      dataset: {
        id: datasetId,
        name,
        description,
        dataType,
        status: updatedDataset.status,
        rowCount: updatedDataset.rowCount,
        columnCount: updatedDataset.columnCount,
        createdAt: dataset.createdAt,
        updatedAt: updatedDataset.updatedAt
      }
    });
  } catch (error) {
    console.error('Error processing dataset:', error);

    // Still return a success for the upload, but mention processing error
    return res.status(201).json({
      success: true,
      message: 'Dataset uploaded but processing encountered an error: ' + error.message,
      datasetId,
      dataset: {
        id: datasetId,
        name,
        description,
        dataType,
        status: 'error',
        createdAt: dataset.createdAt,
        updatedAt: dataset.updatedAt
      }
    });
  }
});

/**
 * Get all datasets for a user
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getUserDatasets = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get all datasets for the user
  const datasets = await db.Dataset.findAll({
    where: { userId },
    order: [['updated_at', 'DESC']]  // FIXED: Changed from 'updatedAt' to 'updated_at'
  });

  // Format response
  const formattedDatasets = datasets.map(dataset => ({
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    dataType: dataset.dataType,
    status: dataset.status,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    fileSizeMB: dataset.fileSizeBytes ? (dataset.fileSizeBytes / (1024 * 1024)).toFixed(2) : null,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
    previewAvailable: dataset.previewAvailable
  }));

  return res.status(200).json({
    success: true,
    datasets: formattedDatasets
  });
});

/**
 * Get a single dataset
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getDataset = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.id;

  // Get dataset
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId }
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found');
  }

  // Format response - ensure context fields are never null
  const formattedDataset = {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    dataType: dataset.dataType,
    status: dataset.status,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    fileSizeMB: dataset.fileSizeBytes ? (dataset.fileSizeBytes / (1024 * 1024)).toFixed(2) : null,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
    previewAvailable: dataset.previewAvailable,
    // Ensure context fields are never null
    context: dataset.context || '',
    purpose: dataset.purpose || '',
    source: dataset.source || '',
    notes: dataset.notes || ''
  };

  return res.status(200).json({
    success: true,
    dataset: formattedDataset
  });
});

/**
 * Delete a dataset
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const deleteDataset = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.id;

  // Get dataset to check ownership
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId }
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found');
  }

  // Begin transaction
  const transaction = await db.sequelize.transaction();

  try {
    // Delete from BigQuery if enabled
    try {
      await deleteBigQueryTable(datasetId, userId);
    } catch (error) {
      console.error(`Error deleting BigQuery table for dataset ${datasetId}:`, error);
      // Continue with deletion even if BigQuery deletion fails
    }

    // Delete file from Google Cloud Storage
    const filePrefix = `users/${userId}/datasets/${datasetId}/`;
    await deleteFile(filePrefix, true); // true = is directory

    // Delete dataset and related records from database
    await db.Dataset.destroy({
      where: { id: datasetId },
      transaction
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Dataset deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get dataset schema
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getDatasetSchema = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.id;

  // Check dataset exists and belongs to user
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId }
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found');
  }

  // Get columns
  const columns = await db.DatasetColumn.findAll({
    where: { datasetId },
    order: [['position', 'ASC']]
  });

  // Get indexes
  const indexes = await db.DatasetIndex.findAll({
    where: { datasetId },
    include: [{
      model: db.IndexColumn,
      as: 'columns'
    }]
  });

  // Format indexes
  const formattedIndexes = indexes.map(index => ({
    name: index.name,
    columns: index.columns.map(col => col.columnName),
    unique: index.uniqueIndex
  }));

  // Find primary key columns
  const primaryKeyColumns = columns
    .filter(col => col.primaryKey)
    .map(col => col.name);

  // Format columns
  const formattedColumns = columns.map(column => ({
    name: column.name,
    type: column.type,
    nullable: column.nullable,
    primaryKey: column.primaryKey,
    description: column.description
  }));

  return res.status(200).json({
    success: true,
    schema: {
      columns: formattedColumns,
      primaryKey: primaryKeyColumns.length === 1 ? primaryKeyColumns[0] : primaryKeyColumns,
      indexes: formattedIndexes
    }
  });
});

/**
 * Update dataset details
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const updateDataset = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.id;
  const { name, description, context, purpose, source, notes } = req.body;

  // Check dataset exists and belongs to user
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId }
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found');
  }

  // Begin transaction for data consistency
  const transaction = await db.sequelize.transaction();

  try {
    // Use direct SQL query to ensure proper column names with underscored model
    await db.sequelize.query(
      `UPDATE datasets
       SET name = :name,
           description = :description,
           context = :context,
           purpose = :purpose,
           source = :source,
           notes = :notes,
           updated_at = NOW()
       WHERE id = :datasetId AND user_id = :userId`,
      {
        replacements: {
          name: name !== undefined ? name : dataset.name,
          description: description !== undefined ? description : dataset.description,
          context: context !== undefined ? context : (dataset.context || ''),
          purpose: purpose !== undefined ? purpose : (dataset.purpose || ''),
          source: source !== undefined ? source : (dataset.source || ''),
          notes: notes !== undefined ? notes : (dataset.notes || ''),
          datasetId,
          userId
        },
        type: db.sequelize.QueryTypes.UPDATE,
        transaction
      }
    );

    // Commit transaction
    await transaction.commit();

    // Get updated dataset with fresh query to ensure we get the latest data
    const refreshedDataset = await db.Dataset.findOne({
      where: { id: datasetId }
    });

    // Format response - ensure context fields are never null
    const formattedDataset = {
      id: refreshedDataset.id,
      name: refreshedDataset.name,
      description: refreshedDataset.description,
      dataType: refreshedDataset.dataType,
      status: refreshedDataset.status,
      rowCount: refreshedDataset.rowCount,
      columnCount: refreshedDataset.columnCount,
      fileSizeMB: refreshedDataset.fileSizeBytes ? (refreshedDataset.fileSizeBytes / (1024 * 1024)).toFixed(2) : null,
      createdAt: refreshedDataset.createdAt,
      updatedAt: refreshedDataset.updatedAt,
      previewAvailable: refreshedDataset.previewAvailable,
      context: refreshedDataset.context || '',
      purpose: refreshedDataset.purpose || '',
      source: refreshedDataset.source || '',
      notes: refreshedDataset.notes || ''
    };

    return res.status(200).json({
      success: true,
      message: 'Dataset updated successfully',
      dataset: formattedDataset
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('Error updating dataset:', error);
    throw error;
  }
});

/**
 * Update dataset schema (column types and descriptions)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */

const updateDatasetSchema = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  const { columns } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!columns || !Array.isArray(columns)) {
    throw new ValidationError('Invalid schema data: columns must be an array');
  }

  // Add debug logging to track the input data
  console.log('Updating schema for dataset:', datasetId);
  console.log('Column updates:', JSON.stringify(columns, null, 2));

  // Retrieve the dataset with its columns
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId },
    include: [{
      model: db.DatasetColumn,
      as: 'columns'
    }]
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found');
  }

  // Check if dataset is available for updates
  if (dataset.status !== 'available') {
    throw new ValidationError(`Dataset is not available for schema updates (current status: ${dataset.status})`);
  }

  // Start a transaction to ensure consistency
  const transaction = await db.sequelize.transaction();

  try {
    // Keep track of columns that have type changes
    const columnsWithTypeChanges = [];

    // Update column information in database
    for (const columnUpdate of columns) {
      const { name, type, description } = columnUpdate;

      if (!name) {
        await transaction.rollback();
        throw new ValidationError('Column name is required for each column update');
      }

      // Find the matching column in the dataset
      const column = dataset.columns.find(c => c.name === name);

      if (!column) {
        await transaction.rollback();
        throw new ValidationError(`Column "${name}" not found in dataset`);
      }

      // Check if type is valid when provided
      if (type && !['string', 'integer', 'float', 'date', 'boolean'].includes(type.toLowerCase())) {
        await transaction.rollback();
        throw new ValidationError(`Invalid column type: ${type}. Supported types are: string, integer, float, date, boolean`);
      }

      // Track if there's a type change
      if (type && type.toLowerCase() !== column.type.toLowerCase()) {
        columnsWithTypeChanges.push({
          name,
          oldType: column.type,
          newType: type.toLowerCase()
        });
      }

      // Log what we're updating
      console.log(`Updating column ${name}:
        - Original type: ${column.type}
        - New type: ${type || column.type}
        - Original description: ${column.description || '(none)'}
        - New description: ${description !== undefined ? description : '(unchanged)'}`);

      // Fix: Explicitly save description even if it's an empty string
      // Update the column in database using direct SQL update to ensure descriptions are properly saved
      await db.sequelize.query(
        `UPDATE dataset_columns
         SET type = ?, description = ?, updated_at = NOW()
         WHERE id = ?`,
        {
          replacements: [
            type ? type.toLowerCase() : column.type,
            description !== undefined ? description : column.description,
            column.id
          ],
          transaction
        }
      );
    }

    // If there are type changes, update BigQuery table schema
    if (columnsWithTypeChanges.length > 0) {
      try {
        // Get all dataset columns with updated info
        const updatedColumns = await db.DatasetColumn.findAll({
          where: { datasetId },
          order: [['position', 'ASC']],
          transaction
        });

        // Update BigQuery table schema
        await updateTableSchema(datasetId, userId, updatedColumns);
      } catch (bqError) {
        // If BigQuery update fails, rollback and report error
        await transaction.rollback();
        console.error(`Error updating BigQuery schema for dataset ${datasetId}:`, bqError);
        throw new Error(`Failed to update BigQuery schema: ${bqError.message}`);
      }
    }

    // Commit transaction
    await transaction.commit();

    // Fetch the updated schema with a fresh query to ensure we get the latest data
    const updatedDataset = await db.Dataset.findOne({
      where: { id: datasetId },
      include: [{
        model: db.DatasetColumn,
        as: 'columns',
        order: [['position', 'ASC']]
      }]
    });

    console.log('Updated columns after save:', JSON.stringify(updatedDataset.columns.map(c => ({
      name: c.name,
      type: c.type,
      description: c.description
    })), null, 2));

    // Format and return the updated schema
    const formattedColumns = updatedDataset.columns.map(column => ({
      name: column.name,
      type: column.type,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      description: column.description || '',
      position: column.position
    }));

    return res.status(200).json({
      success: true,
      message: 'Schema updated successfully',
      schema: {
        columns: formattedColumns,
        primaryKey: updatedDataset.columns
          .filter(col => col.primaryKey)
          .map(col => col.name)
      }
    });
  } catch (error) {
    // If transaction wasn't already rolled back
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Error updating schema:', error);
    throw error;
  }
});

/**
 * Update dataset context information
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const updateDatasetContext = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.id;

  // Log the complete raw request body to see everything being sent
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));

  // Extract fields from request body
  const { context, purpose, source, notes } = req.body;

  // Add debug logging
  console.log('Updating context for dataset:', datasetId);
  console.log('Context updates provided:', JSON.stringify({
    context: context !== undefined ? context : 'undefined',
    purpose: purpose !== undefined ? purpose : 'undefined',
    source: source !== undefined ? source : 'undefined',
    notes: notes !== undefined ? notes : 'undefined'
  }, null, 2));

  // Retrieve the dataset
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId }
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found');
  }

  // Try using direct SQL query instead of Sequelize ORM to update all fields
  try {
    // Use raw SQL query to ensure all fields are updated properly
    // This bypasses any Sequelize behavior that might be affecting field updates
    await db.sequelize.query(
      `UPDATE datasets
       SET context = :context,
           purpose = :purpose,
           source = :source,
           notes = :notes,
           updated_at = NOW()
       WHERE id = :datasetId AND user_id = :userId`,
      {
        replacements: {
          context: context !== undefined ? context : dataset.context,
          purpose: purpose !== undefined ? purpose : dataset.purpose,
          source: source !== undefined ? source : dataset.source,
          notes: notes !== undefined ? notes : dataset.notes,
          datasetId,
          userId
        },
        type: db.sequelize.QueryTypes.UPDATE
      }
    );

    console.log('Direct SQL update completed');

    // Fetch the updated dataset to verify changes
    const updatedDataset = await db.Dataset.findOne({
      where: { id: datasetId }
    });

    console.log('Updated dataset from database:', JSON.stringify({
      context: updatedDataset.context,
      purpose: updatedDataset.purpose,
      source: updatedDataset.source,
      notes: updatedDataset.notes
    }, null, 2));

    // Return updated dataset
    return res.status(200).json({
      success: true,
      message: 'Dataset context updated successfully',
      dataset: {
        id: updatedDataset.id,
        name: updatedDataset.name,
        description: updatedDataset.description,
        dataType: updatedDataset.dataType,
        status: updatedDataset.status,
        createdAt: updatedDataset.createdAt,
        updatedAt: updatedDataset.updatedAt,
        context: updatedDataset.context || '',
        purpose: updatedDataset.purpose || '',
        source: updatedDataset.source || '',
        notes: updatedDataset.notes || ''
      }
    });
  } catch (error) {
    console.error('Error performing direct SQL update:', error);
    throw error;
  }
});

/**
 * Get dataset preview data
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getDatasetPreview = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Cap at 1000 rows
  const userId = req.user.id;

  // Validate dataset belongs to user
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, userId }
  });

  if (!dataset) {
    throw new NotFoundError('Dataset not found');
  }

  // Check if dataset is available
  if (dataset.status !== 'available') {
    throw new ValidationError(`Dataset is not available for preview (current status: ${dataset.status})`);
  }

  try {
    // Construct a query to fetch preview data from BigQuery
    const bqDatasetName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const bqTableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const previewQuery = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${bqDatasetName}.${bqTableId}\`
      LIMIT ${limit}
    `;

    // Execute the query
    const queryResult = await runBigQueryQuery(userId, previewQuery);

    return res.status(200).json({
      success: true,
      preview: queryResult.rows
    });
  } catch (error) {
    console.error(`Error fetching preview data for dataset ${datasetId}:`, error);
    throw new Error(`Failed to fetch preview data: ${error.message}`);
  }
});

module.exports = {
  uploadDataset,
  getUserDatasets,
  getDataset,
  deleteDataset,
  getDatasetSchema,
  updateDataset,
  updateDatasetSchema,
  updateDatasetContext,
  getDatasetPreview
};