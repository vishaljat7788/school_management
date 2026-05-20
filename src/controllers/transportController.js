const TransportRoute = require('../models/TransportRoute');
const TransportStudent = require('../models/TransportStudent');
const TransportTeacher = require('../models/TransportTeacher');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const { layout, modal } = require('../views/layout');
const { e, fmtDate, money, className } = require('../utils/format');

async function transport(req, res) {
  const user = req.session.user;
  const isAdmin = user.role === 'admin';
  const isStudent = user.role === 'student';
  const isTeacher = user.role === 'teacher';

  const routesRaw = await TransportRoute.find();
  // Count approved members per route
  const routes = [];
  for (const r of routesRaw) {
    const sc = await TransportStudent.countDocuments({ route: r._id, status: 'Approved' });
    const tc = await TransportTeacher.countDocuments({ route: r._id, status: 'Approved' });
    routes.push({ id: r._id, route_name: r.route_name, vehicle_no: r.vehicle_no, driver_name: r.driver_name, driver_phone: r.driver_phone, fee: r.fee, student_count: sc, teacher_count: tc });
  }

  const tsRaw = await TransportStudent.find({ status: 'Approved' }).populate('student', 'name class_id roll_no father_name mother_name').populate('route');
  const studentsList = tsRaw.filter(t => t.student).map(t => ({
    route_id: t.route ? t.route._id : null, stop_name: t.stop_name, student_id: t.student._id,
    name: t.student.name, class_id: t.student.class_id, roll_no: t.student.roll_no,
    father_name: t.student.father_name || '', mother_name: t.student.mother_name || ''
  }));

  const ttRaw = await TransportTeacher.find({ status: 'Approved' }).populate('teacher', 'name phone email').populate('route');
  const teachersList = ttRaw.filter(t => t.teacher).map(t => ({
    route_id: t.route ? t.route._id : null, stop_name: t.stop_name, teacher_id: t.teacher._id,
    name: t.teacher.name, phone: t.teacher.phone, email: t.teacher.email
  }));

  const membersList = [
    ...studentsList.map(s => ({ type: 'student', id: s.student_id, route_id: s.route_id, name: s.name, class_name: `Class ${className(s.class_id)}`, roll_no: s.roll_no, stop_name: s.stop_name, father_name: s.father_name, mother_name: s.mother_name })),
    ...teachersList.map(t => ({ type: 'teacher', id: t.teacher_id, route_id: t.route_id, name: t.name, class_name: 'Staff / Teacher', roll_no: '-', stop_name: t.stop_name, father_name: 'N/A', mother_name: 'N/A' }))
  ];

  let allMembers = [];
  let pendingApplications = [];
  let myTransport = null;

  if (isAdmin) {
    const allStudents = await Student.find().sort({ name: 1 });
    const allTeachers = await Teacher.find().sort({ name: 1 });
    allMembers = [
      ...allStudents.map(s => ({ value: `student_${s._id}`, label: `${s.name} (Student - Class ${className(s.class_id)})` })),
      ...allTeachers.map(t => ({ value: `teacher_${t._id}`, label: `${t.name} (Teacher)` }))
    ];

    const psRaw = await TransportStudent.find({ status: 'Pending' }).populate('student', 'name class_id').populate('route', 'route_name');
    const ptRaw = await TransportTeacher.find({ status: 'Pending' }).populate('teacher', 'name').populate('route', 'route_name');
    pendingApplications = [
      ...psRaw.filter(p => p.student).map(p => ({ type: 'student', id: p.student._id, name: p.student.name, class_info: `Class ${className(p.student.class_id)}`, route_name: p.route ? p.route.route_name : '', stop_name: p.stop_name })),
      ...ptRaw.filter(p => p.teacher).map(p => ({ type: 'teacher', id: p.teacher._id, name: p.teacher.name, class_info: 'Staff / Teacher', route_name: p.route ? p.route.route_name : '', stop_name: p.stop_name }))
    ];
  }

  if (isStudent) {
    const myT = await TransportStudent.findOne({ student: user.student_id }).populate('route');
    if (myT && myT.route) myTransport = { route_name: myT.route.route_name, vehicle_no: myT.route.vehicle_no, driver_name: myT.route.driver_name, driver_phone: myT.route.driver_phone, stop_name: myT.stop_name, status: myT.status };
  } else if (isTeacher) {
    const myT = await TransportTeacher.findOne({ teacher: user.teacher_id }).populate('route');
    if (myT && myT.route) myTransport = { route_name: myT.route.route_name, vehicle_no: myT.route.vehicle_no, driver_name: myT.route.driver_name, driver_phone: myT.route.driver_phone, stop_name: myT.stop_name, status: myT.status };
  }

  // Helper to compare ObjectIds
  const idEq = (a, b) => String(a) === String(b);

  res.send(layout(req, 'transport', `
    <div class="section-header">
      <div>
        <div class="section-title">Transport Management</div>
        <div class="section-sub">${isStudent || isTeacher ? 'View routes and apply for school bus services' : 'Manage school buses, routes, and assigned students/staff'}</div>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="document.getElementById('modalAddRoute').classList.add('open')"><i class="fas fa-plus"></i> Add Route</button>` : ''}
    </div>

    ${(isStudent || isTeacher) && myTransport ? `
      <div class="card" style="margin-bottom: 20px; border-left: 4px solid ${myTransport.status === 'Approved' ? 'var(--success)' : myTransport.status === 'Rejected' ? 'var(--danger)' : 'var(--warning)'};">
        <div class="card-header">
          <div class="card-title">My Transport Application</div>
          <span class="bp ${myTransport.status === 'Approved' ? 'green' : myTransport.status === 'Rejected' ? 'red' : 'gold'}">${myTransport.status}</span>
        </div>
        <div class="card-body">
          <p><b>Route:</b> ${e(myTransport.route_name)}</p>
          <p><b>Stop Name:</b> ${e(myTransport.stop_name)}</p>
          ${myTransport.status === 'Approved' ? `
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
            <div style="display:flex; justify-content:space-between;">
              <div><b>Vehicle No:</b> ${e(myTransport.vehicle_no)}</div>
              <div><b>Driver:</b> ${e(myTransport.driver_name)} (${e(myTransport.driver_phone)})</div>
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}

    ${isAdmin && pendingApplications.length > 0 ? `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header"><div class="card-title">Pending Applications</div></div>
        <table>
          <thead><tr><th>Name</th><th>Class / Role</th><th>Requested Route</th><th>Stop Name</th><th>Action</th></tr></thead>
          <tbody>
            ${pendingApplications.map(p => `
              <tr>
                <td>${e(p.name)}</td>
                <td>${e(p.class_info)}</td>
                <td>${e(p.route_name)}</td>
                <td>${e(p.stop_name)}</td>
                <td>
                  <form method="post" style="display:inline;">
                    <input type="hidden" name="id" value="${p.id}">
                    <input type="hidden" name="type" value="${p.type}">
                    <button formaction="/transport/approve" class="btn btn-sm btn-primary">Approve</button>
                    <button formaction="/transport/reject" class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger); margin-left: 5px;">Reject</button>
                  </form>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
    
    <div class="grid-2">
      ${routes.map(r => {
        const routeMembersCount = r.student_count + r.teacher_count;
        return `
        <div class="card">
          <div class="card-header" style="background:#f8f9fa;">
            <div class="card-title" style="color:var(--primary);"><i class="fas fa-bus"></i> ${e(r.route_name)}</div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="bp green">${routeMembersCount} Members</span>
              ${isAdmin ? `
                <form method="post" action="/transport/delete-route" style="display:inline;" onsubmit="return confirm('Are you sure you want to delete this route?')">
                  <input type="hidden" name="route_id" value="${r.id}">
                  <button type="submit" class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 8px;" title="Delete Route"><i class="fas fa-trash"></i></button>
                </form>
              ` : ''}
            </div>
          </div>
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <div><b style="color:var(--text3);font-size:12px;">Vehicle No</b><br>${e(r.vehicle_no)}</div>
              <div style="text-align:right;"><b style="color:var(--text3);font-size:12px;">Monthly Fee</b><br>${money(r.fee)}</div>
            </div>
            ${isAdmin || isTeacher ? `
            <div style="display:flex; justify-content:space-between;">
              <div><b style="color:var(--text3);font-size:12px;">Driver</b><br>${e(r.driver_name)}</div>
              <div style="text-align:right;"><b style="color:var(--text3);font-size:12px;">Phone</b><br>${e(r.driver_phone)}</div>
            </div>` : ''}
          </div>
          <div class="card-footer" style="padding:10px 20px; border-top:1px solid #eee; text-align:center;">
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline" style="width:100%;" onclick="document.getElementById('modalRoute_${r.id}').classList.add('open')">View Members & Assign</button>
            ` : (!myTransport ? `
              <form method="post" action="/transport/apply" style="display:flex; gap:10px; width:100%;">
                <input type="hidden" name="route_id" value="${r.id}">
                <input type="text" name="stop_name" required placeholder="Enter your stop name" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
                <button type="submit" class="btn btn-sm btn-primary">Apply</button>
              </form>
            ` : `<span style="color:var(--text3); font-size:12px;">You already have an application.</span>`)}
          </div>
        </div>
      `; }).join('')}
    </div>

    ${isAdmin ? routes.map(r => modal('modalRoute_' + r.id, `Members on ${e(r.route_name)} <button class="btn btn-sm btn-outline" style="margin-left:15px; font-size:11px; padding:3px 8px; font-family:inherit; cursor:pointer;" onclick="downloadRoutePDF('${r.id}', '${e(r.route_name)}')"><i class="fas fa-file-pdf"></i> Download PDF</button>`, `
      <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
        <table style="width:100%; border-collapse: collapse;">
          <thead><tr style="border-bottom:2px solid #eee; text-align:left;"><th style="padding:10px;">Name</th><th style="padding:10px;">Class / Role</th><th style="padding:10px;">Roll No</th><th style="padding:10px;">Stop Name</th><th style="padding:10px; width:40px;"></th></tr></thead>
          <tbody>
            ${membersList.filter(s => idEq(s.route_id, r.id)).length > 0 ? 
              membersList.filter(s => idEq(s.route_id, r.id)).map(s => `
                <tr style="border-bottom:1px solid #eee; cursor:pointer;" onclick="showMemberDetails('${e(s.name)}', '${e(s.class_name)}', '${e(s.roll_no)}', '${e(s.stop_name)}', '${e(s.father_name || '')}', '${e(s.mother_name || '')}')">
                  <td style="padding:10px;"><a href="#" style="text-decoration:none; color:var(--primary); font-weight:600;" onclick="event.preventDefault();">${e(s.name)}</a></td>
                  <td style="padding:10px;">${e(s.class_name)}</td>
                  <td style="padding:10px;">${e(s.roll_no)}</td>
                  <td style="padding:10px;">${e(s.stop_name)}</td>
                  <td style="padding:10px; text-align:center;" onclick="event.stopPropagation()">
                    <form method="post" action="/transport/remove-student" onsubmit="return confirm('Remove member from route?')">
                      <input type="hidden" name="id" value="${s.id}">
                      <input type="hidden" name="type" value="${s.type}">
                      <button type="submit" class="btn btn-sm btn-outline" style="color:var(--danger); border:none; padding:4px 8px;" title="Remove"><i class="fas fa-times"></i></button>
                    </form>
                  </td>
                </tr>
              `).join('') 
              : '<tr><td colspan="5" style="padding:20px;text-align:center;color:#888;">No members assigned to this route.</td></tr>'
            }
          </tbody>
        </table>
        <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Assign New Member Directly</div>
          <form method="post" action="/transport/assign" style="display:flex; gap:10px;">
            <input type="hidden" name="route_id" value="${r.id}">
            <select name="member_val" required style="flex:1; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
              <option value="">Select Member...</option>
              ${allMembers.map(st => `<option value="${st.value}">${e(st.label)}</option>`).join('')}
            </select>
            <input type="text" name="stop_name" placeholder="Stop Name" required style="flex:1; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit;">
            <button type="submit" class="btn btn-sm btn-primary">Add</button>
          </form>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" onclick="document.getElementById('modalRoute_${r.id}').classList.remove('open')">Close</button>
      </div>
    `)).join('') : ''}

    ${isAdmin ? modal('modalStudentTransportDetail', 'Member Transport Details', `
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group"><label>Name</label><input id="tsdName" readonly style="background:#f4f6f9;"></div>
          <div class="form-group"><label>Class / Role</label><input id="tsdClass" readonly style="background:#f4f6f9;"></div>
          <div class="form-group"><label>Roll No</label><input id="tsdRoll" readonly style="background:#f4f6f9;"></div>
          <div class="form-group"><label>Stop Name</label><input id="tsdStop" readonly style="background:#f4f6f9;"></div>
          <div class="form-group"><label>Father Name</label><input id="tsdFather" readonly style="background:#f4f6f9;"></div>
          <div class="form-group"><label>Mother Name</label><input id="tsdMother" readonly style="background:#f4f6f9;"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" onclick="document.getElementById('modalStudentTransportDetail').classList.remove('open')">Close</button>
      </div>
    `) : ''}

    ${isAdmin ? modal('modalAddRoute', 'Add New Transport Route', `
      <form method="post" action="/transport">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-full"><label>Route Name</label><input name="route_name" required placeholder="e.g. Route 3 - Bopal"></div>
            <div class="form-group"><label>Vehicle Number</label><input name="vehicle_no" required placeholder="e.g. GJ-01-AB-1234"></div>
            <div class="form-group"><label>Monthly Fee</label><input type="number" name="fee" required value="1500"></div>
            <div class="form-group"><label>Driver Name</label><input name="driver_name" required></div>
            <div class="form-group"><label>Driver Phone</label><input name="driver_phone" required></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modalAddRoute').classList.remove('open')">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Route</button>
        </div>
      </form>
    `) : ''}
    <script>
      document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
      function showMemberDetails(name, cls, roll, stop, father, mother) {
        document.getElementById('tsdName').value = name;
        document.getElementById('tsdClass').value = cls;
        document.getElementById('tsdRoll').value = roll;
        document.getElementById('tsdStop').value = stop;
        document.getElementById('tsdFather').value = father || '-';
        document.getElementById('tsdMother').value = mother || '-';
        document.getElementById('modalStudentTransportDetail').classList.add('open');
      }
      var studentsData = ${JSON.stringify(membersList.map(s => ({ route_id: s.route_id, name: s.name, class_name: s.class_name, roll_no: s.roll_no, stop_name: s.stop_name, father_name: s.father_name, mother_name: s.mother_name })))};
      function downloadRoutePDF(routeId, routeName) {
        var routeStudents = studentsData.filter(function(s) { return String(s.route_id) === String(routeId); });
        var html = '<div style="padding:30px;font-family:Sora,sans-serif;"><h2 style="text-align:center;color:#2a5a8c;">Vidya Mandir School</h2><h4 style="text-align:center;color:#555;">Transport Route: ' + routeName + '</h4><hr><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f4f6f9;"><th style="padding:8px;border:1px solid #ddd;">Roll No</th><th style="padding:8px;border:1px solid #ddd;">Name</th><th style="padding:8px;border:1px solid #ddd;">Class</th><th style="padding:8px;border:1px solid #ddd;">Stop</th><th style="padding:8px;border:1px solid #ddd;">Father</th><th style="padding:8px;border:1px solid #ddd;">Mother</th></tr></thead><tbody>';
        if (routeStudents.length === 0) { html += '<tr><td colspan="6" style="padding:20px;text-align:center;color:#888;border:1px solid #ddd;">No members.</td></tr>'; }
        else { routeStudents.forEach(function(s) { html += '<tr><td style="padding:8px;border:1px solid #ddd;">'+s.roll_no+'</td><td style="padding:8px;border:1px solid #ddd;"><b>'+s.name+'</b></td><td style="padding:8px;border:1px solid #ddd;">'+s.class_name+'</td><td style="padding:8px;border:1px solid #ddd;">'+s.stop_name+'</td><td style="padding:8px;border:1px solid #ddd;">'+(s.father_name||'-')+'</td><td style="padding:8px;border:1px solid #ddd;">'+(s.mother_name||'-')+'</td></tr>'; }); }
        html += '</tbody></table></div>';
        var tempDiv = document.createElement('div'); tempDiv.innerHTML = html; document.body.appendChild(tempDiv);
        html2pdf().from(tempDiv.firstElementChild).set({ margin:15, filename: routeName.replace(/\\s+/g,'_')+'_Members.pdf', html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} }).save().then(function(){tempDiv.remove();});
      }
    </script>
  `));
}

async function addRoute(req, res) {
  const { route_name, vehicle_no, fee, driver_name, driver_phone } = req.body;
  await TransportRoute.create({ route_name, vehicle_no, driver_name, driver_phone, fee });
  req.session.flash = { type: 'success', message: 'Transport route added successfully!' };
  res.redirect('/transport');
}

async function assignStudent(req, res) {
  const { route_id, member_val, stop_name } = req.body;
  try {
    if (member_val.startsWith('teacher_')) {
      const tid = member_val.replace('teacher_', '');
      await TransportTeacher.findOneAndUpdate({ teacher: tid }, { teacher: tid, route: route_id, stop_name, status: 'Approved' }, { upsert: true });
    } else {
      const sid = member_val.replace('student_', '');
      await TransportStudent.findOneAndUpdate({ student: sid }, { student: sid, route: route_id, stop_name, status: 'Approved' }, { upsert: true });
    }
    req.session.flash = { type: 'success', message: 'Member assigned to route successfully!' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Error assigning member.' };
  }
  res.redirect('/transport');
}

async function applyRoute(req, res) {
  const { route_id, stop_name } = req.body;
  const user = req.session.user;
  try {
    if (user.role === 'teacher') {
      await TransportTeacher.findOneAndUpdate({ teacher: user.teacher_id }, { teacher: user.teacher_id, route: route_id, stop_name, status: 'Pending' }, { upsert: true });
    } else {
      await TransportStudent.findOneAndUpdate({ student: user.student_id }, { student: user.student_id, route: route_id, stop_name, status: 'Pending' }, { upsert: true });
    }
    req.session.flash = { type: 'success', message: 'Application submitted! Please wait for admin approval.' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Error applying for transport.' };
  }
  res.redirect('/transport');
}

async function approveRoute(req, res) {
  const { id, type } = req.body;
  if (type === 'teacher') { await TransportTeacher.updateOne({ teacher: id }, { status: 'Approved' }); }
  else { await TransportStudent.updateOne({ student: id }, { status: 'Approved' }); }
  req.session.flash = { type: 'success', message: 'Application approved.' };
  res.redirect('/transport');
}

async function rejectRoute(req, res) {
  const { id, type } = req.body;
  if (type === 'teacher') { await TransportTeacher.updateOne({ teacher: id }, { status: 'Rejected' }); }
  else { await TransportStudent.updateOne({ student: id }, { status: 'Rejected' }); }
  req.session.flash = { type: 'success', message: 'Application rejected.' };
  res.redirect('/transport');
}

async function deleteRoute(req, res) {
  await TransportRoute.findByIdAndDelete(req.body.route_id);
  await TransportStudent.deleteMany({ route: req.body.route_id });
  await TransportTeacher.deleteMany({ route: req.body.route_id });
  req.session.flash = { type: 'success', message: 'Route deleted successfully.' };
  res.redirect('/transport');
}

async function removeStudent(req, res) {
  const { id, type } = req.body;
  if (type === 'teacher') { await TransportTeacher.findOneAndDelete({ teacher: id }); }
  else { await TransportStudent.findOneAndDelete({ student: id }); }
  req.session.flash = { type: 'success', message: 'Member removed from route.' };
  res.redirect('/transport');
}

module.exports = { transport, addRoute, assignStudent, applyRoute, approveRoute, rejectRoute, deleteRoute, removeStudent };
