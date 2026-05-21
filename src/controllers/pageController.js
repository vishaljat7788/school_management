const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Timetable = require('../models/Timetable');
const Setting = require('../models/Setting');
const { canAccessClass } = require('../services/teacherService');
const { layout, modal } = require('../views/layout');
const { e, feeClass, fmtDate, initials, money, today, className } = require('../utils/format');

async function dashboard(req, res) {
  const user = req.session.user;
  const isStudent = user.role === 'student';
  const isTeacher = user.role === 'teacher';

  if (isStudent) {
    const studentId = user.student_id;
    const attTotal = await Attendance.countDocuments({ student: studentId });
    const attPresent = await Attendance.countDocuments({ student: studentId, status: 'P' });
    const feeDoc = await Fee.findOne({ student: studentId });
    const recentResults = await Result.find({ student: studentId }).sort({ _id: -1 }).limit(4);
    const notices = await Notice.find().sort({ notice_date: -1 }).limit(4);

    const attPercent = attTotal ? Math.round((attPresent / attTotal) * 100) : 100;
    const pendingFee = feeDoc ? (feeDoc.amount - feeDoc.paid_amount) : 0;
    const feeStatus = feeDoc ? feeDoc.status : 'Paid';
    
    // map for templates
    const fee = feeDoc ? { amount: feeDoc.amount, paid_amount: feeDoc.paid_amount, status: feeDoc.status } : null;

    res.send(layout(req, 'dashboard', `
      <div class="stats-grid">
        <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-clipboard-user"></i></div><div class="stat-value">${attPercent}%</div><div class="stat-label">Attendance Rate</div></div>
        <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-user-graduate"></i></div><div class="stat-value">Class ${e(className(user.class_id))}</div><div class="stat-label">My Class</div></div>
        <div class="stat-card green"><div class="stat-icon"><i class="fas fa-rupee-sign"></i></div><div class="stat-value">${money(pendingFee)}</div><div class="stat-label">Fee Pending</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div><div class="stat-value"><span class="bp ${feeClass(feeStatus)}" style="font-size:16px;padding:4px 10px;">${feeStatus}</span></div><div class="stat-label">Fee Status</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">My Recent Results</div><a class="btn btn-sm btn-primary" style="text-decoration:none;" href="/results">View All</a></div>
          <table>
            <thead><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead>
            <tbody>
              ${recentResults.length ? recentResults.map((r) => `<tr><td>${e(r.exam_name)}</td><td>${e(r.subject)}</td><td>${r.marks_obtained}/${r.total_marks}</td><td><span class="bp green">${e(r.grade)}</span></td></tr>`).join('') : `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text3);">No exam results posted yet</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Notice Board</div></div>
          <div class="card-body">
            ${notices.map((n) => `<div class="notice-item"><div class="ni-icon" style="background:#e8f0fa;color:var(--primary-light);"><i class="fas fa-bullhorn"></i></div><div class="ni-text"><p>${e(n.title)}</p><span>${fmtDate(n.notice_date)} - ${e(n.audience)}</span></div></div>`).join('')}
          </div>
        </div>
      </div>`));
  } else if (isTeacher) {
    const notices = await Notice.find().sort({ notice_date: -1 }).limit(4);
    const teacherClasses = user.classes || [];
    const totalClasses = teacherClasses.length;
    res.send(layout(req, 'dashboard', `
      <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-chalkboard"></i></div><div class="stat-value">${totalClasses}</div><div class="stat-label">Assigned Classes</div></div>
        <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-book"></i></div><div class="stat-value">${e(user.subject || 'All')}</div><div class="stat-label">Primary Subject</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">Notice Board</div></div>
          <div class="card-body">
            ${notices.length ? notices.map((n) => `<div class="notice-item"><div class="ni-icon" style="background:#e8f0fa;color:var(--primary-light);"><i class="fas fa-bullhorn"></i></div><div class="ni-text"><p>${e(n.title)}</p><span>${fmtDate(n.notice_date)} - ${e(n.audience)}</span></div></div>`).join('') : '<div style="padding: 20px; text-align: center; color: var(--text3);">No recent notices</div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Attendance Trends</div></div>
          <div class="card-body"><canvas id="attendanceChart" style="max-height:250px;"></canvas></div>
        </div>
      </div>
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          const attCtx = document.getElementById('attendanceChart');
          if (attCtx) {
            new Chart(attCtx, {
              type: 'bar',
              data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                  label: 'Attendance %',
                  data: [94, 91, 96, 89, 93, 72],
                  backgroundColor: '#2a5a8c',
                  borderRadius: 6
                }]
              },
              options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
            });
          }
        });
      </script>`));
  } else {
    const feesAggr = await Fee.aggregate([{ $group: { _id: null, total: { $sum: '$paid_amount' } } }]);
    const stats = {
      students: await Student.countDocuments(),
      teachers: await Teacher.countDocuments(),
      collected: feesAggr[0]?.total || 0,
      absent: await Attendance.countDocuments({ attendance_date: today(), status: 'A' })
    };
    const recent = await Student.find().sort({ _id: -1 }).limit(4).select('name class_id fee_status');
    const notices = await Notice.find().sort({ notice_date: -1 }).limit(4);
    res.send(layout(req, 'dashboard', `
      <div class="stats-grid">
        <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-user-graduate"></i></div><div class="stat-value">${stats.students}</div><div class="stat-label">Total Students</div></div>
        <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-chalkboard-teacher"></i></div><div class="stat-value">${stats.teachers}</div><div class="stat-label">Total Teachers</div></div>
        <div class="stat-card green"><div class="stat-icon"><i class="fas fa-rupee-sign"></i></div><div class="stat-value">${money(stats.collected)}</div><div class="stat-label">Fees Collected</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="fas fa-times-circle"></i></div><div class="stat-value">${stats.absent}</div><div class="stat-label">Absent Today</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">Fee Collection Overview</div></div>
          <div class="card-body"><canvas id="feeChart" style="max-height:250px;"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Attendance Trends</div></div>
          <div class="card-body"><canvas id="attendanceChart" style="max-height:250px;"></canvas></div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-header"><div class="card-title">Recent Admissions</div><a class="btn btn-sm btn-primary" style="text-decoration:none;" href="/students">View All</a></div><table><thead><tr><th>Student</th><th>Class</th><th>Fee</th></tr></thead><tbody>${recent.map((s) => `<tr><td>${e(s.name)}</td><td>${e(className(s.class_id))}</td><td><span class="bp ${feeClass(s.fee_status)}">${e(s.fee_status)}</span></td></tr>`).join('')}</tbody></table></div>
        <div class="card"><div class="card-header"><div class="card-title">Notice Board</div></div><div class="card-body">${notices.map((n) => `<div class="notice-item"><div class="ni-icon" style="background:#e8f0fa;color:var(--primary-light);"><i class="fas fa-bullhorn"></i></div><div class="ni-text"><p>${e(n.title)}</p><span>${fmtDate(n.notice_date)} - ${e(n.audience)}</span></div></div>`).join('')}</div></div>
      </div>
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          const feeCtx = document.getElementById('feeChart');
          if (feeCtx) {
            new Chart(feeCtx, {
              type: 'doughnut',
              data: {
                labels: ['Collected', 'Pending', 'Overdue'],
                datasets: [{
                  data: [${stats.collected || 0}, ${(stats.students * 12500) - (stats.collected || 0)}, 0],
                  backgroundColor: ['#1e7d5a', '#e8a020', '#c0392b'],
                  borderWidth: 0
                }]
              },
              options: { maintainAspectRatio: false, cutout: '75%' }
            });
          }
          const attCtx = document.getElementById('attendanceChart');
          if (attCtx) {
            new Chart(attCtx, {
              type: 'bar',
              data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                  label: 'Attendance %',
                  data: [94, 91, 96, 89, 93, 72],
                  backgroundColor: '#2a5a8c',
                  borderRadius: 6
                }]
              },
              options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
            });
          }
        });
      </script>`));
  }
}

async function students(req, res) {
  const user = req.session.user;
  const studentsFilter = user.role === 'admin' ? {} : { class_id: { $in: user.classes } };
  const studentsRaw = await Student.find(studentsFilter).sort({ _id: -1 });
  const studentsList = studentsRaw.map(s => ({ id: String(s._id), name: s.name, roll_no: s.roll_no, class_id: s.class_id, gender: s.gender, father_name: s.father_name, mother_name: s.mother_name, phone: s.phone, address: s.address, fee_status: s.fee_status }));
  const classesRaw = await Class.find().sort({ _id: 1 });
  const classes = classesRaw.map(c => ({ id: String(c._id), label: c.label, color: c.color }));
  const addStudentButton = user.role === 'admin'
    ? `<button class="btn btn-primary" onclick="document.getElementById('addStudent').classList.add('open')"><i class="fas fa-plus"></i> Add Student</button>`
    : '';
  const actionHeader = user.role === 'admin' ? '<th style="text-align:center;width:150px;">Action</th>' : '';

  res.send(layout(req, 'students', `
    <div class="section-header"><div><div class="section-title">Students</div><div class="section-sub">${studentsList.length} student records from database</div></div>${addStudentButton}</div>
    <div class="card" style="margin-bottom:16px;"><div class="card-body" style="padding:14px 18px;"><div class="form-group"><label>Search Student</label><input id="studentSearch" placeholder="Search by name or roll number"></div></div></div>
    <div class="card"><table><thead><tr><th>Student</th><th>Roll No</th><th>Class</th><th>Gender</th><th>Phone</th>${actionHeader}</tr></thead><tbody>${studentsList.map((s) => `<tr class="student-row" data-name="${e(s.name)}" data-roll="${e(s.roll_no)}" data-class-id="${e(s.class_id)}" data-class="${e(className(s.class_id))}" data-gender="${e(s.gender)}" data-phone="${e(s.phone)}" data-father="${e(s.father_name || '')}" data-mother="${e(s.mother_name || '')}" data-address="${e(s.address || '')}" data-id="${s.id}" style="cursor:pointer;"><td><div class="td-flex"><div class="td-avatar" style="background:#e8f0fa;color:#1a5da0;">${initials(s.name)}</div>${e(s.name)}</div></td><td>${e(s.roll_no)}</td><td>${e(className(s.class_id))}</td><td>${e(s.gender)}</td><td>${e(s.phone)}</td>${user.role === 'admin' ? `<td><div class="action-buttons"><button type="button" class="icon-action print-id" title="Generate ID Card"><i class="fas fa-id-card"></i></button><button type="button" class="icon-action edit-student" title="Edit student" aria-label="Edit student"><i class="fas fa-edit"></i></button><form method="post" action="/students/${s.id}/delete" onsubmit="return confirm('Delete this student?')"><button class="icon-action danger" title="Delete student" aria-label="Delete student"><i class="fas fa-trash"></i></button></form></div></td>` : ''}</tr>`).join('')}</tbody></table></div>
    ${modal('studentDetails', 'Student Details', `<div class="modal-body"><div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;"><div class="td-avatar" id="detailAvatar" style="width:52px;height:52px;background:#e8f0fa;color:#1a5da0;font-size:16px;"></div><div><div id="detailName" style="font-size:18px;font-weight:700;color:var(--text);"></div><div id="detailSub" style="font-size:12.5px;color:var(--text3);"></div></div></div><div class="form-grid"><div class="form-group"><label>Student ID</label><input id="detailId" readonly></div><div class="form-group"><label>Roll No</label><input id="detailRoll" readonly></div><div class="form-group"><label>Class</label><input id="detailClass" readonly></div><div class="form-group"><label>Gender</label><input id="detailGender" readonly></div><div class="form-group"><label>Phone</label><input id="detailPhone" readonly></div><div class="form-group"><label>Father Name</label><input id="detailFather" readonly></div><div class="form-group"><label>Mother Name</label><input id="detailMother" readonly></div><div class="form-group form-full"><label>Address</label><textarea id="detailAddress" readonly></textarea></div></div></div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="printTC()">Print TC</button><button type="button" class="btn btn-primary" onclick="document.getElementById('studentDetails').classList.remove('open')">Close</button></div>`)}
    ${user.role === 'admin' ? modal('editStudent', 'Edit Student Details', `<form method="post" id="editStudentForm"><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Name</label><input name="name" id="editName" required></div><div class="form-group"><label>Roll No</label><input name="roll_no" id="editRoll" required></div><div class="form-group"><label>Class</label><select name="class_id" id="editClass">${classes.map((c) => `<option value="${e(c.id)}">${e(className(c.id))}</option>`).join('')}</select></div><div class="form-group"><label>Gender</label><select name="gender" id="editGender"><option>Male</option><option>Female</option></select></div><div class="form-group"><label>Father Name</label><input name="father_name" id="editFather"></div><div class="form-group"><label>Mother Name</label><input name="mother_name" id="editMother"></div><div class="form-group"><label>Phone</label><input name="phone" id="editPhone"></div><div class="form-group form-full"><label>Address</label><textarea name="address" id="editAddress"></textarea></div></div></div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="document.getElementById('editStudent').classList.remove('open')">Cancel</button><button class="btn btn-primary">Save Changes</button></div></form>`) : ''}
    ${user.role === 'admin' ? modal('addStudent', 'Add New Student', `<form method="post" action="/students"><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Name</label><input name="name" required></div><div class="form-group"><label>Roll No</label><input name="roll_no" required></div><div class="form-group"><label>Class</label><select name="class_id">${classes.map((c) => `<option value="${e(c.id)}">${e(className(c.id))}</option>`).join('')}</select></div><div class="form-group"><label>Gender</label><select name="gender"><option>Male</option><option>Female</option></select></div><div class="form-group"><label>Father Name</label><input name="father_name"></div><div class="form-group"><label>Mother Name</label><input name="mother_name"></div><div class="form-group"><label>Phone</label><input name="phone"></div><div class="form-group form-full"><label>Address</label><textarea name="address"></textarea></div></div></div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="document.getElementById('addStudent').classList.remove('open')">Cancel</button><button class="btn btn-primary">Add Student</button></div></form>`) : ''}
    <script>
      function studentInitials(name){return String(name||'').trim().split(/\\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'S'}
      document.getElementById('studentSearch').addEventListener('input',(ev)=>{
        const q=ev.target.value.trim().toLowerCase();
        document.querySelectorAll('.student-row').forEach((row)=>{
          const hay=((row.dataset.name||'')+' '+(row.dataset.roll||'')).toLowerCase();
          row.style.display=hay.includes(q)?'':'none';
        });
      });
      document.querySelectorAll('.student-row').forEach((row)=>row.addEventListener('click',()=>{
        const d=row.dataset;
        document.getElementById('detailAvatar').textContent=studentInitials(d.name);
        document.getElementById('detailName').textContent=d.name||'-';
        document.getElementById('detailSub').textContent=(d.roll||'-')+' - Class '+(d.class||'-');
        document.getElementById('detailId').value=d.id||'-';
        document.getElementById('detailRoll').value=d.roll||'-';
        document.getElementById('detailClass').value=d.class||'-';
        document.getElementById('detailGender').value=d.gender||'-';
        document.getElementById('detailPhone').value=d.phone||'-';
        document.getElementById('detailFather').value=d.father||'-';
        document.getElementById('detailMother').value=d.mother||'-';
        document.getElementById('detailAddress').value=d.address||'-';
        document.getElementById('studentDetails').classList.add('open');
      }));
      document.querySelectorAll('.edit-student').forEach((btn)=>btn.addEventListener('click',(ev)=>{
        ev.stopPropagation();
        const d=btn.closest('.student-row').dataset;
        const form=document.getElementById('editStudentForm');
        form.action='/students/'+d.id;
        document.getElementById('editName').value=d.name||'';
        document.getElementById('editRoll').value=d.roll||'';
        document.getElementById('editClass').value=d.classId||'';
        document.getElementById('editGender').value=d.gender||'Male';
        document.getElementById('editFather').value=d.father||'';
        document.getElementById('editMother').value=d.mother||'';
        document.getElementById('editPhone').value=d.phone||'';
        document.getElementById('editAddress').value=d.address||'';
        document.getElementById('editStudent').classList.add('open');
      }));
      document.querySelectorAll('.print-id').forEach((btn)=>btn.addEventListener('click',(ev)=>{
        ev.stopPropagation();
        const d=btn.closest('.student-row').dataset;
        const idCardHtml = \`
          <div id="idCard" style="width: 300px; border: 2px solid #2a5a8c; border-radius: 12px; font-family: 'Sora', sans-serif; padding: 20px; background: #fff; text-align: center; box-sizing: border-box;">
            <h3 style="margin: 0; color: #2a5a8c;">Vidya Mandir</h3>
            <p style="margin: 4px 0 12px; font-size: 11px; color: #555;">Student Identity Card</p>
            <div style="width: 80px; height: 80px; background: #e8f0fa; color: #1a5da0; border-radius: 50%; font-size: 32px; font-weight: bold; line-height: 80px; margin: 0 auto 12px;">\${studentInitials(d.name)}</div>
            <h4 style="margin: 0 0 4px; font-size: 18px;">\${d.name}</h4>
            <p style="margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #2a5a8c;">Roll No: \${d.roll}</p>
            <div style="text-align: left; font-size: 12px; color: #333; line-height: 1.5;">
              <div><b>Class:</b> \${d.class}</div>
              <div><b>DOB/Gender:</b> \${d.gender}</div>
              <div><b>Emergency No:</b> \${d.phone}</div>
              <div style="margin-top:10px;text-align:center;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=\${d.roll}" style="width:50px;height:50px;"></div>
            </div>
          </div>
        \`;
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '200vw';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = idCardHtml;
        document.body.appendChild(tempDiv);
        html2pdf().from(tempDiv.firstElementChild).set({ margin: 8, filename: d.roll + '_IDCard.pdf', html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' } }).save().then(() => tempDiv.remove());
      }));
      window.printTC = function() {
        const name = document.getElementById('detailName').textContent;
        const roll = document.getElementById('detailRoll').value;
        const cls = document.getElementById('detailClass').value;
        const tcHtml = \`
          <div id="tc" style="padding: 40px; font-family: 'Sora', sans-serif; border: 2px solid #ccc;">
            <h2 style="text-align: center; color: #2a5a8c; margin-bottom: 5px;">Vidya Mandir School</h2>
            <p style="text-align: center; margin-top: 0;">123 Education Road, Satellite, Ahmedabad</p>
            <hr>
            <h3 style="text-align: center; text-decoration: underline;">Transfer Certificate</h3>
            <p style="line-height: 2;">This is to certify that <b>\${name}</b> (Roll No: \${roll}) was a bonafide student of this school studying in Class <b>\${cls}</b>.</p>
            <p style="line-height: 2;">He/She bears a good moral character. All dues up to the date of leaving have been paid.</p>
            <br><br><br>
            <div style="display: flex; justify-content: space-between;">
              <p><b>Date:</b> \${new Date().toLocaleDateString('en-IN')}</p>
              <p><b>Principal's Signature</b></p>
            </div>
          </div>
        \`;
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '200vw';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = tcHtml;
        document.body.appendChild(tempDiv);
        html2pdf().from(tempDiv.firstElementChild).set({ margin: 20, filename: roll + '_TC.pdf', html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save().then(() => tempDiv.remove());
      };
      document.querySelectorAll('.student-row form,.student-row button').forEach((el)=>el.addEventListener('click',(ev)=>ev.stopPropagation()));
      document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
    </script>`));
}

async function addStudent(req, res) {
  const { name, roll_no, class_id, gender, father_name, mother_name, phone, address } = req.body;
  
  // Check if roll number already exists
  const existing = await Student.findOne({ roll_no });
  if (existing) {
    req.session.flash = { type: 'danger', message: `Roll number ${roll_no} is already assigned to ${existing.name}.` };
    return res.redirect('/students');
  }

  const fee_status = req.body.fee_status || 'Paid';
  const result = await Student.create({ name, roll_no, class_id, gender, father_name: father_name || '', mother_name: mother_name || '', phone, fee_status, address });
  const paid = fee_status === 'Paid' ? 12500 : fee_status === 'Pending' ? 6500 : 0;
  await Fee.create({ student: result._id, amount: 12500, paid_amount: paid, status: fee_status, paid_date: today() });
  req.session.flash = { type: 'success', message: 'Student added successfully.' };
  res.redirect('/students');
}

async function updateStudent(req, res) {
  const { name, roll_no, class_id, gender, father_name, mother_name, phone, address } = req.body;
  await Student.findByIdAndUpdate(req.params.id, { name, roll_no, class_id, gender, father_name: father_name || '', mother_name: mother_name || '', phone: phone || '', address: address || '' });
  req.session.flash = { type: 'success', message: 'Student updated successfully.' };
  res.redirect('/students');
}

async function deleteStudent(req, res) {
  await Student.findByIdAndDelete(req.params.id);
  await Fee.deleteMany({ student: req.params.id });
  req.session.flash = { type: 'success', message: 'Student deleted successfully.' };
  res.redirect('/students');
}

async function addClass(req, res) {
  const rawClass = String(req.body.class_name || req.body.grade || req.body.id || '').trim().toLowerCase();
  const id = rawClass.replace(/(?:st|nd|rd|th)$/i, '');
  const label = className(id);
  const color = /^#[0-9a-fA-F]{6}$/.test(req.body.color || '') ? req.body.color : '#2a5a8c';

  if (!/^(?:[1-9]|1[0-2])$/.test(id)) {
    req.session.flash = { type: 'danger', message: 'Please select a class from 1st to 12th.' };
    return res.redirect('/attendance');
  }

  try {
    await Class.create({ _id: id, label, color });
    req.session.flash = { type: 'success', message: 'Class added successfully.' };
    res.redirect(`/attendance?class=${encodeURIComponent(id)}`);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.code === 'ER_DUP_ENTRY' ? 'This class already exists.' : 'Unable to add class.' };
    res.redirect('/attendance');
  }
}

