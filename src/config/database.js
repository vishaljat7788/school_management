const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'school_management_node';
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  multipleStatements: true,
};

let pool;

async function initDb() {
  const server = await mysql.createConnection(DB_CONFIG);
  await server.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await server.end();

  pool = mysql.createPool({
    ...DB_CONFIG,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });

  await migrate();
  await seed();
  await normalizeClasses();
}

function db() {
  if (!pool) throw new Error('Database is not initialized');
  return pool;
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id VARCHAR(20) PRIMARY KEY,
      label VARCHAR(80) NOT NULL,
      color VARCHAR(20) NOT NULL DEFAULT '#2a5a8c'
    );
    CREATE TABLE IF NOT EXISTS teachers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      subject VARCHAR(80) NOT NULL,
      qualification VARCHAR(80) NOT NULL,
      experience_years INT NOT NULL DEFAULT 0,
      phone VARCHAR(30) DEFAULT '',
      email VARCHAR(120) DEFAULT '',
      bg_color VARCHAR(20) DEFAULT '#e8f0fa',
      text_color VARCHAR(20) DEFAULT '#1a5da0'
    );
    CREATE TABLE IF NOT EXISTS teacher_classes (
      teacher_id INT NOT NULL,
      class_id VARCHAR(20) NOT NULL,
      PRIMARY KEY (teacher_id, class_id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role ENUM('admin','teacher','student') NOT NULL,
      username VARCHAR(80) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      teacher_id INT NULL,
      student_id INT NULL,
      display_name VARCHAR(120) NOT NULL,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      roll_no VARCHAR(30) NOT NULL,
      class_id VARCHAR(20) NOT NULL,
      gender VARCHAR(20) NOT NULL,
      phone VARCHAR(30) DEFAULT '',
      fee_status ENUM('Paid','Pending','Overdue') NOT NULL DEFAULT 'Pending',
      address TEXT,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );
    CREATE TABLE IF NOT EXISTS fees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 12500,
      paid_amount DECIMAL(10,2) NOT NULL DEFAULT 12500,
      status ENUM('Paid','Pending','Overdue') NOT NULL DEFAULT 'Pending',
      paid_date DATE NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id VARCHAR(20) NOT NULL,
      student_id INT NOT NULL,
      attendance_date DATE NOT NULL,
      status ENUM('P','A','L') NOT NULL DEFAULT 'P',
      marked_by INT NOT NULL,
      UNIQUE KEY uniq_student_day (student_id, attendance_date),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (marked_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      audience VARCHAR(120) NOT NULL DEFAULT 'All Classes',
      notice_date DATE NOT NULL,
      type VARCHAR(40) NOT NULL DEFAULT 'general'
    );
    CREATE TABLE IF NOT EXISTS results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      exam_name VARCHAR(120) NOT NULL,
      subject VARCHAR(80) NOT NULL,
      marks_obtained INT NOT NULL,
      total_marks INT NOT NULL DEFAULT 100,
      grade VARCHAR(10) NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS timetable (
      id INT AUTO_INCREMENT PRIMARY KEY,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      monday VARCHAR(80) DEFAULT '',
      tuesday VARCHAR(80) DEFAULT '',
      wednesday VARCHAR(80) DEFAULT '',
      thursday VARCHAR(80) DEFAULT '',
      friday VARCHAR(80) DEFAULT '',
      saturday VARCHAR(80) DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings (
      skey VARCHAR(80) PRIMARY KEY,
      svalue TEXT NOT NULL
    );
  `);

  await addColumnIfMissing('students', 'father_name', "VARCHAR(120) NOT NULL DEFAULT ''");
  await addColumnIfMissing('students', 'mother_name', "VARCHAR(120) NOT NULL DEFAULT ''");
  await addColumnIfMissing('teachers', 'phone', "VARCHAR(30) NOT NULL DEFAULT ''");
  await addColumnIfMissing('teachers', 'email', "VARCHAR(120) NOT NULL DEFAULT ''");
  await addColumnIfMissing('teachers', 'disabled', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('timetable', 'class_id', "VARCHAR(20) NOT NULL DEFAULT '10'");
  
  try {
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','teacher','student') NOT NULL");
  } catch(e) {}
  await addColumnIfMissing('users', 'student_id', "INT NULL");

  // Migration for changing Partial to Pending in students and fees tables
  try {
    await pool.query("ALTER TABLE students MODIFY COLUMN fee_status ENUM('Paid','Partial','Overdue','Pending') NOT NULL DEFAULT 'Pending'");
    await pool.query("UPDATE students SET fee_status = 'Pending' WHERE fee_status = 'Partial'");
    await pool.query("ALTER TABLE students MODIFY COLUMN fee_status ENUM('Paid','Pending','Overdue') NOT NULL DEFAULT 'Pending'");
  } catch(e) {}
  try {
    await pool.query("ALTER TABLE fees MODIFY COLUMN status ENUM('Paid','Partial','Overdue','Pending') NOT NULL DEFAULT 'Pending'");
    await pool.query("UPDATE fees SET status = 'Pending' WHERE status = 'Partial'");
    await pool.query("ALTER TABLE fees MODIFY COLUMN status ENUM('Paid','Pending','Overdue') NOT NULL DEFAULT 'Pending'");
  } catch(e) {}

  // Dynamic user account generation for any students without user accounts
  try {
    const [students] = await pool.query('SELECT id, name FROM students');
    const hash = await bcrypt.hash('1234', 10);
    for (const student of students) {
      const username = student.name.toLowerCase().replace(/\s+/g, '.');
      // Using INSERT IGNORE or SELECT check to ensure no duplicates are entered
      await pool.query(
        'INSERT IGNORE INTO users (role, username, password_hash, student_id, display_name) VALUES (?, ?, ?, ?, ?)',
        ['student', username, hash, student.id, student.name]
      );
    }
  } catch(e) {
    console.error('Error generating student accounts:', e);
  }
}

async function addColumnIfMissing(table, column, definition) {
  const [[existing]] = await pool.query(
    'SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
    [DB_NAME, table, column],
  );
  if (existing.total === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

function ordinal(value) {
  const num = Number(value);
  const suffix = num % 100 >= 11 && num % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[num % 10] || 'th');
  return `${num}${suffix}`;
}

async function normalizeClasses() {
  const colors = ['#2a5a8c', '#e8a020', '#1e7d5a', '#7d1a8c', '#c0392b', '#3a3a9a', '#8c5a1a', '#8c1a7d', '#0f766e', '#b45309', '#4338ca', '#be123c'];

  for (let grade = 1; grade <= 12; grade += 1) {
    await pool.query('INSERT IGNORE INTO classes (id,label,color) VALUES (?,?,?)', [String(grade), ordinal(grade), colors[grade - 1]]);
  }

  const legacyMap = {
    'VII-A': '7',
    'VIII-A': '8',
    'VIII-C': '8',
    'IX-A': '9',
    'IX-B': '9',
    'X-A': '10',
    'X-B': '10',
  };
  const legacyIds = Object.keys(legacyMap);
  const placeholders = legacyIds.map(() => '?').join(',');
  const [legacyClasses] = await pool.query(`SELECT id FROM classes WHERE id IN (${placeholders})`, legacyIds);
  if (!legacyClasses.length) return;

  for (const [oldId, newId] of Object.entries(legacyMap)) {
    await pool.query('UPDATE students SET class_id=? WHERE class_id=?', [newId, oldId]);
    await pool.query('UPDATE attendance SET class_id=? WHERE class_id=?', [newId, oldId]);
  }

  const [teacherLinks] = await pool.query(`SELECT teacher_id,class_id FROM teacher_classes WHERE class_id IN (${placeholders})`, legacyIds);
  await pool.query(`DELETE FROM teacher_classes WHERE class_id IN (${placeholders})`, legacyIds);
  for (const link of teacherLinks) {
    await pool.query('INSERT IGNORE INTO teacher_classes (teacher_id,class_id) VALUES (?,?)', [link.teacher_id, legacyMap[link.class_id]]);
  }

  await pool.query(`DELETE FROM classes WHERE id IN (${placeholders})`, legacyIds);
}

async function seed() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM classes');
  if (total > 0) return;

  for (const row of [
    ['1', '1st', '#2a5a8c'], ['2', '2nd', '#e8a020'], ['3', '3rd', '#1e7d5a'],
    ['4', '4th', '#7d1a8c'], ['5', '5th', '#c0392b'], ['6', '6th', '#3a3a9a'],
    ['7', '7th', '#8c5a1a'], ['8', '8th', '#8c1a7d'], ['9', '9th', '#0f766e'],
    ['10', '10th', '#b45309'], ['11', '11th', '#4338ca'], ['12', '12th', '#be123c'],
  ]) await pool.query('INSERT INTO classes (id,label,color) VALUES (?,?,?)', row);

  for (const t of [
    ['Ramesh Kumar', 'Mathematics', 'M.Sc., B.Ed.', 12, '10', '#e8f0fa', '#1a5da0'],
    ['Priya Sharma', 'Science', 'M.Sc., B.Ed.', 8, '9', '#e4f4ed', '#1e7d5a'],
    ['Anita Singh', 'English', 'M.A., B.Ed.', 15, '8', '#fdf3dc', '#a06a00'],
    ['Suresh Patel', 'Hindi', 'M.A., B.Ed.', 10, '7', '#fcecea', '#c0392b'],
    ['Kavita Jain', 'Social Science', 'M.A., B.Ed.', 7, '10', '#f3e8fa', '#7d1a8c'],
    ['Rajesh Verma', 'Computer', 'MCA, B.Ed.', 5, '9', '#e8e8fa', '#3a3a9a'],
    ['Deepa Mishra', 'Mathematics', 'M.Sc., B.Ed.', 9, '8,9', '#fae8fa', '#8c1a7d'],
  ]) {
    const [res] = await pool.query(
      'INSERT INTO teachers (name,subject,qualification,experience_years,bg_color,text_color) VALUES (?,?,?,?,?,?)',
      [t[0], t[1], t[2], t[3], t[5], t[6]],
    );
    for (const classId of t[4].split(',')) await pool.query('INSERT INTO teacher_classes (teacher_id,class_id) VALUES (?,?)', [res.insertId, classId]);
  }

  const hash = await bcrypt.hash('1234', 10);
  await pool.query('INSERT INTO users (role,username,password_hash,display_name) VALUES (?,?,?,?)', ['admin', 'admin', hash, 'Admin']);
  const [teachers] = await pool.query('SELECT id, name FROM teachers');
  for (const teacher of teachers) {
    await pool.query('INSERT INTO users (role,username,password_hash,teacher_id,display_name) VALUES (?,?,?,?,?)', ['teacher', teacher.name.toLowerCase().replace(/\s+/g, '.'), hash, teacher.id, teacher.name]);
  }

  for (const s of [
    ['Aarav Sharma', '#1001', '10', 'Male', '98765 43210', 'Paid'], ['Priya Singh', '#1002', '9', 'Female', '87654 32109', 'Paid'],
    ['Rohan Kumar', '#1003', '8', 'Male', '76543 21098', 'Pending'], ['Ananya Patel', '#1004', '10', 'Female', '65432 10987', 'Paid'],
    ['Karan Malhotra', '#1005', '9', 'Male', '54321 09876', 'Overdue'], ['Meera Gupta', '#1006', '7', 'Female', '43210 98765', 'Paid'],
    ['Arjun Verma', '#1007', '10', 'Male', '32109 87654', 'Paid'], ['Sneha Joshi', '#1008', '8', 'Female', '21098 76543', 'Pending'],
    ['Aryan Rajput', '#1009', '10', 'Male', '90876 54321', 'Paid'], ['Deepika Rao', '#1010', '10', 'Female', '88776 65544', 'Paid'],
  ]) {
    const [res] = await pool.query('INSERT INTO students (name,roll_no,class_id,gender,phone,fee_status) VALUES (?,?,?,?,?,?)', s);
    const paid = s[5] === 'Paid' ? 12500 : (s[5] === 'Pending' ? 6500 : 0);
    await pool.query('INSERT INTO fees (student_id,amount,paid_amount,status,paid_date) VALUES (?,?,?,?,CURDATE())', [res.insertId, 12500, paid, s[5]]);
  }

  const [students] = await pool.query('SELECT id, name FROM students');
  for (const student of students) {
    await pool.query('INSERT INTO users (role,username,password_hash,student_id,display_name) VALUES (?,?,?,?,?)', ['student', student.name.toLowerCase().replace(/\s+/g, '.'), hash, student.id, student.name]);
  }

  await pool.query(`
    INSERT INTO notices (title,audience,notice_date,type) VALUES
    ('Half-Yearly Examination Schedule Released','All Classes','2026-05-01','exam'),
    ('Annual Sports Day - 20 May 2026','All Classes','2026-04-28','event'),
    ('Last Date for Fee Submission - 15 May','All Classes','2026-04-25','fee'),
    ('Parent-Teacher Meeting - Saturday, 18 May','Class X, IX','2026-04-22','meeting');
    INSERT INTO timetable (start_time,end_time,monday,tuesday,wednesday,thursday,friday,saturday) VALUES
    ('08:00','08:45','Morning Assembly','Morning Assembly','Morning Assembly','Morning Assembly','Morning Assembly','Morning Assembly'),
    ('08:45','09:30','Maths','English','Science','Hindi','Maths','S.Sc'),
    ('09:30','10:15','Science','Maths','English','Science','Hindi','Computer'),
    ('10:15','10:30','Short Break','Short Break','Short Break','Short Break','Short Break','Short Break'),
    ('10:30','11:15','Hindi','S.Sc','Maths','Computer','English','Art'),
    ('12:00','12:30','Lunch Break','Lunch Break','Lunch Break','Lunch Break','Lunch Break','Lunch Break');
  `);

  const [[aryan]] = await pool.query("SELECT id FROM students WHERE name='Aryan Rajput' LIMIT 1");
  for (const r of [['Half-Yearly', 'Mathematics', 87, 'A'], ['Half-Yearly', 'Science', 91, 'A+'], ['Half-Yearly', 'English', 79, 'B+']]) {
    await pool.query('INSERT INTO results (student_id,exam_name,subject,marks_obtained,total_marks,grade) VALUES (?,?,?,?,100,?)', [aryan.id, r[0], r[1], r[2], r[3]]);
  }

  for (const [key, value] of Object.entries({
    school_name: 'Vidya Mandir Higher Secondary School',
    board: 'CBSE',
    school_code: 'VM-2026-GJ',
    principal: 'Dr. Anita Sharma',
    phone: '+91 79 2234 5678',
    address: '123, Education Road, Satellite, Ahmedabad, Gujarat - 380015',
  })) await pool.query('INSERT INTO settings (skey,svalue) VALUES (?,?)', [key, value]);
}

module.exports = { initDb, db };
