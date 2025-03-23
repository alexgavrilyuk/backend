// tests/middleware/errorHandler.test.js

const {
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  asyncHandler,
  errorHandler
} = require('../../core/middleware');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('Custom Error Types', () => {
    test('ValidationError should have correct statusCode', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
    });

    test('AuthenticationError should have correct statusCode', () => {
      const error = new AuthenticationError('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication failed');
      expect(error.name).toBe('AuthenticationError');
    });

    test('ForbiddenError should have correct statusCode', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
      expect(error.name).toBe('ForbiddenError');
    });

    test('NotFoundError should have correct statusCode', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('asyncHandler', () => {
    test('should handle successful async functions', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const wrappedHandler = asyncHandler(mockHandler);

      await wrappedHandler(req, res, next);

      expect(mockHandler).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle errors in async functions', async () => {
      const error = new Error('Async error');
      const mockHandler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = asyncHandler(mockHandler);

      await wrappedHandler(req, res, next);

      expect(mockHandler).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('errorHandler', () => {
    test('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Invalid input'
      }));
    });

    test('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Authentication failed');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Authentication failed'
      }));
    });

    test('should handle general errors with 500 status', () => {
      const error = new Error('General error');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'General error'
      }));
    });

    test('should include details if provided', () => {
      const error = new Error('Error with details');
      error.details = { field: 'name', problem: 'too short' };

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        details: error.details
      }));
    });

    test('should include stack trace in development mode', () => {
      // Save original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;

      // Set to development
      process.env.NODE_ENV = 'development';

      const error = new Error('Error in development');
      error.stack = 'Stack trace';

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        stack: 'Stack trace'
      }));

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