async function teachers(req, res) {
  const user = req.session.user;
  const admin = user.role === 'admin';
  const teachersRaw = await Teacher.find().sort({ _id: 1 });
  const teachersList = teachersRaw.map(t => ({ id: String(t._id), name: t.name, subject: t.subject, qualification: t.qualification, experience_years: t.experience_years, phone: t.phone, email: t.email, salary: t.salary, disabled: t.disabled, classes: t.classes.join(', '), bg_color: t.bg_color, text_color: t.text_color }));
  const classesRaw = await Class.find().sort({ _id: 1 });
  const classesList = classesRaw.map(c => ({ id: String(c._id), label: c.label, color: c.color }));

  const total = teachersList.length;
  const active = teachersList.filter((t) => !t.disabled).length;
  const disabledCount = total - active;
  const subjects = [...new Set(teachersList.map((t) => t.subject))].length;

  const addBtn = admin ? `<button class="btn btn-primary" onclick="openAddTeacher()"><i class="fas fa-plus"></i> Add Teacher</button>` : '';

  const statsHtml = `
    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-chalkboard-teacher"></i></div><div class="stat-value">${total}</div><div class="stat-label">Total Teachers</div></div>
      <div class="stat-card green"><div class="stat-icon"><i class="fas fa-user-check"></i></div><div class="stat-value">${active}</div><div class="stat-label">Active</div></div>
      <div class="stat-card red"><div class="stat-icon"><i class="fas fa-user-slash"></i></div><div class="stat-value">${disabledCount}</div><div class="stat-label">Disabled</div></div>
      <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-book"></i></div><div class="stat-value">${subjects}</div><div class="stat-label">Subjects</div></div>
    </div>
  `;

  const trs = teachersList.map((t) => {
    const isDis = t.disabled;
    return `<tr style="opacity:${isDis ? '0.5' : '1'}" class="teacher-row" data-id="${t.id}" data-name="${e(t.name)}" data-sub="${e(t.subject)}" data-qual="${e(t.qualification)}" data-exp="${t.experience_years}" data-phone="${e(t.phone)}" data-email="${e(t.email)}" data-classes="${e(t.classes || '')}" data-bg="${t.bg_color}" data-tc="${t.text_color}" data-init="${initials(t.name)}" data-disabled="${t.disabled}" data-salary="${t.salary}">
      <td><div class="td-flex">
        <div class="td-avatar" style="width:38px;height:38px;background:${t.bg_color};color:${t.text_color};font-size:13px;">${initials(t.name)}</div>
        <div>
          <div style="font-weight:600;font-size:13.5px;">${e(t.name)}</div>
          <div style="font-size:11.5px;color:var(--text3);">${e(t.phone)}</div>
        </div>
      </div></td>
      <td>${e(t.subject)}</td>
      <td style="color:var(--text2);font-size:12.5px;">${e(t.qualification)}</td>
      <td style="font-weight:600;">${t.experience_years} yrs</td>
      <td><span class="bp ${isDis ? 'red' : 'green'}">${isDis ? '<i class="fas fa-ban"></i> Disabled' : '<i class="fas fa-check-circle"></i> Active'}</span></td>
      ${admin ? `<td><div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-outline btn-icon" onclick="viewTeacher('${t.id}')" title="View Details"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-outline btn-icon" onclick="openEditTeacher('${t.id}')" title="Edit Teacher"><i class="fas fa-edit"></i></button>
        <form method="post" action="/teachers/${t.id}/disable" onsubmit="return confirm('Toggle disable status?')"><button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger);border-color:var(--danger);" title="${isDis ? 'Enable' : 'Disable'} Teacher"><i class="fas fa-${isDis ? 'check' : 'ban'}"></i></button></form>
      </div></td>` : ''}
    </tr>`;
  }).join('');

  const tableHtml = `
    <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div style="position: relative; width: 100%; max-width: 320px;">
        <i class="fas fa-search" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text3);"></i>
        <input type="text" id="teacherSearch" placeholder="Search by name, subject, or phone..." style="width: 100%; padding: 10px 14px 10px 40px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 14px; outline: none;">
      </div>
    </div>
    <div class="card"><table><thead><tr>
      <th>Teacher</th><th>Subject</th><th>Qualification</th><th>Exp.</th><th>Status</th>${admin ? '<th>Actions</th>' : ''}
    </tr></thead><tbody>${trs || `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">No teachers found</td></tr>`}</tbody></table></div>
  `;

  let modalsHtml = '';
  if (admin) {
    const classOptions = classesList.map((c) => `<option value="${e(c.id)}">${e(className(c.id))}</option>`).join('');
    modalsHtml = `
      ${modal('modalAddTeacher', 'Add New Teacher', `
        <form method="post" action="/teachers" id="teacherForm">
          <div class="modal-body"><div class="form-grid">
            <div class="form-group"><label>Full Name</label><input type="text" name="name" id="tName" required></div>
            <div class="form-group"><label>Subject</label>
              <select name="subject" id="tSub">
                <option>Mathematics</option><option>Science</option><option>English</option>
                <option>Hindi</option><option>Social Science</option><option>Computer</option>
              </select>
            </div>
            <div class="form-group"><label>Qualification</label><input type="text" name="qualification" id="tQual"></div>
            <div class="form-group"><label>Experience (Years)</label><input type="number" name="experience_years" id="tExp" min="0"></div>
            <div class="form-group form-full"><label>Assigned Class(es) <span style="color:var(--text3);font-weight:400;">(hold Ctrl/Cmd to select multiple)</span></label>
              <select name="classes" id="tClasses" multiple style="height:100px;">
                ${classOptions}
              </select>
            </div>
            <div class="form-group"><label>Phone</label><input type="text" name="phone" id="tPhone"></div>
            <div class="form-group"><label>Email</label><input type="email" name="email" id="tEmail"></div>
            <div class="form-group"><label>Monthly Salary (Rs.)</label><input type="number" name="salary" id="tSalary" required min="0" value="35000"></div>
          </div></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalAddTeacher').classList.remove('open')">Cancel</button>
            <button class="btn btn-primary" id="teacherSaveBtn"><i class="fas fa-save"></i> Save Teacher</button>
          </div>
        </form>
      `)}

      <div class="modal-overlay" id="modalTeacherDetail">
        <div class="modal" style="width:640px;padding:0;">
          <div id="tdHeader" style="border-radius:18px 18px 0 0;padding:28px 28px 20px;display:flex;align-items:center;gap:20px;background:#2a5a8c;">
            <div id="tdAvatar" style="width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;flex-shrink:0;background:#fff;color:#2a5a8c;"></div>
            <div style="flex:1;">
              <div id="tdName" style="font-size:20px;font-weight:700;color:#fff;"></div>
              <div id="tdSub" style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:3px;"></div>
            </div>
            <span class="modal-close" onclick="document.getElementById('modalTeacherDetail').classList.remove('open')" style="color:rgba(255,255,255,0.7);font-size:20px;cursor:pointer;"><i class="fas fa-times"></i></span>
          </div>
          <div class="modal-body" style="padding:24px;">
            <div id="tdBody" style="display:flex;gap:15px;flex-wrap:wrap;"></div>
          </div>
          <div class="modal-footer" style="padding:16px 24px;">
            <button class="btn btn-outline" onclick="document.getElementById('modalTeacherDetail').classList.remove('open')">Close</button>
            <button class="btn btn-primary" id="tdEditBtn" onclick=""><i class="fas fa-edit"></i> Edit</button>
          </div>
        </div>
      </div>

      <script>
        function openAddTeacher(){
          document.getElementById('teacherForm').action = '/teachers';
          document.getElementById('tName').value = '';
          document.getElementById('tSub').value = 'Mathematics';
          document.getElementById('tQual').value = '';
          document.getElementById('tExp').value = '0';
          document.getElementById('tPhone').value = '';
          document.getElementById('tEmail').value = '';
          document.getElementById('tSalary').value = '35000';
          Array.from(document.getElementById('tClasses').options).forEach(o=>o.selected=false);
          document.querySelector('#modalAddTeacher .modal-title').textContent = 'Add New Teacher';
          document.getElementById('modalAddTeacher').classList.add('open');
        }

        function openEditTeacher(id){
          const row = document.querySelector('.teacher-row[data-id="'+id+'"]');
          if(!row) return;
          const d = row.dataset;
          document.getElementById('teacherForm').action = '/teachers/'+id+'/edit';
          document.getElementById('tName').value = d.name;
          document.getElementById('tSub').value = d.sub;
          document.getElementById('tQual').value = d.qual;
          document.getElementById('tExp').value = d.exp;
          document.getElementById('tPhone').value = d.phone;
          document.getElementById('tEmail').value = d.email;
          document.getElementById('tSalary').value = d.salary || '35000';
          const classes = (d.classes||'').split(', ');
          Array.from(document.getElementById('tClasses').options).forEach(o=>{
            o.selected = classes.includes(o.value);
          });
          document.querySelector('#modalAddTeacher .modal-title').textContent = 'Edit Teacher';
          document.getElementById('modalAddTeacher').classList.add('open');
        }

        function viewTeacher(id){
          const row = document.querySelector('.teacher-row[data-id="'+id+'"]');
          if(!row) return;
          const d = row.dataset;
          document.getElementById('tdHeader').style.background = d.bg;
          document.getElementById('tdAvatar').style.color = d.tc;
          document.getElementById('tdAvatar').textContent = d.init;
          document.getElementById('tdName').style.color = d.tc;
          document.getElementById('tdName').textContent = d.name;
          document.getElementById('tdSub').style.color = d.tc;
          document.getElementById('tdSub').style.opacity = '0.8';
          document.getElementById('tdSub').textContent = d.sub + ' · ' + d.qual;
          document.querySelector('#tdHeader .modal-close').style.color = d.tc;

          const isDis = d.disabled === '1';
          const formattedSalary = Number(d.salary || 0).toLocaleString('en-IN');          document.getElementById('tdBody').innerHTML = \`
            <div style="flex:1;min-width:180px;background:#f8f9fa;padding:16px;border-radius:12px;">
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Experience</div>
              <div style="font-size:16px;font-weight:600;">\${d.exp} Years</div>
            </div>
            <div style="flex:1;min-width:180px;background:#f8f9fa;padding:16px;border-radius:12px;">
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Default Salary</div>
              <div style="font-size:16px;font-weight:600;color:var(--success);">Rs. \${formattedSalary}</div>
            </div>
            <div style="flex:1;min-width:180px;background:#f8f9fa;padding:16px;border-radius:12px;">
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Status</div>
              <div style="font-size:16px;font-weight:600;color:var(--\${isDis?'danger':'success'});">\${isDis?'Disabled':'Active'}</div>
            </div>
            <div style="width:100%;margin-top:10px;">
              <div style="display:flex;align-items:center;padding:12px 16px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--primary);margin-right:14px;"><i class="fas fa-phone"></i></div>
                <div><div style="font-size:11px;color:var(--text3);">Phone Number</div><div style="font-size:14px;font-weight:600;">\${d.phone||'N/A'}</div></div>
              </div>
              <div style="display:flex;align-items:center;padding:12px 16px;border:1px solid var(--border);border-radius:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--primary);margin-right:14px;"><i class="fas fa-envelope"></i></div>
                <div><div style="font-size:11px;color:var(--text3);">Email Address</div><div style="font-size:14px;font-weight:600;">\${d.email||'N/A'}</div></div>
              </div>
            </div>
          \`;;

          document.getElementById('tdEditBtn').onclick = () => { document.getElementById('modalTeacherDetail').classList.remove('open'); openEditTeacher(id); };
          document.getElementById('modalTeacherDetail').classList.add('open');
        }
      </script>
    `;
  }

  res.send(layout(req, 'teachers', `
    <div class="section-header"><div><div class="section-title">Teachers</div><div class="section-sub">${total} teachers · ${active} active · ${disabledCount} disabled</div></div>${addBtn}</div>
    ${statsHtml}
    ${tableHtml}
    ${modalsHtml}
    <script>
      document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
      
      const searchInput = document.getElementById('teacherSearch');
      if (searchInput) {
        searchInput.addEventListener('input', function(e) {
          const term = e.target.value.toLowerCase();
          document.querySelectorAll('.teacher-row').forEach(row => {
            const name = (row.dataset.name || '').toLowerCase();
            const sub = (row.dataset.sub || '').toLowerCase();
            const phone = (row.dataset.phone || '').toLowerCase();
            if (name.includes(term) || sub.includes(term) || phone.includes(term)) {
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          });
        });
      }
    </script>
  `));
}


