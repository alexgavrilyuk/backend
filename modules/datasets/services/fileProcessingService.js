// modules/datasets/services/fileProcessingSerice.js

const { v4: uuidv4 } = require('uuid');
const { processCSV, processExcel } = require('../../fileProcessing');
const { downloadFile } = require('../../storage');
const { createBigQueryTable } = require('../../bigquery');
const db = require('../models');

/**
 * Process a dataset synchronously
 * @param {Object} data - Processing data including datasetId, userId, filePath, dataType
 * @returns {Promise<Object>} - Processing result
 */
async function processDataset(data) {
  const { datasetId, userId, filePath, dataType } = data;

  try {
    console.log(`Starting synchronous processing for dataset ${datasetId}`);

    // Create a processing job record for tracking
    await db.DatasetProcessingJob.create({
      id: uuidv4(),
      datasetId,
      status: 'processing',
      jobType: 'schema_extraction',
      startedAt: new Date()
    });

    // Download file from storage for processing
    console.log(`Downloading file from: ${filePath}`);
    const fileContent = await downloadFile(filePath);

    // Process file based on type
    let result;
    if (dataType === 'csv') {
      console.log('Processing CSV file');
      result = await processCSV(fileContent);
    } else if (dataType === 'excel') {
      console.log('Processing Excel file');
      result = await processExcel(fileContent);
    } else {
      throw new Error(`Unsupported file type: ${dataType}`);
    }

    const { columns, rowCount, data } = result;

    console.log(`Extracted ${columns.length} columns and ${rowCount} rows`);

    // Store column information in the database
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      await db.DatasetColumn.create({
        id: uuidv4(),
        datasetId,
        name: column.name,
        type: column.type,
        nullable: column.nullable,
        primaryKey: column.primaryKey || false,
        description: column.description || '',
        position: i
      });
    }

    // Get file stats (approximate size from buffer)
    const fileSizeBytes = fileContent.length;

    // Create BigQuery table for querying (if needed)
    try {
      console.log('Creating BigQuery table');
      await createBigQueryTable(datasetId, userId, columns, filePath, dataType);
    } catch (error) {
      console.error(`Error creating BigQuery table: ${error.message}`);
      // Continue even if BigQuery creation fails
    }

    // Update dataset with extracted information
    await db.Dataset.update({
      rowCount,
      columnCount: columns.length,
      fileSizeBytes,
      status: 'available',
      previewAvailable: true,
      updatedAt: new Date()
    }, {
      where: { id: datasetId }
    });

    // Mark job as completed
    await db.DatasetProcessingJob.update({
      status: 'completed',
      completedAt: new Date()
    }, {
      where: {
        datasetId,
        jobType: 'schema_extraction'
      }
    });

    console.log(`Dataset ${datasetId} processing completed successfully`);

    return {
      success: true,
      datasetId,
      rowCount,
      columnCount: columns.length
    };
  } catch (error) {
    console.error(`Error processing dataset ${datasetId}:`, error);

    // Update dataset with error status
    await db.Dataset.update({
      status: 'error',
      errorMessage: error.message
    }, {
      where: { id: datasetId }
    });

    // Update job with error status
    await db.DatasetProcessingJob.update({
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date()
    }, {
      where: {
        datasetId,
        jobType: 'schema_extraction'
      }
    });

    throw error;
  }
}

module.exports = {
  processDataset
};