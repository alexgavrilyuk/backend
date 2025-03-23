// tests/middleware/auth.test.js

const jwt = require('jsonwebtoken');
const { middleware: authMiddleware } = require('../../modules/auth');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  test('should call next() for valid token', () => {
    const userId = 'test-user-id';
    const email = 'test@example.com';

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    req.headers.authorization = `Bearer ${token}`;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(userId);
    expect(req.user.email).toBe(email);
  });

  test('should return 401 if no token provided', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token format is invalid', () => {
    req.headers.authorization = 'InvalidTokenFormat';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is invalid', () => {
    req.headers.authorization = 'Bearer invalid.token.here';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid or expired token'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is expired', () => {
    const userId = 'test-user-id';
    const email = 'test@example.com';

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' } // Expired 1 hour ago
    );

    req.headers.authorization = `Bearer ${token}`;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid or expired token'
    });
    expect(next).not.toHaveBeenCalled();
  });
});
