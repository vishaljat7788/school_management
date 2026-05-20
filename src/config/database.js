require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import all models
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Timetable = require('../models/Timetable');
const Setting = require('../models/Setting');
const TransportRoute = require('../models/TransportRoute');
const TransportStudent = require('../models/TransportStudent');
const TransportTeacher = require('../models/TransportTeacher');
const LibraryBook = require('../models/LibraryBook');
const LibraryIssue = require('../models/LibraryIssue');
const Homework = require('../models/Homework');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');

async function initDb() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');
  
  const count = await Class.countDocuments();
  if (count === 0) {
    console.log('Seeding database...');
    await seed();
    console.log('Seeding complete!');
  }
}

function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${s}`;
}

async function seed() {
  const colors = ['#2a5a8c','#e8a020','#1e7d5a','#7d1a8c','#c0392b','#3a3a9a','#8c5a1a','#8c1a7d','#0f766e','#b45309','#4338ca','#be123c'];
  
  // 1. Classes
  for (let i = 1; i <= 12; i++) {
    await Class.create({ _id: String(i), label: ordinal(i), color: colors[i - 1] });
  }

  // 2. Teachers
  const teacherData = [
    { name: 'Ramesh Kumar', subject: 'Mathematics', qualification: 'M.Sc., B.Ed.', experience_years: 12, classes: ['10'], bg_color: '#e8f0fa', text_color: '#1a5da0' },
    { name: 'Priya Sharma', subject: 'Science', qualification: 'M.Sc., B.Ed.', experience_years: 8, classes: ['9'], bg_color: '#e4f4ed', text_color: '#1e7d5a' },
    { name: 'Anita Singh', subject: 'English', qualification: 'M.A., B.Ed.', experience_years: 15, classes: ['8'], bg_color: '#fdf3dc', text_color: '#a06a00' },
    { name: 'Suresh Patel', subject: 'Hindi', qualification: 'M.A., B.Ed.', experience_years: 10, classes: ['7'], bg_color: '#fcecea', text_color: '#c0392b' },
    { name: 'Kavita Jain', subject: 'Social Science', qualification: 'M.A., B.Ed.', experience_years: 7, classes: ['10'], bg_color: '#f3e8fa', text_color: '#7d1a8c' },
    { name: 'Rajesh Verma', subject: 'Computer', qualification: 'MCA, B.Ed.', experience_years: 5, classes: ['9'], bg_color: '#e8e8fa', text_color: '#3a3a9a' },
    { name: 'Deepa Mishra', subject: 'Mathematics', qualification: 'M.Sc., B.Ed.', experience_years: 9, classes: ['8', '9'], bg_color: '#fae8fa', text_color: '#8c1a7d' },
  ];
  const teachers = await Teacher.insertMany(teacherData);

  // 3. Hash password
  const hash = await bcrypt.hash('1234', 10);

  // 4. Admin user
  await User.create({ role: 'admin', username: 'admin', password_hash: hash, display_name: 'Admin' });

  // 5. Teacher users
  for (const t of teachers) {
    await User.create({
      role: 'teacher',
      username: t.name.toLowerCase().replace(/\s+/g, '.'),
      password_hash: hash,
      teacher: t._id,
      display_name: t.name,
    });
  }

  // 6. Students
  const studentData = [
    { name: 'Aarav Sharma', roll_no: '#1001', class_id: '10', gender: 'Male', phone: '98765 43210', fee_status: 'Paid' },
    { name: 'Priya Singh', roll_no: '#1002', class_id: '9', gender: 'Female', phone: '87654 32109', fee_status: 'Paid' },
    { name: 'Rohan Kumar', roll_no: '#1003', class_id: '8', gender: 'Male', phone: '76543 21098', fee_status: 'Pending' },
    { name: 'Ananya Patel', roll_no: '#1004', class_id: '10', gender: 'Female', phone: '65432 10987', fee_status: 'Paid' },
    { name: 'Karan Malhotra', roll_no: '#1005', class_id: '9', gender: 'Male', phone: '54321 09876', fee_status: 'Overdue' },
    { name: 'Meera Gupta', roll_no: '#1006', class_id: '7', gender: 'Female', phone: '43210 98765', fee_status: 'Paid' },
    { name: 'Arjun Verma', roll_no: '#1007', class_id: '10', gender: 'Male', phone: '32109 87654', fee_status: 'Paid' },
    { name: 'Sneha Joshi', roll_no: '#1008', class_id: '8', gender: 'Female', phone: '21098 76543', fee_status: 'Pending' },
    { name: 'Aryan Rajput', roll_no: '#1009', class_id: '10', gender: 'Male', phone: '90876 54321', fee_status: 'Paid' },
    { name: 'Deepika Rao', roll_no: '#1010', class_id: '10', gender: 'Female', phone: '88776 65544', fee_status: 'Paid' },
  ];
  const students = await Student.insertMany(studentData);

  // 7. Student users & fees
  for (const s of students) {
    await User.create({
      role: 'student',
      username: s.name.toLowerCase().replace(/\s+/g, '.'),
      password_hash: hash,
      student: s._id,
      display_name: s.name,
    });
    const paid = s.fee_status === 'Paid' ? 12500 : (s.fee_status === 'Pending' ? 6500 : 0);
    await Fee.create({ student: s._id, amount: 12500, paid_amount: paid, status: s.fee_status, paid_date: new Date() });
  }

  // 8. Notices
  await Notice.insertMany([
    { title: 'Half-Yearly Examination Schedule Released', audience: 'All Classes', notice_date: new Date('2026-05-01'), type: 'exam' },
    { title: 'Annual Sports Day - 20 May 2026', audience: 'All Classes', notice_date: new Date('2026-04-28'), type: 'event' },
    { title: 'Last Date for Fee Submission - 15 May', audience: 'All Classes', notice_date: new Date('2026-04-25'), type: 'fee' },
    { title: 'Parent-Teacher Meeting - Saturday, 18 May', audience: 'Class X, IX', notice_date: new Date('2026-04-22'), type: 'meeting' },
  ]);

  // 9. Timetable
  await Timetable.insertMany([
    { class_id: '10', start_time: '08:00', end_time: '08:45', monday: 'Morning Assembly', tuesday: 'Morning Assembly', wednesday: 'Morning Assembly', thursday: 'Morning Assembly', friday: 'Morning Assembly', saturday: 'Morning Assembly' },
    { class_id: '10', start_time: '08:45', end_time: '09:30', monday: 'Maths', tuesday: 'English', wednesday: 'Science', thursday: 'Hindi', friday: 'Maths', saturday: 'S.Sc' },
    { class_id: '10', start_time: '09:30', end_time: '10:15', monday: 'Science', tuesday: 'Maths', wednesday: 'English', thursday: 'Science', friday: 'Hindi', saturday: 'Computer' },
    { class_id: '10', start_time: '10:15', end_time: '10:30', monday: 'Short Break', tuesday: 'Short Break', wednesday: 'Short Break', thursday: 'Short Break', friday: 'Short Break', saturday: 'Short Break' },
    { class_id: '10', start_time: '10:30', end_time: '11:15', monday: 'Hindi', tuesday: 'S.Sc', wednesday: 'Maths', thursday: 'Computer', friday: 'English', saturday: 'Art' },
    { class_id: '10', start_time: '12:00', end_time: '12:30', monday: 'Lunch Break', tuesday: 'Lunch Break', wednesday: 'Lunch Break', thursday: 'Lunch Break', friday: 'Lunch Break', saturday: 'Lunch Break' },
  ]);

  // 10. Results for Aryan Rajput
  const aryan = students.find(s => s.name === 'Aryan Rajput');
  await Result.insertMany([
    { student: aryan._id, exam_name: 'Half-Yearly', subject: 'Mathematics', marks_obtained: 87, total_marks: 100, grade: 'A' },
    { student: aryan._id, exam_name: 'Half-Yearly', subject: 'Science', marks_obtained: 91, total_marks: 100, grade: 'A+' },
    { student: aryan._id, exam_name: 'Half-Yearly', subject: 'English', marks_obtained: 79, total_marks: 100, grade: 'B+' },
  ]);

  // 11. Settings
  const settings = {
    school_name: 'Vidya Mandir Higher Secondary School',
    board: 'CBSE',
    school_code: 'VM-2026-GJ',
    principal: 'Dr. Anita Sharma',
    phone: '+91 79 2234 5678',
    address: '123, Education Road, Satellite, Ahmedabad, Gujarat - 380015',
  };
  for (const [key, value] of Object.entries(settings)) {
    await Setting.create({ _id: key, svalue: value });
  }

  // 12. Transport
  const routes = await TransportRoute.insertMany([
    { route_name: 'Satellite - SG Highway', vehicle_no: 'GJ-01-AB-1234', driver_name: 'Mohan Lal', driver_phone: '99887 76655', fee: 1500 },
    { route_name: 'Maninagar - Paldi', vehicle_no: 'GJ-01-CD-5678', driver_name: 'Raju Bhai', driver_phone: '99776 65544', fee: 1200 },
  ]);
  await TransportStudent.insertMany([
    { student: students[0]._id, route: routes[0]._id, stop_name: 'SG Highway Circle', status: 'Approved' },
    { student: students[1]._id, route: routes[1]._id, stop_name: 'Paldi Cross Road', status: 'Approved' },
  ]);

  // 13. Library
  const books = await LibraryBook.insertMany([
    { title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', isbn: '978-0262033848', total_copies: 3, available_copies: 2 },
    { title: 'Physics for Class X', author: 'S.L. Arora', isbn: '978-8121924856', total_copies: 5, available_copies: 4 },
  ]);
  await LibraryIssue.insertMany([
    { book: books[0]._id, student: students[0]._id, issue_date: new Date(), due_date: new Date(Date.now() + 14 * 86400000), status: 'Issued' },
    { book: books[1]._id, student: students[2]._id, issue_date: new Date(Date.now() - 7 * 86400000), due_date: new Date(Date.now() + 7 * 86400000), status: 'Issued' },
  ]);

  // 14. Homework
  const hw = await Homework.create({
    class_id: '10', teacher: teachers[0]._id, subject: 'Mathematics',
    title: 'Chapter 5 - Quadratic Equations', description: 'Solve exercises 5.1 to 5.3',
    due_date: new Date(Date.now() + 3 * 86400000),
  });
  await HomeworkSubmission.create({
    homework: hw._id, student: students[0]._id, notes: 'Completed all exercises',
  });

  // 15. Leave
  await Leave.create({
    teacher: teachers[1]._id, start_date: new Date('2026-05-20'), end_date: new Date('2026-05-22'),
    reason: 'Family function', status: 'Pending',
  });

  // 16. Payroll
  await Payroll.create({
    teacher: teachers[0]._id, month: '2026-05', basic_salary: 35000,
    allowance: 5000, deductions: 2000, net_salary: 38000, status: 'Unpaid',
  });
}

module.exports = { initDb };
