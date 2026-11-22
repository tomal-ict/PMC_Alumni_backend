import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const requireAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing or invalid.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pmc_alumni_super_secure_jwt_secret_key_2026_x89a!$#');
    
    // Fetch fresh user record
    const users = await query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.mobile, u.created_at,
              a.id as alumni_id, a.batch_id, a.department_id, a.passing_year_id,
              a.company as company_name, a.company_designation as designation
       FROM users u
       LEFT JOIN alumnus a ON u.id = a.user_id
       WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
      [decoded.id]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or deactivated.'
      });
    }

    const user = users[0];
    if (user.role === 1 || user.role === 3) {
      user.status = 1;
    }
    if (user.status !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Account is pending approval or suspended.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.'
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  // Role 1 is Admin, Role 3 is Super Admin
  if (req.user.role === 1 || req.user.role === 3) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Admin privileges required.'
  });
};

export const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pmc_alumni_super_secure_jwt_secret_key_2026_x89a!$#');
      const users = await query('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [decoded.id]);
      if (users.length > 0) {
        req.user = users[0];
      }
    }
  } catch (e) {
    // Ignore optional auth error
  }
  next();
};
