import jwt from 'jsonwebtoken';
import { query } from './db.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission for this action.' });
  next();
};
export async function audit(req, action, entityType, entityId = '', details = {}) {
  try {
    await query(
      'INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details, ip_address) VALUES($1,$2,$3,$4,$5,$6)',
      [req.user?.id || null, action, entityType, String(entityId), JSON.stringify(details), req.ip || '']
    );
  } catch (e) { console.error('Audit write failed:', e.message); }
}
