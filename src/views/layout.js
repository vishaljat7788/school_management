const { e, initials } = require('../utils/format');

const pages = {
  dashboard: 'Dashboard',
  attendance: 'Attendance',
  students: 'Students',
  teachers: 'Teachers',
  timetable: 'Timetable',
  results: 'Results & Exams',
  fees: 'Fee Management',
  notice: 'Notice Board',
  settings: 'Settings',
};

function nav(user, active) {
  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';
  const isStudent = user.role === 'student';

  const items = [
    ['fa-home', 'Dashboard', 'dashboard', true],
    ['fa-clipboard-check', 'Attendance', 'attendance', isAdmin || isTeacher],
    ['fa-user-graduate', 'Students', 'students', isAdmin || isTeacher],
    ['fa-chalkboard-teacher', 'Teachers', 'teachers', isAdmin || isTeacher],
    ['fa-calendar-alt', 'Timetable', 'timetable', true],
    ['sep', 'Academics'],
    ['fa-chart-bar', 'Results', 'results', true],
    ['fa-rupee-sign', 'Fees', 'fees', isAdmin || isStudent],
    ['sep', 'Administration'],
    ['fa-bullhorn', 'Notice Board', 'notice', true],
    ['fa-cog', 'Settings', 'settings', isAdmin],
  ];
  return items.map((it) => {
    if (it[0] === 'sep') return `<div class="nav-section-label">${it[1]}</div>`;
    const disabled = !it[3];
    return `<a class="nav-item${active === it[2] ? ' active' : ''}${disabled ? ' disabled' : ''}" href="/${it[2]}">
      <i class="fas ${it[0]}"></i> ${it[1]}${disabled ? '<i class="fas fa-lock" style="margin-left:auto;font-size:11px;color:rgba(255,255,255,0.35);"></i>' : ''}
    </a>`;
  }).join('');
}

function roleLine(user) {
  if (user.role === 'admin') return 'Principal / Admin';
  if (user.role === 'teacher') return `${user.subject || ''} Teacher`;
  return `Student - Class ${user.class_id || ''}`;
}

function headerBadge(user) {
  if (user.role === 'admin') return { label: 'Admin', bg: '#e4f4ed', color: 'var(--success)' };
  if (user.role === 'teacher') return { label: `Teacher`, bg: '#e8f0fa', color: 'var(--primary-light)' };
  return { label: `Student`, bg: '#fdf3dc', color: '#a06a00' };
}

function portalLabel(user) {
  if (user.role === 'admin') return 'Admin Panel';
  if (user.role === 'teacher') return 'Teacher Portal';
  return 'Student Portal';
}

function layout(req, page, content) {
  const user = req.session.user;
  const flash = req.session.flash;
  delete req.session.flash;
  const rl = roleLine(user);
  const hb = headerBadge(user);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pages[page]} - Vidya Mandir</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<aside class="sidebar">
  <div class="sidebar-logo"><div class="logo-icon"><i class="fas fa-graduation-cap"></i></div><div class="logo-text"><h2>Vidya Mandir</h2><span>${portalLabel(user)}</span></div></div>
  <nav class="sidebar-nav">${nav(user, page)}</nav>
  <div class="sidebar-footer"><div class="sidebar-user"><div class="user-avatar">${initials(user.display_name)}</div><div class="user-info"><p>${e(user.display_name)}</p><span>${e(rl)}</span></div></div><a class="logout-btn" href="/logout"><i class="fas fa-sign-out-alt"></i> Logout</a></div>