async function attendance(req, res) {
  const user = req.session.user;
  const attendanceDate = normalizeDate(req.query.date);
  const classFilter = user.role === 'admin' || user.role === 'teacher' ? {} : { _id: { $in: user.classes } };
  const classesRaw = await Class.find(classFilter).sort({ _id: 1 });
  const classes = await Promise.all(classesRaw.map(async c => {
    const total_students = await Student.countDocuments({ class_id: String(c._id) });
    return { id: String(c._id), label: c.label, color: c.color, total_students };
  }));
  const classId = req.query.class || (classes.length ? classes[0].id : '');
  const month = normalizeMonth(req.query.month);
  if (classId && !(await canAccessClass(user, classId))) return res.redirect('/attendance');
  let studentRows = [];
  if (classId) {
    const studentsRaw = await Student.find({ class_id: classId }).sort({ roll_no: 1 });
    studentRows = await Promise.all(studentsRaw.map(async s => {
      const att = await Attendance.findOne({ student: s._id, attendance_date: attendanceDate });
      return { id: String(s._id), name: s.name, roll_no: s.roll_no, att_status: att ? att.status : null };
    }));
  }
  const monthReport = classId ? await getMonthlyAttendance(classId, month) : emptyMonthlyAttendance(month);
  const counts = { P: 0, A: 0 };
  studentRows.forEach((s) => {
    if (s.att_status === 'A') counts.A += 1;
    if (s.att_status === 'P') counts.P += 1;
  });
  const percent = studentRows.length ? Math.round((counts.P / studentRows.length) * 100) : 0;
  const selectedClass = classes.find((c) => c.id === classId);
  const rowHtml = studentRows.map((s) => attendanceRow(s)).join('');
  res.send(layout(req, 'attendance', attendanceMarkup({ user, classes, classId, attendanceDate, month, monthReport, studentRows, counts, percent, selectedClass, rowHtml })));
}

