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
 * Only ADMIN users can register ADMIN accounts.
 * Public registration is permitted for STUDENT and TEACHER accounts.
 */
async function registerUser({ name, email, password, role = 'STUDENT' }, requesterUser = null) {
  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }
  if (!email || !email.trim()) {
    throw new Error('Email is required');
  }
  if (!password) {
    throw new Error('Password is required');
  }

  const cleanEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Invalid email format');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const validRoles = ['ADMIN', 'TEACHER', 'STUDENT'];
  const requestedRole = (role || 'STUDENT').toUpperCase().trim();
  if (!validRoles.includes(requestedRole)) {
    throw new Error(`Role must be one of: ${validRoles.join(', ')}`);
  }

  // Privilege escalation prevention:
  // Non-ADMIN callers (or unauthenticated public registrations) cannot assign ADMIN role
  let finalRole = 'STUDENT';
  if (requestedRole === 'ADMIN') {
    if (!requesterUser || requesterUser.role !== 'ADMIN') {
      throw new Error(`Privilege escalation prevented: only administrators can create ADMIN accounts`);
    }
    finalRole = 'ADMIN';
  } else if (requestedRole === 'TEACHER') {
    finalRole = 'TEACHER';
  } else {
    finalRole = 'STUDENT';
  }

  const existing = await get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const id = 'usr_' + uuidv4().slice(0, 8);
  const passwordHash = await bcrypt.hash(password, 10);

  await run(
    'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [id, name.trim(), cleanEmail, passwordHash, finalRole]
  );

  const newUser = { id, name: name.trim(), email: cleanEmail, role: finalRole };
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
