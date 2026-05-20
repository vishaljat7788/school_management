const Leave = require('../models/Leave');
const Teacher = require('../models/Teacher');
const Payroll = require('../models/Payroll');
const { layout, modal } = require('../views/layout');
const { e, fmtDate, money, today } = require('../utils/format');

function normalizeMonth(value) {
  return /^\d{4}-\d{2}$/.test(value || '') ? value : today().slice(0, 7);
}

async function staff(req, res) {
  const user = req.session.user;
  const isAdmin = user.role === 'admin';
  const selectedMonth = normalizeMonth(req.query.month);
  const activeTab = req.query.tab || 'payroll';

  if (isAdmin) {
    const leavesRaw = await Leave.find().populate('teacher', 'name').sort({ applied_on: -1 });
    const leaves = leavesRaw.map(l => ({ id: l._id, teacher_name: l.teacher ? l.teacher.name : '', start_date: l.start_date, end_date: l.end_date, reason: l.reason, applied_on: l.applied_on, status: l.status }));

    const payrollRaw = await Payroll.find({ month: selectedMonth }).populate('teacher', 'name subject qualification').sort({ 'teacher.name': 1 });
    const payroll = payrollRaw.map(p => ({ id: p._id, teacher_name: p.teacher ? p.teacher.name : '', subject: p.teacher ? p.teacher.subject : '', qualification: p.teacher ? p.teacher.qualification : '', month: p.month, basic_salary: p.basic_salary, allowance: p.allowance, deductions: p.deductions, net_salary: p.net_salary, status: p.status, paid_date: p.paid_date }));

    let totalBasic = 0, totalAllowance = 0, totalDeductions = 0, totalPaid = 0, totalPending = 0, paidCount = 0, unpaidCount = 0;
    payroll.forEach(p => {
      totalBasic += Number(p.basic_salary);
      totalAllowance += Number(p.allowance || 0);
      totalDeductions += Number(p.deductions);
      if (p.status === 'Paid') { paidCount++; totalPaid += Number(p.net_salary); }
      else { unpaidCount++; totalPending += Number(p.net_salary); }
    });

    res.send(layout(req, 'staff', `
      <div class="section-header">
        <div>
          <div class="section-title">Staff Administration</div>
          <div class="section-sub">Manage teacher leaves and monthly payroll database</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px; padding:6px; background:#fff; max-width: 600px;">
        <div style="display:flex; gap:8px;">
          <button type="button" class="tab-btn" onclick="showTab('payroll')" id="btn-payroll" style="flex:1; padding:12px; border:none; border-radius:10px; font-family:inherit; font-weight:600; font-size:13.5px; cursor:pointer; transition:all 0.2s;"><i class="fas fa-rupee-sign"></i> Payroll / Salaries</button>
          <button type="button" class="tab-btn" onclick="showTab('leaves')" id="btn-leaves" style="flex:1; padding:12px; border:none; border-radius:10px; font-family:inherit; font-weight:600; font-size:13.5px; cursor:pointer; transition:all 0.2s;"><i class="fas fa-calendar-alt"></i> Leave Requests</button>
        </div>
      </div>

      <div id="payroll-tab" class="tab-content" style="display:none;">
        <div class="stats-grid" style="margin-bottom:20px;">
          <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-wallet"></i></div><div class="stat-value">${money(totalBasic + totalAllowance)}</div><div class="stat-label">Total Gross Salary</div></div>
          <div class="stat-card red"><div class="stat-icon"><i class="fas fa-percentage"></i></div><div class="stat-value">${money(totalDeductions)}</div><div class="stat-label">Total Deductions</div></div>
          <div class="stat-card green"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-value">${money(totalPaid)}</div><div class="stat-label">Net Payouts (${paidCount} Paid)</div></div>
          <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-value">${money(totalPending)}</div><div class="stat-label">Pending Payout (${unpaidCount} Unpaid)</div></div>
        </div>

        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header" style="background:#f8f9fa;"><div class="card-title">Filter & Actions</div></div>
          <div class="card-body">
            <form method="get" action="/staff" style="display:flex; flex-wrap:wrap; gap:15px; align-items:flex-end;">
              <input type="hidden" name="tab" value="payroll">
              <div class="form-group" style="flex:1; min-width:180px;">
                <label>Selected Month</label>
                <input type="month" name="month" value="${selectedMonth}" style="width:100%;">
              </div>
              <button type="submit" class="btn btn-outline" style="height:42px;"><i class="fas fa-search"></i> Load Month</button>
              <button type="button" class="btn btn-primary" style="height:42px;" onclick="document.getElementById('modalGeneratePayroll').classList.add('open')"><i class="fas fa-plus"></i> Generate Payroll</button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Payroll Log for ${selectedMonth}</div></div>
          <div class="attendance-table-wrap">
            <table>
              <thead><tr><th>Teacher</th><th>Basic Salary</th><th>Allowance</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${payroll.length > 0 ? payroll.map(p => {
                  const hasPaid = p.status === 'Paid';
                  return `
                    <tr class="payroll-row" data-id="${p.id}" data-name="${e(p.teacher_name)}" data-basic="${p.basic_salary}" data-allowance="${p.allowance}" data-deductions="${p.deductions}" data-net="${p.net_salary}" data-status="${p.status}">
                      <td><b>${e(p.teacher_name)}</b><br><span style="font-size:11px;color:#888;">${e(p.subject)}</span></td>
                      <td>${money(p.basic_salary)}</td>
                      <td>${money(p.allowance)}</td>
                      <td><span class="text-danger" style="color:var(--danger);">${money(p.deductions)}</span></td>
                      <td style="font-weight:600;color:var(--primary);">${money(p.net_salary)}</td>
                      <td><span class="bp ${hasPaid ? 'green' : 'red'}">${e(p.status)}</span></td>
                      <td>
                        <div style="display:flex; gap:6px;">
                          <button class="btn btn-sm btn-outline btn-icon" onclick="downloadSalarySlip('${p.id}', '${e(p.teacher_name)}', '${e(p.subject)}', '${e(p.month)}', ${p.basic_salary}, ${p.allowance}, ${p.deductions}, ${p.net_salary}, '${p.status}', '${fmtDate(p.paid_date)}')" title="Download Slip"><i class="fas fa-file-pdf"></i></button>
                          <button class="btn btn-sm btn-outline btn-icon edit-payroll-btn" onclick="openEditPayroll('${p.id}')" title="Edit Details"><i class="fas fa-edit"></i></button>
                          <form method="post" action="/staff/payroll/toggle-status" style="display:inline;">
                            <input type="hidden" name="payroll_id" value="${p.id}">
                            <input type="hidden" name="status" value="${hasPaid ? 'Unpaid' : 'Paid'}">
                            <button type="submit" class="btn btn-sm btn-outline btn-icon" style="color:${hasPaid ? 'var(--danger)' : 'var(--success)'}; border-color:${hasPaid ? '#f1c5bf' : '#bfe0d4'};" title="${hasPaid ? 'Mark Unpaid' : 'Mark Paid'}">
                              <i class="fas fa-${hasPaid ? 'times-circle' : 'check-circle'}"></i>
                            </button>
                          </form>
                          <form method="post" action="/staff/payroll/delete" onsubmit="return confirm('Delete this payroll record?')" style="display:inline;">
                            <input type="hidden" name="payroll_id" value="${p.id}">
                            <button type="submit" class="btn btn-sm btn-outline btn-icon" style="color:var(--danger); border-color:#f1c5bf;" title="Delete Record"><i class="fas fa-trash"></i></button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text3);">No payroll records found for this month. Click "Generate Payroll" to initialize.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="leaves-tab" class="tab-content" style="display:none;">
        <div class="card">
          <div class="card-header"><div class="card-title">Leave Applications List</div></div>
          <div class="attendance-table-wrap">
            <table>
              <thead><tr><th>Teacher</th><th>Leave Dates</th><th>Reason</th><th>Applied On</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${leaves.length > 0 ? leaves.map(l => {
                  const isPending = l.status === 'Pending';
                  return `
                    <tr>
                      <td><b>${e(l.teacher_name)}</b></td>
                      <td>${fmtDate(l.start_date)} to ${fmtDate(l.end_date)}</td>
                      <td>${e(l.reason)}</td>
                      <td>${fmtDate(l.applied_on)}</td>
                      <td><span class="bp ${l.status === 'Approved' ? 'green' : l.status === 'Rejected' ? 'red' : 'gold'}">${e(l.status)}</span></td>
                      <td>
                        ${isPending ? `
                          <div style="display:flex; gap:6px;">
                            <form method="post" action="/staff/leave/${l.id}/approve" style="display:inline;">
                              <button type="submit" class="btn btn-sm btn-success"><i class="fas fa-check"></i> Approve</button>
                            </form>
                            <form method="post" action="/staff/leave/${l.id}/reject" style="display:inline;">
                              <button type="submit" class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger);"><i class="fas fa-ban"></i> Reject</button>
                            </form>
                          </div>
                        ` : `<span style="font-size:12px; color:var(--text3);">No Action Required</span>`}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text3);">No leave applications found.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${modal('modalGeneratePayroll', 'Generate Monthly Payroll', `
        <form method="post" action="/staff/payroll/generate">
          <div class="modal-body">
            <p style="margin-bottom:15px; font-size:13.5px; color:var(--text2);">This will initialize unpaid payroll logs for all active teachers for the selected month using their default basic salaries.</p>
            <div class="form-group">
              <label>Select Month</label>
              <input type="month" name="month" value="${selectedMonth}" required>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalGeneratePayroll').classList.remove('open')">Cancel</button>
            <button type="submit" class="btn btn-primary">Generate Logs</button>
          </div>
        </form>
      `)}

      ${modal('modalEditPayroll', 'Edit Payroll Log', `
        <form method="post" action="/staff/payroll/update" id="editPayrollForm">
          <input type="hidden" name="payroll_id" id="epId">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group form-full"><label>Teacher Name</label><input type="text" id="epName" readonly style="background:#f4f6f9;"></div>
              <div class="form-group"><label>Basic Salary (Rs.)</label><input type="number" name="basic_salary" id="epBasic" required min="0" oninput="calculateNetPay()"></div>
              <div class="form-group"><label>Allowance (Rs.)</label><input type="number" name="allowance" id="epAllowance" required min="0" oninput="calculateNetPay()"></div>
              <div class="form-group"><label>Deductions (Rs.)</label><input type="number" name="deductions" id="epDeductions" required min="0" oninput="calculateNetPay()"></div>
              <div class="form-group"><label>Net pay (Rs.)</label><input type="number" id="epNet" readonly style="background:#e4f4ed; font-weight:600; color:var(--success);"></div>
              <div class="form-group form-full"><label>Payment Status</label><select name="status" id="epStatus"><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option></select></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalEditPayroll').classList.remove('open')">Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>
          </div>
        </form>
      `)}

      <script>
        function showTab(tabName) {
          document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
          document.querySelectorAll('.tab-btn').forEach(btn => { btn.style.background = 'none'; btn.style.color = 'var(--text2)'; btn.style.boxShadow = 'none'; });
          var contentEl = document.getElementById(tabName + '-tab');
          if (contentEl) contentEl.style.display = 'block';
          var btn = document.getElementById('btn-' + tabName);
          if (btn) { btn.style.background = 'var(--primary)'; btn.style.color = '#fff'; btn.style.boxShadow = 'var(--shadow-sm)'; }
        }
        function openEditPayroll(id) {
          var row = document.querySelector('.payroll-row[data-id="'+id+'"]');
          if (!row) return;
          var d = row.dataset;
          document.getElementById('epId').value = id;
          document.getElementById('epName').value = d.name;
          document.getElementById('epBasic').value = Math.round(Number(d.basic));
          document.getElementById('epAllowance').value = Math.round(Number(d.allowance));
          document.getElementById('epDeductions').value = Math.round(Number(d.deductions));
          document.getElementById('epStatus').value = d.status;
          calculateNetPay();
          document.getElementById('modalEditPayroll').classList.add('open');
        }
        function calculateNetPay() {
          var basic = Number(document.getElementById('epBasic').value) || 0;
          var allowance = Number(document.getElementById('epAllowance').value) || 0;
          var deductions = Number(document.getElementById('epDeductions').value) || 0;
          document.getElementById('epNet').value = basic + allowance - deductions;
        }
        function downloadSalarySlip(payrollId, name, subject, month, basic, allowance, deductions, net, status, paidDate) {
          var basicFmt = Number(basic).toLocaleString('en-IN');
          var allowanceFmt = Number(allowance).toLocaleString('en-IN');
          var deductionsFmt = Number(deductions).toLocaleString('en-IN');
          var netFmt = Number(net).toLocaleString('en-IN');
          var slipHtml = '<div style="padding:40px;font-family:Sora,sans-serif;border:2px solid #ccc;max-width:600px;margin:0 auto;background:#fff;box-sizing:border-box;">' +
            '<div style="text-align:center;border-bottom:2px solid #2a5a8c;padding-bottom:15px;margin-bottom:25px;">' +
            '<h2 style="color:#2a5a8c;margin:0;">Vidya Mandir School</h2>' +
            '<p style="margin:5px 0 0;color:#555;font-size:13px;">123, Education Road, Satellite, Ahmedabad, Gujarat - 380015</p>' +
            '<h3 style="margin:15px 0 0;color:#4a5a6e;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Salary Slip</h3></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:25px;font-size:13px;color:#333;">' +
            '<div><b>Employee Name:</b> '+name+'</div><div><b>Designation:</b> '+subject+' Teacher</div>' +
            '<div><b>Pay Month:</b> '+month+'</div><div><b>Payment Status:</b> <span style="font-weight:600;color:'+(status==='Paid'?'#1e7d5a':'#c0392b')+';">'+status+'</span></div>' +
            (paidDate && paidDate !== 'null' ? '<div><b>Paid Date:</b> '+paidDate+'</div>' : '') + '</div>' +
            '<table style="width:100%;border-collapse:collapse;margin-bottom:25px;font-size:13px;">' +
            '<thead><tr style="background:#f4f6f9;border-bottom:2px solid #ccc;"><th style="padding:10px;text-align:left;">Earnings</th><th style="padding:10px;text-align:right;">Amount (Rs.)</th></tr></thead>' +
            '<tbody><tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">Basic Salary</td><td style="padding:10px;text-align:right;">'+basicFmt+'</td></tr>' +
            '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">Allowances</td><td style="padding:10px;text-align:right;">'+allowanceFmt+'</td></tr>' +
            '<tr style="background:#fdfaf4;border-bottom:2px solid #ccc;"><th style="padding:10px;text-align:left;">Deductions</th><th style="padding:10px;text-align:right;">Amount (Rs.)</th></tr>' +
            '<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;color:#c0392b;">Deductions</td><td style="padding:10px;text-align:right;color:#c0392b;">'+deductionsFmt+'</td></tr>' +
            '<tr style="background:#e4f4ed;font-weight:bold;border-top:2px solid #1e7d5a;"><td style="padding:12px 10px;font-size:15px;color:#1e7d5a;">Net Pay</td><td style="padding:12px 10px;font-size:15px;text-align:right;color:#1e7d5a;">Rs. '+netFmt+'</td></tr></tbody></table>' +
            '<div style="margin-top:50px;display:flex;justify-content:space-between;font-size:12px;"><div style="text-align:center;"><div style="border-bottom:1px solid #ddd;width:150px;margin-bottom:5px;"></div><p>Employee Signature</p></div><div style="text-align:center;"><div style="border-bottom:1px solid #ddd;width:150px;margin-bottom:5px;"></div><p>Authorized Signatory</p></div></div>' +
            '<div style="margin-top:30px;text-align:center;font-size:11px;color:#888;">Computer-generated salary slip.</div></div>';
          var tempDiv = document.createElement('div');
          tempDiv.innerHTML = slipHtml;
          document.body.appendChild(tempDiv);
          html2pdf().from(tempDiv.firstElementChild).set({ margin:15, filename:'SalarySlip_'+name.replace(/\\s+/g,'_')+'_'+month+'.pdf', html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} }).save().then(function(){tempDiv.remove();});
        }
        document.addEventListener('DOMContentLoaded', function() {
          showTab('${activeTab}');
          document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
        });
      </script>
    `));

  } else {
    // Teacher view
    const teacherId = user.teacher_id;
    const leavesRaw = await Leave.find({ teacher: teacherId }).sort({ applied_on: -1 });
    const leaves = leavesRaw.map(l => ({ ...l.toObject(), id: l._id }));

    const payrollRaw = await Payroll.find({ teacher: teacherId }).populate('teacher', 'name subject qualification').sort({ month: -1 });
    const payroll = payrollRaw.map(p => ({ id: p._id, teacher_name: p.teacher ? p.teacher.name : '', subject: p.teacher ? p.teacher.subject : '', month: p.month, basic_salary: p.basic_salary, allowance: p.allowance, deductions: p.deductions, net_salary: p.net_salary, status: p.status, paid_date: p.paid_date }));

    let totalEarned = 0;
    payroll.forEach(p => { if (p.status === 'Paid') totalEarned += Number(p.net_salary); });
    const approvedLeaves = leaves.filter(l => l.status === 'Approved').length;

    res.send(layout(req, 'staff', `
      <div class="section-header">
        <div>
          <div class="section-title">My Leave & Payroll Portal</div>
          <div class="section-sub">View your monthly salary statements and request leaves</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px; padding:6px; background:#fff; max-width: 600px;">
        <div style="display:flex; gap:8px;">
          <button type="button" class="tab-btn" onclick="showTab('payroll')" id="btn-payroll" style="flex:1; padding:12px; border:none; border-radius:10px; font-family:inherit; font-weight:600; font-size:13.5px; cursor:pointer; transition:all 0.2s;"><i class="fas fa-rupee-sign"></i> Salary Statements</button>
          <button type="button" class="tab-btn" onclick="showTab('leaves')" id="btn-leaves" style="flex:1; padding:12px; border:none; border-radius:10px; font-family:inherit; font-weight:600; font-size:13.5px; cursor:pointer; transition:all 0.2s;"><i class="fas fa-calendar-alt"></i> Leave History</button>
        </div>
      </div>

      <div id="payroll-tab" class="tab-content" style="display:none;">
        <div class="stats-grid" style="margin-bottom:20px;">
          <div class="stat-card green"><div class="stat-icon"><i class="fas fa-wallet"></i></div><div class="stat-value">${money(totalEarned)}</div><div class="stat-label">Total Salary Received</div></div>
          <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-file-invoice-dollar"></i></div><div class="stat-value">${payroll.length}</div><div class="stat-label">Total Pay Slips Generated</div></div>
          <div class="stat-card red"><div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div><div class="stat-value">${payroll.filter(p => p.status === 'Unpaid').length}</div><div class="stat-label">Pending Payments</div></div>
          <div class="stat-card gold"><div class="stat-icon"><i class="fas fa-umbrella-beach"></i></div><div class="stat-value">${approvedLeaves}</div><div class="stat-label">Approved Leaves</div></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">My Payroll Statements</div></div>
          <div class="attendance-table-wrap">
            <table>
              <thead><tr><th>Month</th><th>Basic Salary</th><th>Allowance</th><th>Deductions</th><th>Net Salary</th><th>Status</th><th>Salary Slip</th></tr></thead>
              <tbody>
                ${payroll.length > 0 ? payroll.map(p => {
                  const hasPaid = p.status === 'Paid';
                  return `
                    <tr>
                      <td><b>${e(p.month)}</b></td>
                      <td>${money(p.basic_salary)}</td>
                      <td>${money(p.allowance)}</td>
                      <td><span style="color:var(--danger);">${money(p.deductions)}</span></td>
                      <td style="font-weight:600;color:var(--primary);">${money(p.net_salary)}</td>
                      <td><span class="bp ${hasPaid ? 'green' : 'red'}">${e(p.status)}</span></td>
                      <td>
                        <button class="btn btn-sm btn-outline" onclick="downloadSalarySlip('${p.id}', '${e(p.teacher_name)}', '${e(p.subject)}', '${e(p.month)}', ${p.basic_salary}, ${p.allowance}, ${p.deductions}, ${p.net_salary}, '${p.status}', '${fmtDate(p.paid_date)}')" style="gap:5px;">
                          <i class="fas fa-file-pdf"></i> Download PDF
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text3);">No payroll slips have been generated for you yet.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="leaves-tab" class="tab-content" style="display:none;">
        <div style="display:flex; justify-content:flex-end; margin-bottom:15px;">
          <button class="btn btn-primary" onclick="document.getElementById('modalApplyLeave').classList.add('open')"><i class="fas fa-plus"></i> Request Leave</button>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">My Leave History</div></div>
          <div class="attendance-table-wrap">
            <table>
              <thead><tr><th>Leave Dates</th><th>Reason</th><th>Requested On</th><th>Status</th></tr></thead>
              <tbody>
                ${leaves.length > 0 ? leaves.map(l => `
                  <tr>
                    <td><b>${fmtDate(l.start_date)}</b> to <b>${fmtDate(l.end_date)}</b></td>
                    <td>${e(l.reason)}</td>
                    <td>${fmtDate(l.applied_on)}</td>
                    <td><span class="bp ${l.status === 'Approved' ? 'green' : l.status === 'Rejected' ? 'red' : 'gold'}">${e(l.status)}</span></td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text3);">No leaves requested yet.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${modal('modalApplyLeave', 'Request Leave of Absence', `
        <form method="post" action="/staff/leave/apply">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group"><label>Start Date</label><input type="date" name="start_date" required min="${today()}"></div>
              <div class="form-group"><label>End Date</label><input type="date" name="end_date" required min="${today()}"></div>
              <div class="form-group form-full"><label>Reason for Leave</label><textarea name="reason" placeholder="Explain the reason..." required></textarea></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('modalApplyLeave').classList.remove('open')">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Application</button>
          </div>
        </form>
      `)}

      <script>
        function showTab(tabName) {
          document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
          document.querySelectorAll('.tab-btn').forEach(btn => { btn.style.background = 'none'; btn.style.color = 'var(--text2)'; btn.style.boxShadow = 'none'; });
          var contentEl = document.getElementById(tabName + '-tab');
          if (contentEl) contentEl.style.display = 'block';
          var btn = document.getElementById('btn-' + tabName);
          if (btn) { btn.style.background = 'var(--primary)'; btn.style.color = '#fff'; btn.style.boxShadow = 'var(--shadow-sm)'; }
        }
        function downloadSalarySlip(payrollId, name, subject, month, basic, allowance, deductions, net, status, paidDate) {
          var basicFmt = Number(basic).toLocaleString('en-IN');
          var allowanceFmt = Number(allowance).toLocaleString('en-IN');
          var deductionsFmt = Number(deductions).toLocaleString('en-IN');
          var netFmt = Number(net).toLocaleString('en-IN');
          var slipHtml = '<div style="padding:40px;font-family:Sora,sans-serif;border:2px solid #ccc;max-width:600px;margin:0 auto;background:#fff;">' +
            '<div style="text-align:center;border-bottom:2px solid #2a5a8c;padding-bottom:15px;margin-bottom:25px;"><h2 style="color:#2a5a8c;margin:0;">Vidya Mandir School</h2><h3 style="margin:15px 0 0;color:#4a5a6e;">Salary Slip</h3></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:25px;font-size:13px;"><div><b>Name:</b> '+name+'</div><div><b>Designation:</b> '+subject+' Teacher</div><div><b>Month:</b> '+month+'</div><div><b>Status:</b> '+status+'</div></div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>' +
            '<tr style="background:#f4f6f9;"><th style="padding:10px;text-align:left;">Earnings</th><th style="padding:10px;text-align:right;">Amount</th></tr>' +
            '<tr><td style="padding:10px;">Basic Salary</td><td style="padding:10px;text-align:right;">'+basicFmt+'</td></tr>' +
            '<tr><td style="padding:10px;">Allowances</td><td style="padding:10px;text-align:right;">'+allowanceFmt+'</td></tr>' +
            '<tr style="background:#fdfaf4;"><th style="padding:10px;text-align:left;">Deductions</th><th style="padding:10px;text-align:right;">Amount</th></tr>' +
            '<tr><td style="padding:10px;color:#c0392b;">Deductions</td><td style="padding:10px;text-align:right;color:#c0392b;">'+deductionsFmt+'</td></tr>' +
            '<tr style="background:#e4f4ed;font-weight:bold;"><td style="padding:12px;color:#1e7d5a;">Net Pay</td><td style="padding:12px;text-align:right;color:#1e7d5a;">Rs. '+netFmt+'</td></tr></tbody></table>' +
            '<div style="margin-top:30px;text-align:center;font-size:11px;color:#888;">Computer-generated salary slip.</div></div>';
          var tempDiv = document.createElement('div');
          tempDiv.innerHTML = slipHtml;
          document.body.appendChild(tempDiv);
          html2pdf().from(tempDiv.firstElementChild).set({ margin:15, filename:'SalarySlip_'+name.replace(/\\s+/g,'_')+'_'+month+'.pdf', html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} }).save().then(function(){tempDiv.remove();});
        }
        document.addEventListener('DOMContentLoaded', function() {
          showTab('${activeTab}');
          document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
        });
      </script>
    `));
  }
}

async function applyLeave(req, res) {
  const user = req.session.user;
  if (user.role !== 'teacher') {
    req.session.flash = { type: 'danger', message: 'Only teachers can request leaves.' };
    return res.redirect('/staff');
  }
  try {
    await Leave.create({ teacher: user.teacher_id, start_date: req.body.start_date, end_date: req.body.end_date, reason: req.body.reason });
    req.session.flash = { type: 'success', message: 'Leave application submitted successfully.' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Failed to submit leave request.' };
  }
  res.redirect('/staff?tab=leaves');
}

async function approveLeave(req, res) {
  try {
    await Leave.findByIdAndUpdate(req.params.id, { status: 'Approved' });
    req.session.flash = { type: 'success', message: 'Leave request approved successfully.' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Failed to approve leave request.' };
  }
  res.redirect('/staff?tab=leaves');
}

async function rejectLeave(req, res) {
  try {
    await Leave.findByIdAndUpdate(req.params.id, { status: 'Rejected' });
    req.session.flash = { type: 'success', message: 'Leave request rejected.' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Failed to reject leave request.' };
  }
  res.redirect('/staff?tab=leaves');
}

async function generatePayroll(req, res) {
  const { month } = req.body;
  try {
    const teachers = await Teacher.find({ disabled: false });
    let generatedCount = 0;
    for (const t of teachers) {
      const exists = await Payroll.findOne({ teacher: t._id, month });
      if (!exists) {
        await Payroll.create({ teacher: t._id, month, basic_salary: t.salary, allowance: 0, deductions: 0, net_salary: t.salary, status: 'Unpaid' });
        generatedCount++;
      }
    }
    req.session.flash = { type: 'success', message: `Payroll generated for ${generatedCount} teachers for month ${month}.` };
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Failed to generate payroll.' };
  }
  res.redirect(`/staff?tab=payroll&month=${month}`);
}

async function updatePayroll(req, res) {
  const { payroll_id, basic_salary, allowance, deductions, status } = req.body;
  const basicVal = Number(basic_salary) || 0;
  const allowanceVal = Number(allowance) || 0;
  const deductionsVal = Number(deductions) || 0;
  const netVal = basicVal + allowanceVal - deductionsVal;
  try {
    const record = await Payroll.findById(payroll_id);
    await Payroll.findByIdAndUpdate(payroll_id, { basic_salary: basicVal, allowance: allowanceVal, deductions: deductionsVal, net_salary: netVal, status, paid_date: status === 'Paid' ? new Date() : null });
    req.session.flash = { type: 'success', message: 'Payroll details updated successfully.' };
    res.redirect(`/staff?tab=payroll&month=${record ? record.month : ''}`);
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Failed to update payroll.' };
    res.redirect('/staff?tab=payroll');
  }
}

async function togglePayrollStatus(req, res) {
  const { payroll_id, status } = req.body;
  try {
    const record = await Payroll.findById(payroll_id);
    await Payroll.findByIdAndUpdate(payroll_id, { status, paid_date: status === 'Paid' ? new Date() : null });
    req.session.flash = { type: 'success', message: `Payroll marked as ${status}.` };
    res.redirect(`/staff?tab=payroll&month=${record ? record.month : ''}`);
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Failed to update status.' };
    res.redirect('/staff?tab=payroll');
  }
}

async function deletePayroll(req, res) {
  const { payroll_id } = req.body;
  try {
    const record = await Payroll.findById(payroll_id);
    await Payroll.findByIdAndDelete(payroll_id);
    req.session.flash = { type: 'success', message: 'Payroll record deleted.' };
    res.redirect(`/staff?tab=payroll&month=${record ? record.month : ''}`);
  } catch (err) {
    req.session.flash = { type: 'danger', message: 'Failed to delete payroll record.' };
    res.redirect('/staff?tab=payroll');
  }
}

module.exports = { staff, applyLeave, approveLeave, rejectLeave, generatePayroll, updatePayroll, togglePayrollStatus, deletePayroll };