function attendanceRow(s) {
  const status = s.att_status === 'P' || s.att_status === 'A' ? s.att_status : '';
  const statusLabel = status === 'P' ? 'Present' : status === 'A' ? 'Absent' : 'Not Marked';
  const statusClass = status === 'P' ? 'green' : status === 'A' ? 'red' : 'gray';
  return `<tr id="attRow-${s.id}"><td style="color:var(--text3);font-weight:600;">${e(s.roll_no)}</td><td>${e(s.name)}</td><td style="text-align:center;"><input type="hidden" name="status_${s.id}" value="${status}" id="statusInput-${s.id}"><div class="att-toggle" style="justify-content:center;"><button type="button" class="asb p${status === 'P' ? ' sel' : ''}" onclick="setAttendance('${s.id}', 'P')">P</button><button type="button" class="asb a${status === 'A' ? ' sel' : ''}" onclick="setAttendance('${s.id}', 'A')">A</button></div></td><td style="text-align:center;"><span class="bp ${statusClass}" id="statusBadge-${s.id}">${statusLabel}</span></td></tr>`;
}

function attendanceMarkup({ user, classes, classId, attendanceDate, month, monthReport, studentRows, counts, percent, selectedClass, rowHtml }) {
  const addClassButton = user.role === 'admin'
    ? `<button class="btn btn-primary" onclick="document.getElementById('addClass').classList.add('open')"><i class="fas fa-plus"></i> Add Class</button>`
    : '';
  const addClassModal = user.role === 'admin'
    ? modal('addClass', 'Add New Class', `<form method="post" action="/classes"><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Class</label><input name="class_name" placeholder="1st, 2nd ... 12th" required></div><div class="form-group"><label>Color</label><input type="color" name="color" value="#2a5a8c"></div></div></div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="document.getElementById('addClass').classList.remove('open')">Cancel</button><button class="btn btn-primary">Add Class</button></div></form>`)
    : '';

  return `
    <div class="att-banner"><div><h2><i class="fas fa-clipboard-check" style="margin-right:10px;"></i>Attendance Management</h2><p>${user.role === 'admin' || user.role === 'teacher' ? 'View and record attendance for all classes.' : 'You can take attendance only for your assigned classes.'}</p></div><div style="color:#fff;font-weight:600;">Today: ${attendanceDate}</div></div>
    <div class="section-header"><div><div style="font-size:13px;color:var(--text2);font-weight:500;"><i class="fas fa-hand-pointer" style="margin-right:6px;color:var(--text3);"></i>Select a class to mark attendance:</div><div class="section-sub">${classes.length} classes loaded from database</div></div>${addClassButton}</div>
    <div class="att-class-grid">${classes.map((c) => `<a class="acc${c.id === classId ? ' selected' : ''}" style="text-decoration:none;color:inherit;" href="/attendance?class=${e(c.id)}&month=${e(month)}&date=${e(attendanceDate)}"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><div class="acc-name" style="color:${c.color || '#2a5a8c'};">${e(className(c.id))}</div><i class="fas fa-check-circle" style="color:var(--success);font-size:14px;"></i></div><div class="acc-meta">Class ${e(className(c.id))}</div><div class="acc-meta">${Number(c.total_students || 0)} Students</div><div style="margin-top:10px;"><span class="bp blue"><i class="fas fa-plus"></i> Mark Attendance</span></div></a>`).join('')}</div>
    ${classes.length ? '' : `<div class="card"><div class="card-body" style="text-align:center;color:var(--text3);padding:34px;">No classes found in database.</div></div>`}
    ${classId ? `<form method="post" action="/attendance" id="attendanceForm"><input type="hidden" name="class_id" value="${e(classId)}"><input type="hidden" name="attendance_date" value="${e(attendanceDate)}"><div class="card"><div class="card-header"><div><div class="card-title" style="display:flex;align-items:center;gap:10px;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${selectedClass?.color || 'var(--success)'};"></span>Class ${e(className(classId))} - Attendance Sheet</div><div class="card-subtitle">${attendanceDate} - ${user.role === 'admin' ? 'Admin View' : `Marked by: ${e(user.display_name)}`}</div></div><button class="btn btn-success"><i class="fas fa-save"></i> Save & Submit</button></div><div class="card-body"><div class="att-summary"><div class="att-stat"><div class="att-dot" style="background:var(--success);"></div><div><div class="att-stat-v" id="countP">${counts.P}</div><div class="att-stat-l">Present</div></div></div><div class="att-stat"><div class="att-dot" style="background:var(--danger);"></div><div><div class="att-stat-v" id="countA">${counts.A}</div><div class="att-stat-l">Absent</div></div></div><div class="att-stat"><div><div class="att-stat-v" id="countPct" style="color:var(--primary)">${percent}%</div><div class="att-stat-l">Attendance %</div></div></div></div><div class="mark-all"><span>Mark All:</span><button type="button" class="btn btn-sm btn-outline" style="color:var(--success);border-color:var(--success);" onclick="markAllAttendance('P')"><i class="fas fa-check"></i> Present</button><button type="button" class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger);" onclick="markAllAttendance('A')"><i class="fas fa-times"></i> Absent</button></div><div class="attendance-table-wrap"><table><thead><tr><th style="width:80px;">Roll</th><th>Student Name</th><th style="text-align:center;width:220px;">Mark Attendance</th><th style="text-align:center;width:100px;">Status</th></tr></thead><tbody>${rowHtml || `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text3);">No students found in this class</td></tr>`}</tbody></table></div></div></div></form>${monthlyAttendanceMarkup(classId, month, monthReport)}<script>const studentIds=${JSON.stringify(studentRows.map((s) => s.id))};function setAttendance(id,status){const input=document.getElementById('statusInput-'+id);const badge=document.getElementById('statusBadge-'+id);const row=document.getElementById('attRow-'+id);if(!input||!badge||!row)return;input.value=status;row.querySelectorAll('.asb').forEach((btn)=>btn.classList.remove('sel'));row.querySelector('.asb.'+status.toLowerCase()).classList.add('sel');badge.className='bp '+(status==='P'?'green':'red');badge.textContent=status==='P'?'Present':'Absent';refreshAttendanceCounts()}function markAllAttendance(status){studentIds.forEach((id)=>setAttendance(id,status))}function refreshAttendanceCounts(){const counts={P:0,A:0};studentIds.forEach((id)=>{const input=document.getElementById('statusInput-'+id);if(!input||!input.value)return;if(input.value==='A')counts.A+=1;else counts.P+=1});document.getElementById('countP').textContent=counts.P;document.getElementById('countA').textContent=counts.A;document.getElementById('countPct').textContent=(studentIds.length?Math.round((counts.P/studentIds.length)*100):0)+'%'}</script>` : ''}
    ${addClassModal}
    <script>document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));</script>`;
}

function normalizeMonth(value) {
  return /^\d{4}-\d{2}$/.test(value || '') ? value : today().slice(0, 7);
}

function normalizeDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : today();
}

function emptyMonthlyAttendance(month) {
  return { month, days: daysInMonth(month), students: [] };
}

function daysInMonth(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const total = new Date(year, monthNum, 0).getDate();
  return Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

async function getMonthlyAttendance(classId, month) {
  const days = daysInMonth(month);
  const studentsRaw = await Student.find({ class_id: classId }).sort({ roll_no: 1 });
  const students = studentsRaw.map(s => ({ id: String(s._id), name: s.name, roll_no: s.roll_no }));
  const rows = await Attendance.find({
    class_id: classId,
    attendance_date: { $gte: days[0], $lte: days[days.length - 1] }
  });
  const statusByStudent = new Map();
  rows.forEach((row) => {
    const sid = String(row.student);
    if (!statusByStudent.has(sid)) statusByStudent.set(sid, {});
    statusByStudent.get(sid)[fmtDate(row.attendance_date)] = row.status === 'A' ? 'A' : 'P';
  });

  return {
    month,
    days,
    students: students.map((student) => {
      const statuses = statusByStudent.get(student.id) || {};
      const present = days.filter((day) => statuses[day] === 'P').length;
      const absent = days.filter((day) => statuses[day] === 'A').length;
      return { ...student, statuses, present, absent };
    }),
  };
}

function monthlyAttendanceMarkup(classId, month, report) {
  const dayHeaders = report.days.map((day) => `<th style="text-align:center;min-width:42px;">${Number(day.slice(-2))}</th>`).join('');
  const rows = report.students.map((student) => `<tr><td style="color:var(--text3);font-weight:600;position:sticky;left:0;background:#fff;">${e(student.roll_no)}</td><td style="position:sticky;left:70px;background:#fff;min-width:170px;">${e(student.name)}</td>${report.days.map((day) => {
    const status = student.statuses[day] || '';
    const cls = status === 'P' ? 'green' : status === 'A' ? 'red' : 'gray';
    return `<td style="text-align:center;"><span class="bp ${cls}" style="min-width:28px;justify-content:center;">${status || '-'}</span></td>`;
  }).join('')}<td style="text-align:center;"><span class="bp green">${student.present}</span></td><td style="text-align:center;"><span class="bp red">${student.absent}</span></td></tr>`).join('');

  return `<div class="card" style="margin-top:20px;"><div class="card-header"><div><div class="card-title"><i class="fas fa-calendar-alt" style="margin-right:8px;color:var(--primary-light);"></i>Monthly Attendance - Class ${e(className(classId))}</div><div class="card-subtitle">P = Present, A = Absent, - = Not marked</div></div><a class="btn btn-primary" style="text-decoration:none;" href="/attendance/export?class=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}"><i class="fas fa-file-excel"></i> Export Excel</a></div><div class="card-body"><form method="get" action="/attendance" class="form-grid" style="margin-bottom:16px;align-items:end;"><input type="hidden" name="class" value="${e(classId)}"><div class="form-group"><label>Month</label><input type="month" name="month" value="${e(month)}"></div><div class="form-group"><button class="btn btn-outline"><i class="fas fa-search"></i> View Month</button></div></form><div class="monthly-scroll"><table class="monthly-table"><thead><tr><th style="position:sticky;left:0;background:#fff;z-index:2;min-width:70px;">Roll</th><th style="position:sticky;left:70px;background:#fff;z-index:2;min-width:170px;">Student</th>${dayHeaders}<th style="text-align:center;min-width:70px;">Present</th><th style="text-align:center;min-width:70px;">Absent</th></tr></thead><tbody>${rows || `<tr><td colspan="${report.days.length + 4}" style="text-align:center;padding:30px;color:var(--text3);">No students found in this class</td></tr>`}</tbody></table></div></div></div>`;
}

async function exportAttendance(req, res) {
  const classId = req.query.class || '';
  const month = normalizeMonth(req.query.month);
  if (!classId || !(await canAccessClass(req.session.user, classId))) {
    req.session.flash = { type: 'danger', message: 'Access denied for this class.' };
    return res.redirect('/attendance');
  }

  const report = await getMonthlyAttendance(classId, month);
  const headers = ['Roll No', 'Student Name', ...report.days.map((day) => day.slice(-2)), 'Present', 'Absent'];
  const lines = [headers.map(csvCell).join(',')];
  report.students.forEach((student) => {
    lines.push([
      student.roll_no,
      student.name,
      ...report.days.map((day) => student.statuses[day] || ''),
      student.present,
      student.absent,
    ].map(csvCell).join(','));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-class-${classId}-${month}.csv"`);
  res.send(`\uFEFF${lines.join('\n')}`);
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function saveAttendance(req, res) {
  const classId = req.body.class_id;
  const attendanceDate = normalizeDate(req.body.attendance_date);
  if (!(await canAccessClass(req.session.user, classId))) {
    req.session.flash = { type: 'danger', message: 'Access denied for this class.' };
    return res.redirect('/attendance');
  }
  const studentRows = await Student.find({ class_id: classId }, '_id');
  for (const s of studentRows) {
    const status = req.body[`status_${s._id}`];
    if (status !== 'P' && status !== 'A') continue;
    await Attendance.findOneAndUpdate(
      { class_id: classId, student: s._id, attendance_date: attendanceDate },
      { status, marked_by: req.session.user.id },
      { upsert: true }
    );
  }
  req.session.flash = { type: 'success', message: 'Attendance saved successfully.' };
  res.redirect(`/attendance?class=${encodeURIComponent(classId)}&month=${encodeURIComponent(attendanceDate.slice(0, 7))}&date=${encodeURIComponent(attendanceDate)}`);
}

