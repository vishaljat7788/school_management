const express = require('express');
const pageController = require('../controllers/pageController');
const transportController = require('../controllers/transportController');
const libraryController = require('../controllers/libraryController');
const homeworkController = require('../controllers/homeworkController');
const staffController = require('../controllers/staffController');
const resultsController = require('../controllers/resultsController');
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
router.get('/results', requireLogin, resultsController.results);
router.post('/results/manage', requireLogin, requireAdminOrTeacher, resultsController.manageResults);
router.get('/settings', requireLogin, requireAdmin, pageController.settings);
router.post('/settings', requireLogin, requireAdmin, pageController.saveSettings);

router.get('/transport', requireLogin, transportController.transport);
router.post('/transport', requireLogin, requireAdmin, transportController.addRoute);
router.post('/transport/assign', requireLogin, requireAdmin, transportController.assignStudent);
router.post('/transport/apply', requireLogin, transportController.applyRoute);
router.post('/transport/approve', requireLogin, requireAdmin, transportController.approveRoute);
router.post('/transport/reject', requireLogin, requireAdmin, transportController.rejectRoute);
router.post('/transport/delete-route', requireLogin, requireAdmin, transportController.deleteRoute);
router.post('/transport/remove-student', requireLogin, requireAdmin, transportController.removeStudent);

router.get('/library', requireLogin, libraryController.library);
router.post('/library', requireLogin, libraryController.addBook);
router.post('/library/issue', requireLogin, requireAdminOrTeacher, libraryController.issueBook);
router.post('/library/return/:id', requireLogin, requireAdminOrTeacher, libraryController.returnBook);

router.get('/homework', requireLogin, homeworkController.homework);
router.post('/homework', requireLogin, homeworkController.addHomework);

router.get('/staff', requireLogin, requireAdminOrTeacher, staffController.staff);

// Staff Leaves & Payroll endpoints
router.post('/staff/leave/apply', requireLogin, staffController.applyLeave);
router.post('/staff/leave/:id/approve', requireLogin, requireAdmin, staffController.approveLeave);
router.post('/staff/leave/:id/reject', requireLogin, requireAdmin, staffController.rejectLeave);

router.post('/staff/payroll/generate', requireLogin, requireAdmin, staffController.generatePayroll);
router.post('/staff/payroll/update', requireLogin, requireAdmin, staffController.updatePayroll);
router.post('/staff/payroll/toggle-status', requireLogin, requireAdmin, staffController.togglePayrollStatus);
router.post('/staff/payroll/delete', requireLogin, requireAdmin, staffController.deletePayroll);

module.exports = router;
