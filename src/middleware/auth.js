const TransportStudent = require('../models/TransportStudent');
const TransportTeacher = require('../models/TransportTeacher');
const Leave = require('../models/Leave');

async function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');

  if (req.session.user.role === 'admin') {
    try {
      const transportCount = await TransportStudent.countDocuments({ status: 'Pending' })
        + await TransportTeacher.countDocuments({ status: 'Pending' });
      const leaveCount = await Leave.countDocuments({ status: 'Pending' });
      req.pendingTransportCount = transportCount;
      req.pendingLeaveCount = leaveCount;
    } catch (err) {
      console.error('Failed to fetch pending counts in middleware:', err);
    }
  }

  next();
}

function requireAdmin(req, res, next) {
  if (req.session.user?.role !== 'admin') {
    req.session.flash = { type: 'danger', message: 'Admin access required.' };
    return res.redirect('/dashboard');
  }
  next();
}

function requireAdminOrTeacher(req, res, next) {
  const role = req.session.user?.role;
  if (role !== 'admin' && role !== 'teacher') {
    req.session.flash = { type: 'danger', message: 'Access denied.' };
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { requireLogin, requireAdmin, requireAdminOrTeacher };