async function fees(req, res) {
  const user = req.session.user;
  const isStudent = user.role === 'student';
  const isAdmin = user.role === 'admin';

  if (isStudent) {
    const studentId = user.student_id;
    const feeDoc = await Fee.findOne({ student: studentId }).populate('student', 'name class_id');
    const myFee = feeDoc && feeDoc.student ? { id: feeDoc._id, name: feeDoc.student.name, class_id: feeDoc.student.class_id, amount: feeDoc.amount, paid_amount: feeDoc.paid_amount, status: feeDoc.status } : null;
    const paid = myFee ? myFee.paid_amount : 0;
    const pending = myFee ? (myFee.amount - myFee.paid_amount) : 0;
    const status = myFee ? myFee.status : 'Paid';

    res.send(layout(req, 'fees', `
      <div class="stats-grid">
        <div class="stat-card green"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-value">${money(paid)}</div><div class="stat-label">Paid Amount</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div><div class="stat-value">${money(pending)}</div><div class="stat-label">Pending Amount</div></div>
        <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div><div class="stat-value"><span class="bp ${feeClass(status)}" style="font-size:16px;padding:4px 10px;">${status}</span></div><div class="stat-label">Payment Status</div></div>
      </div>
      <div class="card">
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Total Fee</th><th>Paid Amount</th><th>Pending</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${myFee ? `<tr>
              <td>${e(myFee.name)}</td>
              <td>${e(className(myFee.class_id))}</td>
              <td>${money(myFee.amount)}</td>
              <td>${money(myFee.paid_amount)}</td>
              <td>${money(pending)}</td>
              <td><span class="bp ${feeClass(myFee.status)}">${e(myFee.status)}</span></td>
              <td>
                <div style="display:flex;gap:6px;">
                  ${pending > 0 ? `<button class="btn btn-sm btn-primary" onclick="payNow(${myFee.amount}, ${pending})"><i class="fas fa-credit-card"></i> Pay Now</button>` : ''}
                  ${myFee.paid_amount > 0 ? `<button class="btn btn-sm btn-outline" onclick="generateReceipt('${e(myFee.name)}', '${e(className(myFee.class_id))}', ${myFee.amount}, ${myFee.paid_amount})"><i class="fas fa-download"></i> Receipt</button>` : ''}
                </div>
              </td>
            </tr>` : `<tr><td colspan="7" style="text-align:center;padding:20px;">No fee records found</td></tr>`}
          </tbody>
        </table>
      </div>
      
      <!-- Fake Payment Gateway Modal -->
      ${modal('modalPayment', 'Secure Payment Gateway (Simulation)', `
        <div class="modal-body">
          <p>This is a simulated payment flow to impress management.</p>
          <div class="form-group"><label>Amount to Pay</label><input type="text" id="payAmount" readonly style="font-weight:bold; font-size:18px;"></div>
          <div class="form-group"><label>Card Number</label><input type="text" value="XXXX-XXXX-XXXX-4242" readonly></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="document.getElementById('modalPayment').classList.remove('open')">Cancel</button>
          <button class="btn btn-success" onclick="completePayment()"><i class="fas fa-lock"></i> Pay Securely</button>
        </div>
      `)}

      <script>
        function payNow(total, pending) {
          document.getElementById('payAmount').value = 'Rs. ' + pending;
          document.getElementById('modalPayment').classList.add('open');
        }
        function completePayment() {
          alert('Payment Successful! (This is a dummy flow)');
          document.getElementById('modalPayment').classList.remove('open');
          // In a real app, this would submit a form to update DB
          location.reload();
        }
        function generateReceipt(name, cls, total, paid) {
          const receiptHtml = \`
            <div id="receipt" style="padding: 40px; font-family: 'Sora', sans-serif; border: 2px solid #ccc; background: #fff; max-width: 650px; margin: 0 auto; box-sizing: border-box;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #2a5a8c; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="color: #2a5a8c; margin: 0;">Vidya Mandir</h2>
                <h3 style="margin: 0; color: #555;">FEE RECEIPT</h3>
              </div>
              <p><b>Date:</b> \${new Date().toLocaleDateString('en-IN')}</p>
              <p><b>Received with thanks from:</b> \${name}</p>
              <p><b>Class:</b> \${cls}</p>
              <table style="width:100%; margin-top:20px; border-collapse: collapse;">
                <tr><td style="padding:8px; border:1px solid #ccc; font-weight:bold;">Total Fees</td><td style="padding:8px; border:1px solid #ccc;">Rs. \${total}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ccc; font-weight:bold; background:#e4f4ed;">Amount Paid</td><td style="padding:8px; border:1px solid #ccc; background:#e4f4ed;"><b>Rs. \${paid}</b></td></tr>
                <tr><td style="padding:8px; border:1px solid #ccc; font-weight:bold;">Pending Balance</td><td style="padding:8px; border:1px solid #ccc;">Rs. \${total - paid}</td></tr>
              </table>
              <div style="margin-top:40px; text-align:right;">
                <p><b>Authorized Signature</b></p>
                <p>-------------------------</p>
              </div>
            </div>
          \`;
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'fixed';
          tempDiv.style.left = '-9999px';
          tempDiv.style.top = '0';
          tempDiv.style.width = '700px';
          tempDiv.style.background = '#fff';
          tempDiv.innerHTML = receiptHtml;
          document.body.appendChild(tempDiv);
          html2pdf().from(tempDiv.firstElementChild).set({ margin: 20, filename: name.replace(' ', '_') + '_Receipt.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save().then(() => tempDiv.remove());
        }
      </script>
    `));
  } else {
    const feesAggr = await Fee.aggregate([
      { $group: { _id: null, collected: { $sum: '$paid_amount' }, pending: { $sum: { $subtract: ['$amount', '$paid_amount'] } }, overdue: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] } } } }
    ]);
    const stats = feesAggr[0] || { collected: 0, pending: 0, overdue: 0 };
    const feesRaw = await Fee.find().populate('student', 'name class_id').sort({ _id: -1 });
    const feesList = feesRaw.filter(f => f.student).map(f => ({ id: String(f._id), name: f.student.name, class_id: f.student.class_id, amount: f.amount, paid_amount: f.paid_amount, status: f.status }));
    
    const actionHeader = isAdmin ? '<th style="text-align:center;width:100px;">Action</th>' : '';
    
    res.send(layout(req, 'fees', `
      <div class="stats-grid">
        <div class="stat-card green"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-value">${money(stats.collected)}</div><div class="stat-label">Collected</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div><div class="stat-value">${money(stats.pending)}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-value">${stats.overdue}</div><div class="stat-label">Overdue</div></div>
      </div>
      
      <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
        <div style="position: relative; width: 100%; max-width: 320px;">
          <i class="fas fa-search" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text3);"></i>
          <input type="text" id="feeSearch" placeholder="Search by student or class..." style="width: 100%; padding: 10px 14px 10px 40px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 14px; outline: none;">
        </div>
      </div>

      <div class="card">
        <table>
          <thead>
            <tr><th>Student</th><th>Class</th><th>Total Fee</th><th>Paid</th><th>Pending</th><th>Status</th>${actionHeader}</tr>
          </thead>
          <tbody>
            ${feesList.map((f) => {
              const pendingVal = f.amount - f.paid_amount;
              const actionCell = isAdmin ? `<td style="text-align:center;">
                <div style="display:flex;gap:6px;justify-content:center;">
                  <button class="btn btn-sm btn-outline btn-icon" onclick="openEditFee('${f.id}', '${e(f.name)}', ${f.amount}, ${f.paid_amount}, '${e(f.status)}')" title="Edit Fee"><i class="fas fa-edit"></i></button>
                  ${f.paid_amount > 0 ? `<button class="btn btn-sm btn-outline btn-icon" onclick="generateReceipt('${e(f.name)}', '${e(className(f.class_id))}', ${f.amount}, ${f.paid_amount})" title="Download Receipt"><i class="fas fa-file-pdf"></i></button>` : ''}
                </div>
              </td>` : '';
              return `<tr class="fee-row" data-name="${e(f.name)}" data-class="Class ${e(className(f.class_id))}">
                <td>${e(f.name)}</td>
                <td>${e(className(f.class_id))}</td>
                <td>${money(f.amount)}</td>
                <td>${money(f.paid_amount)}</td>
                <td>${money(pendingVal)}</td>
                <td><span class="bp ${feeClass(f.status)}">${e(f.status)}</span></td>
                ${actionCell}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      ${isAdmin ? modal('modalEditFee', 'Edit Fee Details', `
        <form method="post" id="editFeeForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group form-full"><label>Student Name</label><input id="efStudentName" readonly style="background:#f4f6f9;"></div>
              <div class="form-group"><label>Total Fee Amount</label><input type="number" name="amount" id="efAmount" required></div>
              <div class="form-group"><label>Paid Amount</label><input type="number" name="paid_amount" id="efPaid" required></div>
              <div class="form-group form-full">
                <label>Payment Status</label>
                <select name="status" id="efStatus" required>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalEditFee').classList.remove('open')">Cancel</button>
            <button class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>
          </div>
        </form>
      `) : ''}

      <script>
        function openEditFee(id, name, amount, paid, status) {
          document.getElementById('editFeeForm').action = '/fees/' + id + '/edit';
          document.getElementById('efStudentName').value = name;
          document.getElementById('efAmount').value = amount;
          document.getElementById('efPaid').value = paid;
          document.getElementById('efStatus').value = status;
          document.getElementById('modalEditFee').classList.add('open');
        }

        const searchInput = document.getElementById('feeSearch');
        if (searchInput) {
          searchInput.addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.fee-row').forEach(row => {
              const name = (row.dataset.name || '').toLowerCase();
              const cls = (row.dataset.class || '').toLowerCase();
              if (name.includes(term) || cls.includes(term)) {
                row.style.display = '';
              } else {
                row.style.display = 'none';
              }
            });
          });
        }
        
        function generateReceipt(name, cls, total, paid) {
          const receiptHtml = \`
            <div id="receipt" style="padding: 40px; font-family: 'Sora', sans-serif; border: 2px solid #ccc; background: #fff; max-width: 650px; margin: 0 auto; box-sizing: border-box;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #2a5a8c; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="color: #2a5a8c; margin: 0;">Vidya Mandir</h2>
                <h3 style="margin: 0; color: #555;">FEE RECEIPT</h3>
              </div>
              <p><b>Date:</b> \${new Date().toLocaleDateString('en-IN')}</p>
              <p><b>Received with thanks from:</b> \${name}</p>
              <p><b>Class:</b> \${cls}</p>
              <table style="width:100%; margin-top:20px; border-collapse: collapse;">
                <tr><td style="padding:8px; border:1px solid #ccc; font-weight:bold;">Total Fees</td><td style="padding:8px; border:1px solid #ccc;">Rs. \${total}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ccc; font-weight:bold; background:#e4f4ed;">Amount Paid</td><td style="padding:8px; border:1px solid #ccc; background:#e4f4ed;"><b>Rs. \${paid}</b></td></tr>
                <tr><td style="padding:8px; border:1px solid #ccc; font-weight:bold;">Pending Balance</td><td style="padding:8px; border:1px solid #ccc;">Rs. \${total - paid}</td></tr>
              </table>
              <div style="margin-top:40px; text-align:right;">
                <p><b>Authorized Signature</b></p>
                <p>-------------------------</p>
              </div>
            </div>
          \`;
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'fixed';
          tempDiv.style.left = '-9999px';
          tempDiv.style.top = '0';
          tempDiv.style.width = '700px';
          tempDiv.style.background = '#fff';
          tempDiv.innerHTML = receiptHtml;
          document.body.appendChild(tempDiv);
          html2pdf().from(tempDiv.firstElementChild).set({ margin: 20, filename: name.replace(' ', '_') + '_Receipt.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save().then(() => tempDiv.remove());
        }
      </script>
    `));
  }
}

