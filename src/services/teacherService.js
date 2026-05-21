const Class = require('../models/Class');
const Teacher = require('../models/Teacher');

async function getTeacherClasses(teacherId) {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher || !teacher.classes || teacher.classes.length === 0) return [];
  const classes = await Class.find({ _id: { $in: teacher.classes } }).sort({ _id: 1 });
  return classes;
}

async function canAccessClass(user, classId) {
  if (user.role === 'admin' || user.role === 'teacher') return true;
  const classes = await getTeacherClasses(user.teacher_id);
  return classes.some((c) => String(c._id) === classId);
}

module.exports = { getTeacherClasses, canAccessClass };
