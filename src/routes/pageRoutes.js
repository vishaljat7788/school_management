const express = require('express');
const pageController = require('../controllers/pageController');
const { requireAdmin, requireLogin, requireAdminOrTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));
router.get('/dashboard', requireLogin, pageController.dashboard);
router.get('/students', requireLogin, requireAdminOrTeacher, pageController.students);
router.post('/students', requireLogin, requireAdmin, pageController.addStudent);
router.post('/students/:id', requireLogin, requireAdmin, pageController.updateStudent);
router.post('/students/:id/delete', requireLogin, requireAdmin, pageController.deleteStudent);
router.post('/classes', requireLogin, requireAdmin, pageController.addClass);
router.get('/teachers', requireLogin, requireAdminOrTeacher, pageController.teachers);
router.post('/teachers', requireLogin, requireAdmin, pageController.addTeacher);
router.post('/teachers/:id/edit', requireLogin, requireAdmin, pageController.updateTeacher);
router.post('/teachers/:id/disable', requireLogin, requireAdmin, pageController.toggleTeacher);
router.get('/attendance', requireLogin, requireAdminOrTeacher, pageController.attendance);
router.get('/attendance/export', requireLogin, requireAdminOrTeacher, pageController.exportAttendance);
router.post('/attendance', requireLogin, requireAdminOrTeacher, pageController.saveAttendance);
router.get('/fees', requireLogin, pageController.fees);
router.post('/fees/:id/edit', requireLogin, requireAdmin, pageController.updateFee);
router.get('/notice', requireLogin, pageController.notice);
router.post('/notice', requireLogin, requireAdmin, pageController.addNotice);
router.post('/notice/:id/delete', requireLogin, requireAdmin, pageController.deleteNotice);
router.get('/timetable', requireLogin, pageController.timetable);
router.post('/timetable', requireLogin, requireAdmin, pageController.addTimetable);
router.post('/timetable/:id/edit', requireLogin, requireAdmin, pageController.updateTimetable);
router.post('/timetable/:id/delete', requireLogin, requireAdmin, pageController.deleteTimetable);
router.get('/results', requireLogin, pageController.results);
router.get('/settings', requireLogin, requireAdmin, pageController.settings);
router.post('/settings', requireLogin, requireAdmin, pageController.saveSettings);

module.exports = router;