async function updateFee(req, res) {
  const id = req.params.id;
  const { amount, paid_amount, status } = req.body;

  const feeDoc = await Fee.findById(id);
  if (feeDoc) {
    feeDoc.amount = amount;
    feeDoc.paid_amount = paid_amount;
    feeDoc.status = status;
    if (status === 'Paid') feeDoc.paid_date = today();
    await feeDoc.save();

    await Student.findByIdAndUpdate(feeDoc.student, { fee_status: status });
  }

  req.session.flash = { type: 'success', message: 'Student fee details updated successfully.' };
  res.redirect('/fees');
}

async function notice(req, res) {
  const user = req.session.user;
  const admin = user.role === 'admin';
  const noticesRaw = await Notice.find().sort({ notice_date: -1 });
  const notices = noticesRaw.map(n => ({ id: String(n._id), title: n.title, type: n.type, audience: n.audience, notice_date: n.notice_date }));
  
  const addBtn = admin ? `<button class="btn btn-primary" onclick="document.getElementById('modalAddNotice').classList.add('open')"><i class="fas fa-plus"></i> Add Notice</button>` : '';

  function getNoticeIcon(type) {
    switch (type) {
      case 'holiday': return { icon: 'fa-calendar-times', bg: '#fcecea', color: '#c0392b' };
      case 'event': return { icon: 'fa-trophy', bg: '#f3e8fa', color: '#7d1a8c' };
      case 'academic': return { icon: 'fa-graduation-cap', bg: '#fdf3dc', color: '#a06a00' };
      default: return { icon: 'fa-bullhorn', bg: '#e8f0fa', color: 'var(--primary-light)' };
    }
  }

  const noticesListHtml = notices.length ? notices.map((n) => {
    const ico = getNoticeIcon(n.type);
    return `
      <div class="notice-item" style="display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border);transition:all 0.2s;" onmouseover="this.style.background='#fcfdfe'" onmouseout="this.style.background='transparent'">
        <div class="ni-icon" style="background:${ico.bg};color:${ico.color};width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:16px;font-size:16px;flex-shrink:0;">
          <i class="fas ${ico.icon}"></i>
        </div>
        <div class="ni-text" style="flex:1;">
          <p style="font-weight:600;margin:0 0 6px 0;color:var(--text1);font-size:14.5px;line-height:1.4;">${e(n.title)}</p>
          <span style="font-size:11.5px;color:var(--text3);font-weight:500;display:inline-flex;align-items:center;gap:12px;">
            <span><i class="far fa-calendar-alt" style="margin-right:5px;"></i>${fmtDate(n.notice_date)}</span>
            <span style="opacity:0.3;">|</span>
            <span><i class="far fa-user" style="margin-right:5px;"></i>${e(n.audience)}</span>
            <span style="opacity:0.3;">|</span>
            <span class="bp" style="background:${ico.bg};color:${ico.color};font-size:9.5px;padding:1px 6px;text-transform:capitalize;border-radius:4px;font-weight:600;">${n.type}</span>
          </span>
        </div>
        ${admin ? `
        <form method="post" action="/notice/${n.id}/delete" onsubmit="return confirm('Delete this notice?');" style="margin-left:16px;margin-bottom:0;">
          <button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger);border-color:var(--danger);width:34px;height:34px;border-radius:8px;" title="Delete Notice"><i class="fas fa-trash"></i></button>
        </form>
        ` : ''}
      </div>
    `;
  }).join('') : `<div style="text-align:center;padding:40px;color:var(--text3);"><i class="fas fa-bullhorn" style="font-size:32px;margin-bottom:12px;opacity:0.3;"></i><br>No notices posted yet</div>`;

  res.send(layout(req, 'notice', `
    <div class="section-header">
      <div>
        <div class="section-title">Notice Board</div>
        <div class="section-sub">Latest news, announcements, and school updates</div>
      </div>
      ${addBtn}
    </div>
    
    <div class="card" style="padding:0;">
      <div class="card-body" style="padding:0;">
        ${noticesListHtml}
      </div>
    </div>

    ${admin ? modal('modalAddNotice', 'Add New Announcement', `
      <form method="post" action="/notice">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>Notice / Announcement Content</label>
              <textarea name="title" required placeholder="Type the notice content or announcement here..." style="width:100%;min-height:90px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;outline:none;" class="form-control"></textarea>
            </div>
            <div class="form-group">
              <label>Target Audience</label>
              <input type="text" name="audience" value="All Classes" placeholder="e.g. All Classes, Teachers, Class 10th" required>
            </div>
            <div class="form-group">
              <label>Publish Date</label>
              <input type="date" name="notice_date" value="${today()}" required>
            </div>
            <div class="form-group form-full">
              <label>Announcement Type</label>
              <select name="type" required>
                <option value="general">General Announcement</option>
                <option value="academic">Academic / Exams</option>
                <option value="event">Event / Sports</option>
                <option value="holiday">Holiday Notice</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modalAddNotice').classList.remove('remove');document.getElementById('modalAddNotice').classList.remove('open')">Cancel</button>
          <button class="btn btn-primary"><i class="fas fa-bullhorn"></i> Publish Notice</button>
        </div>
      </form>
    `) : ''}

    <script>
      document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
    </script>
  `));
}

