const { db } = require('../config/database');

async function getTeacherClasses(teacherId) {
  const [rows] = await db().query(
    'SELECT c.* FROM classes c JOIN teacher_classes tc ON tc.class_id=c.id WHERE tc.teacher_id=? ORDER BY CAST(c.id AS UNSIGNED), c.id',
    [teacherId],
  );
  return rows;
}

async function canAccessClass(user, classId) {
  if (user.role === 'admin') return true;
  const classes = await getTeacherClasses(user.teacher_id);
  return classes.some((c) => c.id === classId);
}

module.exports = { getTeacherClasses, canAccessClass };
