const Homework = require('../models/Homework');
const Class = require('../models/Class');
const Student = require('../models/Student');
const { layout, modal } = require('../views/layout');
const { e, fmtDate } = require('../utils/format');

async function homework(req, res) {
  const user = req.session.user;
  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';
  const isStudent = user.role === 'student';

  const classesList = await Class.find().sort({ _id: 1 });
  const studentsList = await Student.find().sort({ name: 1 });

  let filter = {};
  if (isStudent) {
    filter = { class_id: user.class_id, $or: [{ student: null }, { student: user.student_id }] };
  } else if (isTeacher) {
    filter = { teacher: user.teacher_id };
  }

  const hwRaw = await Homework.find(filter)
    .populate('teacher', 'name')
    .populate('student', 'name')
    .sort({ due_date: -1 });

  // Map class labels
  const classMap = {};
  classesList.forEach(c => { classMap[c._id] = c.label; });

  const hwList = hwRaw.map(h => ({
    id: h._id,
    title: h.title,
    subject: h.subject,
    description: h.description || '',
    due_date: h.due_date,
    class_name: classMap[h.class_id] || h.class_id,
    teacher_name: h.teacher ? h.teacher.name : '',
    student_id: h.student ? h.student._id : null,
    assigned_student_name: h.student ? h.student.name : null,
  }));

  res.send(layout(req, 'homework', `
    <div class="section-header">
      <div>
        <div class="section-title">Homework & Assignments</div>
        <div class="section-sub">Manage and track student assignments</div>
      </div>
      ${!isStudent ? `<button class="btn btn-primary" onclick="document.getElementById('modalAddHomework').classList.add('open')"><i class="fas fa-plus"></i> Create Assignment</button>` : ''}
    </div>
    
    <div class="card">
      <div class="card-header"><div class="card-title">Current Assignments</div></div>
      <table>
        <thead><tr><th>Title</th><th>Subject</th><th>Assigned To</th><th>Due Date</th><th>Teacher</th><th>Action</th></tr></thead>
        <tbody>
          ${hwList.map(h => `
            <tr>
              <td><b>${e(h.title)}</b></td>
              <td>${e(h.subject)}</td>
              <td>
                Class ${e(h.class_name)} 
                ${h.student_id ? `<br><span class="bp blue" style="font-size:10px;">Specific Student: ${e(h.assigned_student_name)}</span>` : '<br><span class="bp green" style="font-size:10px;">Whole Class</span>'}
              </td>
              <td>${fmtDate(h.due_date)}</td>
              <td>${e(h.teacher_name)}</td>
              <td><button class="btn btn-sm btn-outline" onclick="document.getElementById('modalHw_${h.id}').classList.add('open')">View Details</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${hwList.map(h => modal('modalHw_' + h.id, 'Assignment Details', `
      <div class="modal-body">
        <h3 style="margin: 0 0 10px 0; color: var(--primary);">${e(h.title)}</h3>
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:13px; color:#555; background:#f8f9fa; padding:10px; border-radius:6px;">
          <div><b>Subject:</b> ${e(h.subject)}</div>
          <div><b>Due Date:</b> ${fmtDate(h.due_date)}</div>
          <div><b>Teacher:</b> ${e(h.teacher_name)}</div>
        </div>
        <div style="font-size: 14px; line-height: 1.6; color: var(--text2); white-space: pre-wrap;">${e(h.description)}</div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" onclick="document.getElementById('modalHw_${h.id}').classList.remove('open')">Close</button>
      </div>
    `)).join('')}

    ${!isStudent ? modal('modalAddHomework', 'Create New Assignment', `
      <form method="post" action="/homework">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-full"><label>Assignment Title</label><input name="title" required placeholder="e.g. Chapter 1 Exercise"></div>
            
            <div class="form-group"><label>Class</label>
              <select name="class_id" id="hwClassSelect" required onchange="filterStudents()">
                <option value="">Select Class...</option>
                ${classesList.map(c => `<option value="${c._id}">Class ${e(c.label)}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group"><label>Assign To</label>
              <select name="assign_type" id="hwAssignType" required onchange="toggleStudentSelect()">
                <option value="class">Whole Class</option>
                <option value="student">Specific Student</option>
              </select>
            </div>
            
            <div class="form-group form-full" id="studentSelectWrapper" style="display:none;"><label>Select Student</label>
              <select name="student_id" id="hwStudentSelect" style="width:100%;">
                <option value="">Select Student...</option>
                ${studentsList.map(s => `<option value="${s._id}" data-class="${s.class_id}">${e(s.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group"><label>Subject</label><input name="subject" required></div>
            <div class="form-group"><label>Due Date</label><input type="date" name="due_date" required></div>
            
            <div class="form-group form-full"><label>Detailed Description</label><textarea name="description" rows="5" required></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modalAddHomework').classList.remove('open')">Cancel</button>
          <button type="submit" class="btn btn-primary">Publish Assignment</button>
        </div>
      </form>
    `) : ''}
    <script>
      document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
      
      function toggleStudentSelect() {
        const type = document.getElementById('hwAssignType').value;
        const wrapper = document.getElementById('studentSelectWrapper');
        const select = document.getElementById('hwStudentSelect');
        if (type === 'student') {
          wrapper.style.display = 'block';
          select.required = true;
          filterStudents();
        } else {
          wrapper.style.display = 'none';
          select.required = false;
          select.value = '';
        }
      }
      
      function filterStudents() {
        const classId = document.getElementById('hwClassSelect').value;
        const options = document.querySelectorAll('#hwStudentSelect option[data-class]');
        options.forEach(opt => {
          if (opt.getAttribute('data-class') === classId) {
            opt.style.display = 'block';
          } else {
            opt.style.display = 'none';
          }
        });
        document.getElementById('hwStudentSelect').value = '';
      }
    </script>
  `));
}

async function addHomework(req, res) {
  const { class_id, subject, title, description, due_date, assign_type, student_id } = req.body;
  const teacher_id = req.session.user.teacher_id;
  const final_student_id = (assign_type === 'student' && student_id) ? student_id : null;

  await Homework.create({
    class_id, teacher: teacher_id, subject, title, description, due_date,
    student: final_student_id,
  });
  req.session.flash = { type: 'success', message: 'Assignment created successfully!' };
  res.redirect('/homework');
}

module.exports = { homework, addHomework };