async function addNotice(req, res) {
  const { title, audience, notice_date, type } = req.body;
  await Notice.create({ title, audience, notice_date, type });
  req.session.flash = { type: 'success', message: 'Notice published successfully!' };
  res.redirect('/notice');
}

async function deleteNotice(req, res) {
  await Notice.findByIdAndDelete(req.params.id);
  req.session.flash = { type: 'success', message: 'Notice deleted successfully.' };
  res.redirect('/notice');
}

async function timetable(req, res) {
  const user = req.session.user;
  const admin = user.role === 'admin';
  const isStudent = user.role === 'student';
  
  let classes = [];
  let classId = '';

  if (admin || user.role === 'teacher') {
    const classesRaw = await Class.find().sort({ _id: 1 });
    classes = classesRaw.map(c => ({ id: String(c._id), label: c.label }));
    classId = req.query.class || classes[0]?.id || '';
  } else if (isStudent) {
    const cDoc = await Class.findById(user.class_id);
    if (cDoc) classes = [{ id: String(cDoc._id), label: cDoc.label }];
    classId = user.class_id;
  }
  
  const rowsRaw = classId ? await Timetable.find({ class_id: classId }).sort({ start_time: 1 }) : [];
  const rows = rowsRaw.map(r => ({ id: String(r._id), start_time: r.start_time, end_time: r.end_time, monday: r.monday, tuesday: r.tuesday, wednesday: r.wednesday, thursday: r.thursday, friday: r.friday, saturday: r.saturday }));
  
  const classOptionsHtml = classes.map(c => `<option value="${e(c.id)}" ${c.id === classId ? 'selected' : ''}>Class ${e(className(c.id))}</option>`).join('');
  
  const addBtn = admin ? `<button class="btn btn-primary" onclick="document.getElementById('modalAddTimetable').classList.add('open')"><i class="fas fa-plus"></i> Add Period</button>` : '';

  const thead = `<tr><th>Time</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th>${admin ? '<th>Actions</th>' : ''}</tr>`;
  
  const tbody = rows.length ? rows.map(r => `
    <tr>
      <td class="tc" style="white-space:nowrap;">${String(r.start_time).slice(0, 5)} - ${String(r.end_time).slice(0, 5)}</td>
      <td>${e(r.monday)}</td>
      <td>${e(r.tuesday)}</td>
      <td>${e(r.wednesday)}</td>
      <td>${e(r.thursday)}</td>
      <td>${e(r.friday)}</td>
      <td>${e(r.saturday)}</td>
      ${admin ? `
      <td><div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-outline btn-icon" onclick="openEditTimetable('${r.id}', '${e(r.start_time).slice(0,5)}', '${e(r.end_time).slice(0,5)}', '${e(r.monday)}', '${e(r.tuesday)}', '${e(r.wednesday)}', '${e(r.thursday)}', '${e(r.friday)}', '${e(r.saturday)}')" title="Edit"><i class="fas fa-edit"></i></button>
        <form method="post" action="/timetable/${r.id}/delete" onsubmit="return confirm('Delete this period?');"><button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger);border-color:var(--danger);" title="Delete"><i class="fas fa-trash"></i></button></form>
      </div></td>
      ` : ''}
    </tr>
  `).join('') : `<tr><td colspan="${admin ? 8 : 7}" style="text-align:center;padding:30px;color:var(--text3);">No timetable entries found for this class</td></tr>`;

  let modalsHtml = '';
  if (admin) {
    modalsHtml = `
      ${modal('modalAddTimetable', 'Add Timetable Period', `
        <form method="post" action="/timetable">
          <input type="hidden" name="class_id" value="${e(classId)}">
          <div class="modal-body"><div class="form-grid">
            <div class="form-group"><label>Start Time</label><input type="time" name="start_time" required></div>
            <div class="form-group"><label>End Time</label><input type="time" name="end_time" required></div>
            <div class="form-group"><label>Monday</label><input type="text" name="monday"></div>
            <div class="form-group"><label>Tuesday</label><input type="text" name="tuesday"></div>
            <div class="form-group"><label>Wednesday</label><input type="text" name="wednesday"></div>
            <div class="form-group"><label>Thursday</label><input type="text" name="thursday"></div>
            <div class="form-group"><label>Friday</label><input type="text" name="friday"></div>
            <div class="form-group"><label>Saturday</label><input type="text" name="saturday"></div>
          </div></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalAddTimetable').classList.remove('open')">Cancel</button>
            <button class="btn btn-primary"><i class="fas fa-save"></i> Save Period</button>
          </div>
        </form>
      `)}
      
      ${modal('modalEditTimetable', 'Edit Timetable Period', `
        <form method="post" action="" id="editTimetableForm">
          <input type="hidden" name="class_id" value="${e(classId)}">
          <div class="modal-body"><div class="form-grid">
            <div class="form-group"><label>Start Time</label><input type="time" name="start_time" id="etStart" required></div>
            <div class="form-group"><label>End Time</label><input type="time" name="end_time" id="etEnd" required></div>
            <div class="form-group"><label>Monday</label><input type="text" name="monday" id="etMon"></div>
            <div class="form-group"><label>Tuesday</label><input type="text" name="tuesday" id="etTue"></div>
            <div class="form-group"><label>Wednesday</label><input type="text" name="wednesday" id="etWed"></div>
            <div class="form-group"><label>Thursday</label><input type="text" name="thursday" id="etThu"></div>
            <div class="form-group"><label>Friday</label><input type="text" name="friday" id="etFri"></div>
            <div class="form-group"><label>Saturday</label><input type="text" name="saturday" id="etSat"></div>
          </div></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalEditTimetable').classList.remove('open')">Cancel</button>
            <button class="btn btn-primary"><i class="fas fa-save"></i> Update Period</button>
          </div>
        </form>
      `)}
      <script>
        function openEditTimetable(id, start, end, mon, tue, wed, thu, fri, sat) {
          document.getElementById('editTimetableForm').action = '/timetable/' + id + '/edit';
          document.getElementById('etStart').value = start;
          document.getElementById('etEnd').value = end;
          document.getElementById('etMon').value = mon;
          document.getElementById('etTue').value = tue;
          document.getElementById('etWed').value = wed;
          document.getElementById('etThu').value = thu;
          document.getElementById('etFri').value = fri;
          document.getElementById('etSat').value = sat;
          document.getElementById('modalEditTimetable').classList.add('open');
        }
      </script>
    `;
  }

  const selectClassCard = isStudent ? '' : `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-body">
        <form method="get" action="/timetable" class="form-grid" style="align-items:end;margin:0;">
          <div class="form-group" style="max-width:300px;">
            <label>Select Class</label>
            <select name="class" onchange="this.form.submit()">${classOptionsHtml}</select>
          </div>
        </form>
      </div>
    </div>
  `;

  res.send(layout(req, 'timetable', `
    <div class="section-header">
      <div>
        <div class="section-title">Timetable</div>
        <div class="section-sub">Class ${e(className(classId))}</div>
      </div>
      ${addBtn}
    </div>
    
    ${selectClassCard}
    
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="timetable">
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </div>
    ${modalsHtml}
  `));
}

