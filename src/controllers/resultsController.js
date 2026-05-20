const Result = require('../models/Result');
const Student = require('../models/Student');
const Class = require('../models/Class');
const { e, className } = require('../utils/format');
const { layout, modal } = require('../views/layout');

function getGrade(marks, total) {
  const percentage = (marks / total) * 100;
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

async function results(req, res) {
  const user = req.session.user;
  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';
  const isStudent = user.role === 'student';

  const filterClass = req.query.class || '';

  // Get distinct classes for filters
  const classesList = await Class.find().sort({ _id: 1 });

  // Fetch all results to group by student
  const resultsRaw = await Result.find().populate('student', 'name class_id').sort({ exam_name: 1, subject: 1 });
  const resultsRows = resultsRaw.filter(r => r.student).map(r => ({
    id: r._id, student_id: String(r.student._id), student_name: r.student.name, class_id: r.student.class_id,
    exam_name: r.exam_name, subject: r.subject, marks_obtained: r.marks_obtained, total_marks: r.total_marks, grade: r.grade
  }));

  // Group results: student_id -> exam_name -> array of subjects
  const studentExams = {};
  resultsRows.forEach(r => {
    if (!studentExams[r.student_id]) {
      studentExams[r.student_id] = {};
    }
    if (!studentExams[r.student_id][r.exam_name]) {
      studentExams[r.student_id][r.exam_name] = [];
    }
    studentExams[r.student_id][r.exam_name].push({
      id: r.id,
      subject: r.subject,
      marks_obtained: r.marks_obtained,
      total_marks: r.total_marks,
      grade: r.grade
    });
  });

  if (isStudent) {
    // Student View
    const studentResultsList = resultsRows.filter(r => String(r.student_id) === String(user.student_id));
    
    // Get unique exam list
    const examsSet = new Set();
    studentResultsList.forEach(r => examsSet.add(r.exam_name));
    const examsList = Array.from(examsSet);
    
    // Determine selected exam
    const selectedExam = req.query.exam || (examsList.length > 0 ? examsList[0] : '');
    
    // Filter results to selected exam
    const examResults = studentResultsList.filter(r => r.exam_name === selectedExam);
    const totalRecords = examResults.length;
    
    let totalObtained = 0;
    let totalMax = 0;
    examResults.forEach(r => {
      totalObtained += r.marks_obtained;
      totalMax += r.total_marks;
    });

    const averagePercentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
    const overallGrade = totalMax > 0 ? getGrade(totalObtained, totalMax) : '-';

    res.send(layout(req, 'results', `
      <div class="section-header">
        <div>
          <div class="section-title">My Academic Results</div>
          <div class="section-sub">View your grades and exam performances</div>
        </div>
        ${totalRecords > 0 ? `
          <button class="btn btn-primary" onclick="downloadStudentFullReport()"><i class="fas fa-download"></i> Download Report Card</button>
        ` : ''}
      </div>

      <!-- Exam Selector -->
      ${examsList.length > 0 ? `
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-body" style="padding: 15px;">
            <div class="form-group" style="margin:0; width:100%; max-width:400px;">
              <label style="font-weight:600; margin-bottom:6px; display:block;">Select Exam</label>
              <select onchange="window.location.href='/results?exam=' + encodeURIComponent(this.value)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
                ${examsList.map(ex => `
                  <option value="${e(ex)}" ${ex === selectedExam ? 'selected' : ''}>${e(ex)}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 20px;">
        <div class="stat-card blue">
          <div class="stat-icon"><i class="fas fa-file-invoice"></i></div>
          <div class="stat-value">${examsList.length}</div>
          <div class="stat-label">Total Exams Given</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><i class="fas fa-percentage"></i></div>
          <div class="stat-value">${averagePercentage}%</div>
          <div class="stat-label">Exam Percentage</div>
        </div>
        <div class="stat-card gold">
          <div class="stat-icon"><i class="fas fa-award"></i></div>
          <div class="stat-value">${overallGrade}</div>
          <div class="stat-label">Exam Grade</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Subject-wise Performance - ${e(selectedExam || 'No Exam Selected')}</div>
        </div>
        <div class="card-body">
          ${totalRecords > 0 ? `
            <table style="width:100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #eee; text-align: left;">
                  <th style="padding:12px;">Subject</th>
                  <th style="padding:12px;">Marks Obtained</th>
                  <th style="padding:12px;">Total Marks</th>
                  <th style="padding:12px;">Progress</th>
                  <th style="padding:12px; text-align:center;">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${examResults.map(r => {
                  const pct = Math.round((r.marks_obtained / r.total_marks) * 100);
                  const progressColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
                  return `
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding:12px;"><b>${e(r.subject)}</b></td>
                      <td style="padding:12px;">${r.marks_obtained}</td>
                      <td style="padding:12px;">${r.total_marks}</td>
                      <td style="padding:12px; width: 200px;">
                        <div style="background:#eee; border-radius:4px; height:8px; overflow:hidden; width:100%;">
                          <div style="background:${progressColor}; width:${pct}%; height:100%; border-radius:4px;"></div>
                        </div>
                      </td>
                      <td style="padding:12px; text-align:center;">
                        <span class="bp ${r.grade === 'F' ? 'red' : r.grade.startsWith('A') ? 'green' : 'gold'}">${r.grade}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <div style="text-align: center; padding: 40px; color: #888;">
              <i class="fas fa-folder-open" style="font-size: 40px; margin-bottom: 10px;"></i>
              <p>No exam results published for the selected exam.</p>
            </div>
          `}
        </div>
      </div>

      <script>
        const myResults = ${JSON.stringify(examResults)};
        
        function downloadStudentFullReport() {
          const studentName = "${e(user.display_name)}";
          const studentClass = "Class ${e(className(user.class_id))}";
          const overallPct = ${averagePercentage};
          const overallGrd = "${overallGrade}";
          const examName = "${e(selectedExam)}";

          let rowsHtml = '';
          myResults.forEach(r => {
            rowsHtml += '<tr>' +
              '<td style="padding: 10px; border: 1px solid #ddd;">' + r.subject + '</td>' +
              '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">' + r.marks_obtained + '</td>' +
              '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">' + r.total_marks + '</td>' +
              '<td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">' + r.grade + '</td>' +
            '</tr>';
          });

          const html = 
            '<div style="padding: 40px; border: 10px double #2a5a8c; font-family: \\'Sora\\', sans-serif; max-width: 800px; margin: auto; background: #fff;">' +
              '<div style="text-align: center; margin-bottom: 30px;">' +
                '<h1 style="color: #2a5a8c; margin: 0; font-size: 28px; text-transform: uppercase;">Vidya Mandir School</h1>' +
                '<p style="margin: 5px 0 0; color: #666; font-size: 14px;">' + examName + ' Report Card</p>' +
                '<div style="height: 3px; background: #2a5a8c; width: 100px; margin: 15px auto 0;"></div>' +
              '</div>' +

              '<div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; background: #f8f9fa; padding: 15px; border-radius: 8px;">' +
                '<div>' +
                  '<p style="margin: 4px 0;"><b>Student Name:</b> ' + studentName + '</p>' +
                  '<p style="margin: 4px 0;"><b>Class:</b> ' + studentClass + '</p>' +
                '</div>' +
                '<div style="text-align: right;">' +
                  '<p style="margin: 4px 0;"><b>Overall Percentage:</b> ' + overallPct + '%</p>' +
                  '<p style="margin: 4px 0;"><b>Overall Grade:</b> ' + overallGrd + '</p>' +
                '</div>' +
              '</div>' +

              '<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">' +
                '<thead>' +
                  '<tr style="background: #2a5a8c; color: #fff; text-align: left;">' +
                    '<th style="padding: 10px; border: 1px solid #ddd;">Subject</th>' +
                    '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Marks Obtained</th>' +
                    '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Total Marks</th>' +
                    '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Grade</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody>' +
                  rowsHtml +
                '</tbody>' +
              '</table>' +

              '<div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 13px;">' +
                '<div style="text-align: center; width: 150px;">' +
                  '<div style="border-top: 1px solid #888; padding-top: 5px; color:#555;">Class Teacher</div>' +
                '</div>' +
                '<div style="text-align: center; width: 150px;">' +
                  '<div style="border-top: 1px solid #888; padding-top: 5px; color:#555;">Principal</div>' +
                '</div>' +
              '</div>' +
            '</div>';

          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'fixed';
          tempDiv.style.left = '-9999px';
          tempDiv.innerHTML = html;
          document.body.appendChild(tempDiv);

          html2pdf()
            .from(tempDiv.firstElementChild)
            .set({ 
              margin: 15, 
              filename: studentName.replace(/\\s+/g, '_') + '_' + examName.replace(/\\s+/g, '_') + '_ReportCard.pdf', 
              html2canvas: { scale: 2 }, 
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            })
            .save()
            .then(() => tempDiv.remove());
        }
      </script>
    `));
  } else {
    // Admin / Teacher View
    const studentsFilter = filterClass ? { class_id: filterClass } : {};
    const studentsRaw = await Student.find(studentsFilter).sort({ class_id: 1, name: 1 });
    const studentsList = studentsRaw.map(s => ({ id: String(s._id), name: s.name, roll_no: s.roll_no, class_id: s.class_id }));

    res.send(layout(req, 'results', `
      <div class="section-header">
        <div>
          <div class="section-title">Results & Exams</div>
          <div class="section-sub">Manage and view student academic reports</div>
        </div>
      </div>

      <!-- Filters -->
      <form method="get" action="/results" class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="display:flex; gap:15px; align-items:flex-end; flex-wrap:wrap;">
          <div class="form-group" style="margin:0; flex:1; min-width:200px;">
            <label>Filter by Class</label>
            <select name="class" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
              <option value="">All Classes</option>
              ${classesList.map(c => `
                <option value="${c.id}" ${c.id === filterClass ? 'selected' : ''}>Class ${e(className(c.id))}</option>
              `).join('')}
            </select>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="submit" class="btn btn-primary">Filter</button>
            <a href="/results" class="btn btn-outline" style="text-decoration:none;">Reset</a>
          </div>
        </div>
      </form>

      <div class="card">
        <div class="card-header"><div class="card-title">Students List & Reports</div></div>
        <div class="card-body" style="padding:0; overflow-x:auto;">
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #eee; text-align: left; background:#f8f9fa;">
                <th style="padding:12px 20px;">Student Name</th>
                <th style="padding:12px 20px;">Class</th>
                <th style="padding:12px 20px;">Roll No</th>
                <th style="padding:12px 20px; text-align:center;">Recorded Exams</th>
                <th style="padding:12px 20px; text-align:center; width:250px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${studentsList.length > 0 ? studentsList.map(s => {
                const exams = studentExams[s.id] || {};
                const examsCount = Object.keys(exams).length;
                return `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:12px 20px;"><b>${e(s.name)}</b></td>
                    <td style="padding:12px 20px;">Class ${e(className(s.class_id))}</td>
                    <td style="padding:12px 20px;">${e(s.roll_no)}</td>
                    <td style="padding:12px 20px; text-align:center;"><span class="bp blue">${examsCount} Exams</span></td>
                    <td style="padding:12px 20px; text-align:center;">
                      <div style="display:flex; justify-content:center; gap:8px;">
                        <button class="btn btn-sm btn-outline btn-view-result" data-id="${s.id}" data-name="${e(s.name)}" data-class="Class ${e(className(s.class_id))}">
                          <i class="fas fa-eye"></i> View Results
                        </button>
                        <button class="btn btn-sm btn-primary btn-manage-result" data-id="${s.id}" data-name="${e(s.name)}" data-class="Class ${e(className(s.class_id))}">
                          <i class="fas fa-plus"></i> Add/Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="5" style="padding:40px; text-align:center; color:#888;">
                    No students found in the selected class.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- View Results Modal -->
      ${modal('modalViewResults', 'Student Academic History', `
        <div class="modal-body">
          <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <div><b>Student:</b> <span id="viewStudentName"></span></div>
            <div><b>Class:</b> <span id="viewStudentClass"></span></div>
          </div>
          <div id="viewResultsContainer" style="max-height: 400px; overflow-y: auto; padding-right:5px;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" onclick="document.getElementById('modalViewResults').classList.remove('open')">Close</button>
        </div>
      `)}

      <!-- Add/Manage Results Modal -->
      ${modal('modalManageResults', 'Manage Student Subject Marks', `
        <form method="post" action="/results/manage">
          <input type="hidden" name="student_id" id="manageStudentId">
          <div class="modal-body">
            <div class="form-group form-full" style="margin-bottom:15px;">
              <label>Student</label>
              <input id="manageStudentName" readonly style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; background:#f4f6f9; font-family:inherit; font-weight:600;">
            </div>
            <div class="form-group form-full" style="margin-bottom:20px;">
              <label>Exam Name</label>
              <input name="exam_name" id="manageExamName" required placeholder="e.g. Half-Yearly Examination, Annual Examination" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
            </div>
            
            <div style="border-top:1px solid #eee; padding-top:15px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-weight:600; font-size:14px;">Subject Marks Sheet</div>
                <button type="button" class="btn btn-sm btn-outline" onclick="addSubjectRow()"><i class="fas fa-plus"></i> Add Subject</button>
              </div>
              <div id="subjectRowsContainer"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalManageResults').classList.remove('open')">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Results</button>
          </div>
        </form>
      `)}

      <script>
        document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open') }));

        const studentResults = ${JSON.stringify(studentExams)};

        function getGradeFromPct(pct) {
          if (pct >= 90) return 'A+';
          if (pct >= 80) return 'A';
          if (pct >= 70) return 'B+';
          if (pct >= 60) return 'B';
          if (pct >= 50) return 'C';
          if (pct >= 40) return 'D';
          return 'F';
        }

        // View Results button click
        document.querySelectorAll('.btn-view-result').forEach(btn => {
          btn.addEventListener('click', function() {
            const studentId = this.dataset.id;
            const studentName = this.dataset.name;
            const classNameStr = this.dataset.class;
            openViewModal(studentId, studentName, classNameStr);
          });
        });

        // Add/Manage button click
        document.querySelectorAll('.btn-manage-result').forEach(btn => {
          btn.addEventListener('click', function() {
            const studentId = this.dataset.id;
            const studentName = this.dataset.name;
            const classNameStr = this.dataset.class;
            openManageModal(studentId, studentName, classNameStr);
          });
        });

        function openViewModal(studentId, studentName, classNameStr) {
          var exams = studentResults[studentId] || {};
          var html = '';
          
          var examNames = Object.keys(exams);
          if (examNames.length === 0) {
            html = '<div style="padding:20px; text-align:center; color:#888;">No exam results recorded for this student.</div>';
          } else {
            examNames.forEach(function(examName) {
              var subjects = exams[examName];
              var totalObtained = 0;
              var totalMax = 0;
              
              var rowsHtml = '';
              subjects.forEach(function(s) {
                totalObtained += s.marks_obtained;
                totalMax += s.total_marks;
                var gradeClass = s.grade === 'F' ? 'red' : (s.grade.startsWith('A') ? 'green' : 'gold');
                rowsHtml += '<tr>' +
                  '<td style="padding:8px 12px;">' + s.subject + '</td>' +
                  '<td style="padding:8px 12px; text-align:center;"><b>' + s.marks_obtained + '</b> / ' + s.total_marks + '</td>' +
                  '<td style="padding:8px 12px; text-align:center;"><span class="bp ' + gradeClass + '">' + s.grade + '</span></td>' +
                '</tr>';
              });
              
              var pct = Math.round((totalObtained / totalMax) * 100);
              var overallGrade = getGradeFromPct(pct);
              
              html += 
                '<div style="margin-bottom:20px; border:1px solid #eee; border-radius:8px; overflow:hidden;">' +
                  '<div style="background:#f8f9fa; padding:10px 15px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee;">' +
                    '<div style="font-weight:600; color:var(--primary);">' + examName + '</div>' +
                    '<div style="font-size:12px; display:flex; gap:10px;">' +
                      '<span><b>Avg:</b> ' + pct + '%</span>' +
                      '<span><b>Grade:</b> ' + overallGrade + '</span>' +
                    '</div>' +
                  '</div>' +
                  '<table style="width:100%; border-collapse:collapse; font-size:13px;">' +
                    '<thead>' +
                      '<tr style="background:#fff; border-bottom:1px solid #eee; text-align:left; color:#666;">' +
                        '<th style="padding:8px 12px;">Subject</th>' +
                        '<th style="padding:8px 12px; text-align:center;">Marks</th>' +
                        '<th style="padding:8px 12px; text-align:center;">Grade</th>' +
                      '</tr>' +
                    '</thead>' +
                    '<tbody>' + rowsHtml + '</tbody>' +
                  '</table>' +
                  '<div style="padding:10px; display:flex; justify-content:space-between; background:#fafafa; border-top:1px solid #eee;">' +
                    '<button class="btn btn-sm btn-outline btn-edit-exam" style="color:var(--primary); border-color:var(--primary);" data-sid="' + studentId + '" data-sname="' + studentName + '" data-sclass="' + classNameStr + '" data-exam="' + examName + '">' +
                      '<i class="fas fa-edit"></i> Edit Marks' +
                    '</button>' +
                    '<button class="btn btn-sm btn-primary btn-download-pdf" data-sid="' + studentId + '" data-sname="' + studentName + '" data-sclass="' + classNameStr + '" data-exam="' + examName + '">' +
                      '<i class="fas fa-file-pdf"></i> Download PDF Report' +
                    '</button>' +
                  '</div>' +
                '</div>';
            });
          }
          
          document.getElementById('viewStudentName').textContent = studentName;
          document.getElementById('viewStudentClass').textContent = classNameStr;
          document.getElementById('viewResultsContainer').innerHTML = html;
          
          // Attach events to dynamically created buttons
          document.querySelectorAll('.btn-edit-exam').forEach(function(b) {
            b.onclick = function() {
              loadExamForEdit(b.dataset.sid, b.dataset.sname, b.dataset.sclass, b.dataset.exam);
            };
          });
          document.querySelectorAll('.btn-download-pdf').forEach(function(b) {
            b.onclick = function() {
              downloadSingleReportCard(b.dataset.sid, b.dataset.sname, b.dataset.sclass, b.dataset.exam);
            };
          });
          
          document.getElementById('modalViewResults').classList.add('open');
        }

        function openManageModal(studentId, studentName, classNameStr) {
          document.getElementById('manageStudentId').value = studentId;
          document.getElementById('manageStudentName').value = studentName + ' (' + classNameStr + ')';
          document.getElementById('manageExamName').value = '';
          
          var container = document.getElementById('subjectRowsContainer');
          container.innerHTML = '';
          
          for (var i = 0; i < 5; i++) {
            addSubjectRow();
          }
          
          document.getElementById('modalManageResults').classList.add('open');
        }

        function addSubjectRow(subject, marks, total) {
          subject = subject || '';
          marks = marks || '';
          total = total || '100';
          var container = document.getElementById('subjectRowsContainer');
          var div = document.createElement('div');
          div.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
          div.className = 'subject-input-row';
          div.innerHTML = 
            '<input type="text" name="subject[]" value="' + subject + '" placeholder="e.g. Mathematics" required style="flex:2; width:100%; min-width:0; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">' +
            '<input type="number" name="marks_obtained[]" value="' + marks + '" min="0" placeholder="Obtained" required style="flex:1; width:100%; min-width:0; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">' +
            '<input type="number" name="total_marks[]" value="' + total + '" min="1" placeholder="Total" required style="flex:1; width:100%; min-width:0; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">' +
            '<button type="button" class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger); padding:8px 12px; display:flex; align-items:center; justify-content:center;" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>';
          container.appendChild(div);
        }

        function loadExamForEdit(studentId, studentName, classNameStr, examName) {
          document.getElementById('modalViewResults').classList.remove('open');
          
          document.getElementById('manageStudentId').value = studentId;
          document.getElementById('manageStudentName').value = studentName + ' (' + classNameStr + ')';
          document.getElementById('manageExamName').value = examName;
          
          var container = document.getElementById('subjectRowsContainer');
          container.innerHTML = '';
          
          var subjects = studentResults[studentId] && studentResults[studentId][examName] || [];
          subjects.forEach(function(s) {
            addSubjectRow(s.subject, s.marks_obtained, s.total_marks);
          });
          
          document.getElementById('modalManageResults').classList.add('open');
        }

        function downloadSingleReportCard(studentId, studentName, classNameStr, examName) {
          var subjects = studentResults[studentId] && studentResults[studentId][examName] || [];
          var totalObtained = 0;
          var totalMax = 0;
          subjects.forEach(function(s) {
            totalObtained += Number(s.marks_obtained);
            totalMax += Number(s.total_marks);
          });
          var pct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
          var grade = getGradeFromPct(pct);

          var listHtml = '';
          subjects.forEach(function(s) {
            listHtml += '<tr>' +
              '<td style="padding: 10px; border: 1px solid #ddd;">' + s.subject + '</td>' +
              '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">' + s.marks_obtained + '</td>' +
              '<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">' + s.total_marks + '</td>' +
              '<td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">' + s.grade + '</td>' +
            '</tr>';
          });

          var reportHtml = 
            '<div style="padding: 40px; border: 10px double #2a5a8c; font-family: Sora, sans-serif; max-width: 800px; margin: auto; background: #fff;">' +
              '<div style="text-align: center; margin-bottom: 30px;">' +
                '<h1 style="color: #2a5a8c; margin: 0; font-size: 28px; text-transform: uppercase;">Vidya Mandir School</h1>' +
                '<p style="margin: 5px 0 0; color: #666; font-size: 14px;">' + examName + ' Report Card</p>' +
                '<div style="height: 3px; background: #2a5a8c; width: 100px; margin: 15px auto 0;"></div>' +
              '</div>' +
              '<div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; background: #f8f9fa; padding: 15px; border-radius: 8px;">' +
                '<div>' +
                  '<p style="margin: 4px 0;"><b>Student Name:</b> ' + studentName + '</p>' +
                  '<p style="margin: 4px 0;"><b>Class:</b> ' + classNameStr + '</p>' +
                '</div>' +
                '<div style="text-align: right;">' +
                  '<p style="margin: 4px 0;"><b>Overall Percentage:</b> ' + pct + '%</p>' +
                  '<p style="margin: 4px 0;"><b>Overall Grade:</b> ' + grade + '</p>' +
                '</div>' +
              '</div>' +
              '<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">' +
                '<thead>' +
                  '<tr style="background: #2a5a8c; color: #fff; text-align: left;">' +
                    '<th style="padding: 10px; border: 1px solid #ddd;">Subject</th>' +
                    '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Marks Obtained</th>' +
                    '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Total Marks</th>' +
                    '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Grade</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody>' + listHtml + '</tbody>' +
              '</table>' +
              '<div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 13px;">' +
                '<div style="text-align: center; width: 150px;">' +
                  '<div style="border-top: 1px solid #888; padding-top: 5px; color:#555;">Class Teacher</div>' +
                '</div>' +
                '<div style="text-align: center; width: 150px;">' +
                  '<div style="border-top: 1px solid #888; padding-top: 5px; color:#555;">Principal</div>' +
                '</div>' +
              '</div>' +
            '</div>';

          var tempDiv = document.createElement('div');
          tempDiv.style.position = 'fixed';
          tempDiv.style.left = '-9999px';
          tempDiv.innerHTML = reportHtml;
          document.body.appendChild(tempDiv);

          html2pdf()
            .from(tempDiv.firstElementChild)
            .set({ 
              margin: 15, 
              filename: studentName.replace(/\\s+/g, '_') + '_' + examName.replace(/\\s+/g, '_') + '_ReportCard.pdf', 
              html2canvas: { scale: 2 }, 
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            })
            .save()
            .then(function() { tempDiv.remove(); });
        }
      </script>
    `));
  }
}

async function manageResults(req, res) {
  const { student_id, exam_name } = req.body;
  const subjects = req.body.subject || [];
  const marks_obtained = req.body.marks_obtained || [];
  const total_marks = req.body.total_marks || [];

  try {
    await Result.deleteMany({ student: student_id, exam_name });

    for (let i = 0; i < subjects.length; i++) {
      const sub = subjects[i]?.trim();
      const marks = marks_obtained[i];
      const total = total_marks[i];

      if (sub && marks !== '' && total !== '') {
        const grade = getGrade(Number(marks), Number(total));
        await Result.create({ student: student_id, exam_name, subject: sub, marks_obtained: Number(marks), total_marks: Number(total), grade });
      }
    }

    req.session.flash = { type: 'success', message: `Results for '${exam_name}' saved successfully!` };
  } catch (err) {
    console.error('Error saving student results:', err);
    req.session.flash = { type: 'danger', message: 'Error saving results.' };
  }
  res.redirect('/results');
}

module.exports = { results, manageResults };
