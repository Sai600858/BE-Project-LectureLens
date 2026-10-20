const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./db');

if (!process.env.JWT_SECRET) {
  console.warn('[Auth] WARNING: JWT_SECRET is not set in server/.env. Using a random secret — all tokens will be invalidated on server restart. Set JWT_SECRET in .env for persistence.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'lecturelens_secure_persistent_key_2026_super_secret';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token string
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Express Middleware: Require valid JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }

  req.user = decoded;
  next();
}

/**
 * Express Middleware: Optional JWT token (attaches user if present)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) req.user = decoded;
  }
  next();
}

/**
 * Express Middleware: Require specific role(s)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: requires one of [${allowedRoles.join(', ')}] role`,
      });
    }
    next();
  };
}

/**
 * Register a new user
 */
async function registerUser({ name, email, password, role = 'STUDENT' }) {
  if (!name || !email || !password) {
    throw new Error('Name, email, and password are required');
  }

  const validRoles = ['ADMIN', 'TEACHER', 'STUDENT'];
  const normalizedRole = role.toUpperCase();
  if (!validRoles.includes(normalizedRole)) {
    throw new Error(`Role must be one of: ${validRoles.join(', ')}`);
  }

  const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const id = 'usr_' + uuidv4().slice(0, 8);
  const passwordHash = await bcrypt.hash(password, 10);

  await run(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [id, name.trim(), email.toLowerCase().trim(), passwordHash, normalizedRole]
  );

  const newUser = { id, name: name.trim(), email: email.toLowerCase().trim(), role: normalizedRole };
  const token = generateToken(newUser);

  return { user: newUser, token };
}

/**
 * Login user
 */
async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new Error('Invalid email or password');
  }

  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const token = generateToken(userData);
  return { user: userData, token };
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  optionalAuth,
  requireRole,
  registerUser,
  loginUser,
};
