// core/utils/pagination.js

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request query object
 * @returns {Object} Parsed pagination parameters
 */
function parsePaginationParams(query) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;

  // Ensure reasonable limits
  const validatedLimit = Math.min(Math.max(limit, 1), 100);
  const validatedPage = Math.max(page, 1);

  // Calculate offset
  const offset = (validatedPage - 1) * validatedLimit;

  return {
    page: validatedPage,
    limit: validatedLimit,
    offset
  };
}

/**
 * Generate pagination metadata
 * @param {Object} params - Pagination parameters
 * @param {number} params.page - Current page
 * @param {number} params.limit - Items per page
 * @param {number} params.offset - Offset
 * @param {number} totalItems - Total number of items
 * @returns {Object} Pagination metadata
 */
function generatePaginationMetadata(params, totalItems) {
  const { page, limit } = params;

  const totalPages = Math.ceil(totalItems / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    currentPage: page,
    itemsPerPage: limit,
    totalItems,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
}

/**
 * Generate a sequelize options object for pagination
 * @param {Object} params - Pagination parameters
 * @returns {Object} Sequelize options object
 */
function getPaginationOptions(params) {
  return {
    limit: params.limit,
    offset: params.offset
  };
}

module.exports = {
  parsePaginationParams,
  generatePaginationMetadata,
  getPaginationOptions
};