</aside>
<div class="main" style="display:flex;">
  <header class="header">
    <div style="display:flex;align-items:center;gap:8px;"><div class="page-title">${pages[page]}</div><span class="role-badge-h" style="background:${hb.bg};color:${hb.color};">${e(hb.label)}</span></div>
    <div class="header-right"><div class="header-btn"><i class="fas fa-bell" style="font-size:15px;"></i><span class="notif-dot"></span></div><div style="display:flex;align-items:center;gap:10px;"><div class="profile-avatar">${initials(user.display_name)}</div><div><div style="font-size:13px;font-weight:600;">${e(user.display_name)}</div><div style="font-size:11px;color:var(--text3);">${e(rl)}</div></div></div></div>
  </header>
  <div class="content">
    ${flash ? `<div class="bp ${flash.type === 'danger' ? 'red' : flash.type === 'warning' ? 'gold' : 'green'}" style="margin-bottom:18px;">${e(flash.message)}</div>` : ''}
    ${content}
  </div>
</div>
</body>
</html>`;
}

function loginPage(message = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login - Vidya Mandir</title><link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"><link rel="stylesheet" href="/css/style.css"></head><body>
  <div id="loginScreen"><div class="login-box">
    <div class="login-logo"><div class="login-logo-icon"><i class="fas fa-graduation-cap"></i></div><div><h1>Vidya Mandir</h1><p>School Management System</p></div></div>
    ${message ? `<div class="bp red" style="margin-bottom:18px;">${e(message)}</div>` : ''}
    <div style="display:flex;gap:8px;margin-bottom:18px;">
      <button type="button" onclick="setRole('admin')" id="rbAdmin" class="role-tab active"><i class="fas fa-user-shield"></i> Admin</button>
      <button type="button" onclick="setRole('teacher')" id="rbTeacher" class="role-tab"><i class="fas fa-chalkboard-teacher"></i> Teacher</button>
      <button type="button" onclick="setRole('student')" id="rbStudent" class="role-tab"><i class="fas fa-user-graduate"></i> Student</button>
    </div>
    <form method="post" action="/login">
      <div class="lfg"><label>Username</label><input name="username" id="loginUser" value="admin" required autocomplete="username"></div>
      <div class="lfg"><label>Password</label><input type="password" name="password" id="loginPass" value="1234" required autocomplete="current-password"></div>
      <button class="login-btn"><i class="fas fa-sign-in-alt"></i> Login</button>
    </form>
    <div class="login-hint" id="loginHint">
      <b>Super Admin:</b> admin / 1234
    </div>
  </div></div>
  <script>
    const hints = {
      admin: '<b>Super Admin:</b> admin / 1234',
      teacher: '<b>Teacher:</b> ramesh.kumar / 1234',
      student: '<b>Student:</b> aarav.sharma / 1234',
    };
    const defaults = {
      admin: ['admin','1234'],
      teacher: ['ramesh.kumar','1234'],
      student: ['aarav.sharma','1234'],
    };
    function setRole(role) {
      document.querySelectorAll('.role-tab').forEach(b => b.classList.remove('active'));
      document.getElementById('rb' + role.charAt(0).toUpperCase() + role.slice(1)).classList.add('active');
      document.getElementById('loginHint').innerHTML = hints[role];
      document.getElementById('loginUser').value = defaults[role][0];
      document.getElementById('loginPass').value = defaults[role][1];
    }
  </script>
  <style>
    .role-tab { flex:1; padding:8px; border:1.5px solid var(--border,#dde3ec); border-radius:8px; background:#fff; cursor:pointer; font-family:inherit; font-size:12px; font-weight:600; color:var(--text2,#555); transition:all .2s; }
    .role-tab.active { background:var(--primary,#2a5a8c); color:#fff; border-color:var(--primary,#2a5a8c); }
    .role-tab i { margin-right:4px; }
  </style>
</body></html>`;
}

function modal(id, title, body) {
  return `<div class="modal-overlay" id="${id}"><div class="modal"><div class="modal-header"><div class="modal-title">${title}</div><span class="modal-close" onclick="document.getElementById('${id}').classList.remove('open')"><i class="fas fa-times"></i></span></div>${body}</div></div>`;
}

module.exports = { layout, loginPage, modal };
