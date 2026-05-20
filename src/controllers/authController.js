const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const { loginPage } = require('../views/layout');

function showLogin(req, res) {
  res.send(loginPage());
}

async function login(req, res) {
  const user = await User.findOne({ username: req.body.username })
    .populate('teacher')
    .populate('student');

  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    return res.send(loginPage('Invalid username or password.'));
  }

  let classes = [];
  if (user.role === 'teacher' && user.teacher) {
    classes = user.teacher.classes || [];
  }

  req.session.user = {
    id: user._id,
    role: user.role,
    teacher_id: user.teacher ? user.teacher._id : null,
    student_id: user.student ? user.student._id : null,
    class_id: user.student ? user.student.class_id : null,
    display_name: user.display_name,
    subject: user.teacher ? user.teacher.subject : '',
    classes,
  };
  res.redirect('/dashboard');
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

module.exports = { showLogin, login, logout };