async function results(req, res) {
  const resultsRaw = await Result.find().populate('student', 'name class_id').sort({ _id: 1 });
  const rows = resultsRaw.filter(r => r.student).map(r => ({ id: String(r._id), name: r.student.name, class_id: r.student.class_id, exam_name: r.exam_name, subject: r.subject, marks_obtained: r.marks_obtained, total_marks: r.total_marks, grade: r.grade }));
  res.send(layout(req, 'results', `<div class="section-header"><div><div class="section-title">Results & Exams</div><div class="section-sub">Exam results from database</div></div></div><div class="card"><table><thead><tr><th>Student</th><th>Class</th><th>Exam</th><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(r.name)}</td><td>${e(className(r.class_id))}</td><td>${e(r.exam_name)}</td><td>${e(r.subject)}</td><td>${r.marks_obtained}/${r.total_marks}</td><td><span class="bp green">${e(r.grade)}</span></td></tr>`).join('')}</tbody></table></div>`));
}

async function settings(req, res) {
  const rows = await Setting.find();
  const settingsMap = Object.fromEntries(rows.map((r) => [r._id, r.svalue]));
  res.send(layout(req, 'settings', `<div class="section-header"><div><div class="section-title">Settings</div></div><button form="settingsForm" class="btn btn-primary"><i class="fas fa-save"></i> Save</button></div><form method="post" action="/settings" id="settingsForm" class="card"><div class="card-body"><div class="form-grid">${['school_name','board','school_code','principal','phone','address'].map((k) => `<div class="form-group ${k === 'address' || k === 'school_name' ? 'form-full' : ''}"><label>${k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())}</label>${k === 'address' ? `<textarea name="${k}">${e(settingsMap[k])}</textarea>` : `<input name="${k}" value="${e(settingsMap[k])}">`}</div>`).join('')}</div></div></form>`));
}

async function saveSettings(req, res) {
  for (const [key, value] of Object.entries(req.body)) {
    await Setting.findByIdAndUpdate(key, { svalue: value }, { upsert: true });
  }
  req.session.flash = { type: 'success', message: 'Settings saved successfully.' };
  res.redirect('/settings');
}

async function addTeacher(req, res) {
  const { name, subject, qualification, experience_years, phone, email, salary } = req.body;
  let classes = req.body.classes || [];
  if (!Array.isArray(classes)) classes = [classes];

  const BG_PALETTE = ['#e8f0fa','#e4f4ed','#fdf3dc','#fcecea','#f3e8fa','#e8e8fa','#fae8fa','#e8faf3','#faf0e8'];
  const TC_PALETTE = ['#1a5da0','#1e7d5a','#a06a00','#c0392b','#7d1a8c','#3a3a9a','#8c1a7d','#1a8c6a','#8c6a1a'];
  const ridx = Math.floor(Math.random() * BG_PALETTE.length);

  const validClasses = classes.filter(Boolean);
  await Teacher.create({ name, subject, qualification, experience_years: experience_years || 0, phone: phone || '', email: email || '', bg_color: BG_PALETTE[ridx], text_color: TC_PALETTE[ridx], salary: salary || 35000, classes: validClasses });

  req.session.flash = { type: 'success', message: 'Teacher added successfully.' };
  res.redirect('/teachers');
}

async function updateTeacher(req, res) {
  const id = req.params.id;
  const { name, subject, qualification, experience_years, phone, email, salary } = req.body;
  let classes = req.body.classes || [];
  if (!Array.isArray(classes)) classes = [classes];

  const validClasses = classes.filter(Boolean);
  await Teacher.findByIdAndUpdate(id, { name, subject, qualification, experience_years: experience_years || 0, phone: phone || '', email: email || '', salary: salary || 35000, classes: validClasses });

  req.session.flash = { type: 'success', message: 'Teacher updated successfully.' };
  res.redirect('/teachers');
}

async function toggleTeacher(req, res) {
  const id = req.params.id;
  const teacher = await Teacher.findById(id);
  if (teacher) {
    teacher.disabled = !teacher.disabled;
    await teacher.save();
  }
  req.session.flash = { type: 'success', message: 'Teacher status toggled.' };
  res.redirect('/teachers');
}

async function addTimetable(req, res) {
  const { class_id, start_time, end_time, monday, tuesday, wednesday, thursday, friday, saturday } = req.body;
  await Timetable.create({ class_id, start_time, end_time, monday: monday||'', tuesday: tuesday||'', wednesday: wednesday||'', thursday: thursday||'', friday: friday||'', saturday: saturday||'' });
  req.session.flash = { type: 'success', message: 'Timetable period added.' };
  res.redirect('/timetable?class=' + class_id);
}

async function updateTimetable(req, res) {
  const id = req.params.id;
  const { class_id, start_time, end_time, monday, tuesday, wednesday, thursday, friday, saturday } = req.body;
  await Timetable.findByIdAndUpdate(id, { start_time, end_time, monday: monday||'', tuesday: tuesday||'', wednesday: wednesday||'', thursday: thursday||'', friday: friday||'', saturday: saturday||'' });
  req.session.flash = { type: 'success', message: 'Timetable period updated.' };
  res.redirect('/timetable?class=' + class_id);
}

async function deleteTimetable(req, res) {
  const id = req.params.id;
  const row = await Timetable.findById(req.params.id);
  await Timetable.findByIdAndDelete(req.params.id);
  req.session.flash = { type: 'success', message: 'Timetable period deleted.' };
  res.redirect(row ? '/timetable?class=' + row.class_id : '/timetable');
}

module.exports = { dashboard, students, addStudent, updateStudent, deleteStudent, addClass, teachers, addTeacher, updateTeacher, toggleTeacher, attendance, exportAttendance, saveAttendance, fees, updateFee, notice, addNotice, deleteNotice, timetable, addTimetable, updateTimetable, deleteTimetable, results, settings, saveSettings };


