// services/jobQueue.js

const Queue = require('bull');
const { processCSV } = require('./csvProcessor');
const { processExcel } = require('./excelProcessor');
const { downloadFile } = require('./storage');
const { createBigQueryTable } = require('./bigQueryService');
const db = require('../models');
const { v4: uuidv4 } = require('uuid');

// Create Redis connection
const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  }
};

// Create the processing queue
const dataProcessingQueue = new Queue('dataProcessing', redisConfig);

/**
 * Add a dataset processing job to the queue
 * @param {Object} data - Job data including datasetId, userId, filePath, dataType
 * @returns {Promise<Object>} - The job object
 */
async function addProcessingJob(data) {
  return await dataProcessingQueue.add('processDataset', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true
  });
}

// Process jobs in the queue
dataProcessingQueue.process('processDataset', async (job) => {
  const { datasetId, userId, filePath, dataType } = job.data;

  try {
    // Create a processing job record
    await db.DatasetProcessingJob.create({
      id: uuidv4(),
      datasetId,
      status: 'processing',
      jobType: 'schema_extraction',
      startedAt: new Date()
    });

    job.progress(10); // 10% complete

    // Download file from storage for processing
    const fileContent = await downloadFile(filePath);

    job.progress(30); // 30% complete

    // Process file based on type
    let result;
    if (dataType === 'csv') {
      result = await processCSV(fileContent);
    } else if (dataType === 'excel') {
      result = await processExcel(fileContent);
    } else {
      throw new Error(`Unsupported file type: ${dataType}`);
    }

    const { columns, rowCount, data } = result;

    job.progress(50); // 50% complete

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

    job.progress(70); // 70% complete

    // Get file stats (approximate size from buffer)
    const fileSizeBytes = fileContent.length;

    // Create BigQuery table for querying
    try {
      const bigQueryDetails = await createBigQueryTable(datasetId, userId, columns, filePath, dataType);
      console.log(`BigQuery table created for dataset ${datasetId}:`, bigQueryDetails);
    } catch (error) {
      console.error(`Error creating BigQuery table for dataset ${datasetId}:`, error);
      // Continue processing even if BigQuery creation fails
      // We'll mark the dataset as available but with a note about BigQuery
    }

    job.progress(90); // 90% complete

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

    job.progress(100); // 100% complete

    return { success: true, datasetId, rowCount, columnCount: columns.length };
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
});

// Handle failed jobs
dataProcessingQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error: ${err.message}`);
});

module.exports = {
  dataProcessingQueue,
  addProcessingJob
};