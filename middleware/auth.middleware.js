const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const Student = require('../models/student.model');
const RevokedStaffToken = require('../models/revokedStaffToken.model');
module.exports = async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in' });
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if(decoded.role==='invigilator'&&await RevokedStaffToken.exists({digest:require('node:crypto').createHash('sha256').update(header.slice(7)).digest('hex')}))return res.status(401).json({error:'This station has signed out. Please sign in again.'});
    const Model = decoded.role === 'admin' ? Admin : decoded.role === 'student' ? Student : ['lecturer','invigilator'].includes(decoded.role) ? require('../models/staff.model') : null;
    const account = Model && await Model.findById(decoded.userId);
    if (!account || account.role !== decoded.role || account.status === 'archived' || (account.tokenVersion || 0) !== (decoded.tokenVersion || 0)) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
    if(account.mustChangePassword&&!['/staff/password','/staff/logout','/staff/me'].includes(req.originalUrl.split('?')[0]))return res.status(403).json({error:'Change your temporary password before continuing',code:'PASSWORD_CHANGE_REQUIRED'});
    req.user = { userId: account.id, role: account.role, adminType: account.adminType || null, tokenVersion: account.tokenVersion || 0 };
    req.account = account;
    next();
  } catch (error) {
    if (error.name?.includes('Token') || error.name === 'CastError') return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    next(error);
  }
};
