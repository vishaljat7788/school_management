function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
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
