const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { loginPage } = require('../views/layout');
const { getTeacherClasses } = require('../services/teacherService');

function showLogin(req, res) {
  res.send(loginPage());
}

async function login(req, res) {
  const [rows] = await db().query(
    `SELECT u.*, t.subject, s.class_id AS student_class_id
     FROM users u
     LEFT JOIN teachers t ON t.id = u.teacher_id
     LEFT JOIN students s ON s.id = u.student_id
     WHERE u.username = ? LIMIT 1`,
    [req.body.username],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    return res.send(loginPage('Invalid username or password.'));
  }

  let classes = [];
  if (user.role === 'teacher') {
    classes = (await getTeacherClasses(user.teacher_id)).map((c) => c.id);
  }

  req.session.user = {
    id: user.id,
    role: user.role,
    teacher_id: user.teacher_id || null,
    student_id: user.student_id || null,
    class_id: user.student_class_id || null,
    display_name: user.display_name,
    subject: user.subject || '',
    classes,
  };
  res.redirect('/dashboard');
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

module.exports = { showLogin, login, logout };
