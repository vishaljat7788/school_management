const LibraryBook = require('../models/LibraryBook');
const LibraryIssue = require('../models/LibraryIssue');
const Student = require('../models/Student');
const { layout, modal } = require('../views/layout');
const { e, fmtDate, className } = require('../utils/format');

async function library(req, res) {
  const books = await LibraryBook.find().sort({ title: 1 });
  const issues = await LibraryIssue.find()
    .populate('book', 'title')
    .populate('student', 'name class_id')
    .sort({ issue_date: -1 })
    .limit(50); // increased limit to see more issues

  const students = await Student.find().sort({ name: 1 });

  const issuesMapped = issues.map(i => ({
    ...i.toObject(),
    id: String(i._id),
    title: i.book ? i.book.title : 'Unknown Book',
    student_name: i.student ? i.student.name : 'Unknown Student',
    student_class: i.student ? i.student.class_id : '',
  }));

  res.send(layout(req, 'library', `
    <div class="section-header">
      <div>
        <div class="section-title">Library Management</div>
        <div class="section-sub">Manage books, issues, and returns</div>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-outline" onclick="document.getElementById('modalIssueBook').classList.add('open')"><i class="fas fa-hand-holding-medical"></i> Issue Book</button>
        <button class="btn btn-primary" onclick="document.getElementById('modalAddBook').classList.add('open')"><i class="fas fa-plus"></i> Add Book</button>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">Book Inventory</div></div>
        <table>
          <thead><tr><th>Book Title</th><th>Author</th><th>Available</th></tr></thead>
          <tbody>
            ${books.map(b => `
              <tr>
                <td><b>${e(b.title)}</b><br><span style="font-size:11px;color:#888;">ISBN: ${e(b.isbn)}</span></td>
                <td>${e(b.author)}</td>
                <td><span class="bp ${b.available_copies > 0 ? 'green' : 'red'}">${b.available_copies} / ${b.total_copies}</span></td>
              </tr>
            `).join('')}
            ${books.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No books found</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      
      <div class="card">
        <div class="card-header"><div class="card-title">Recent Issues</div></div>
        <table>
          <thead><tr><th>Book</th><th>Student</th><th>Status</th><th>Due Date</th><th>Action</th></tr></thead>
          <tbody>
            ${issuesMapped.map(i => `
              <tr>
                <td>${e(i.title)}</td>
                <td>${e(i.student_name)} <span style="font-size:11px;color:var(--text3);">(${e(className(i.student_class))})</span></td>
                <td><span class="bp ${i.status === 'Issued' ? 'blue' : i.status === 'Returned' ? 'green' : 'red'}">${e(i.status)}</span></td>
                <td>${fmtDate(i.due_date)}</td>
                <td>
                  ${i.status === 'Issued' ? `<form method="post" action="/library/return/${i.id}" style="display:inline;" onsubmit="return confirm('Confirm return of this book?');"><button class="btn btn-sm btn-outline" style="color:var(--success);border-color:var(--success);"><i class="fas fa-undo"></i> Return</button></form>` : '-'}
                </td>
              </tr>
            `).join('')}
            ${issuesMapped.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No recent issues</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>

    ${modal('modalAddBook', 'Add New Book', `
      <form method="post" action="/library">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-full"><label>Book Title</label><input name="title" required placeholder="e.g. Concept of Physics"></div>
            <div class="form-group"><label>Author Name</label><input name="author" required></div>
            <div class="form-group"><label>ISBN Number</label><input name="isbn" placeholder="Optional"></div>
            <div class="form-group"><label>Total Copies</label><input type="number" name="total_copies" required value="1" min="1"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modalAddBook').classList.remove('open')">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Book</button>
        </div>
      </form>
    `)}

    ${modal('modalIssueBook', 'Issue Book to Student', `
      <form method="post" action="/library/issue">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>Select Student</label>
              <select name="student_id" required>
                <option value="">-- Choose Student --</option>
                ${students.map(s => `<option value="${s._id}">${e(s.name)} (Roll: ${e(s.roll_no)}, Class: ${e(className(s.class_id))})</option>`).join('')}
              </select>
            </div>
            <div class="form-group form-full">
              <label>Select Book</label>
              <select name="book_id" required>
                <option value="">-- Choose Book --</option>
                ${books.filter(b => b.available_copies > 0).map(b => `<option value="${b._id}">${e(b.title)} (${b.available_copies} available)</option>`).join('')}
              </select>
            </div>
            <div class="form-group form-full">
              <label>Issue Duration (Days)</label>
              <input type="number" name="duration" value="14" required min="1" max="60">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modalIssueBook').classList.remove('open')">Cancel</button>
          <button type="submit" class="btn btn-primary">Issue Book</button>
        </div>
      </form>
    `)}

    <script>
      document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
    </script>
  `));
}

async function addBook(req, res) {
  const { title, author, isbn, total_copies } = req.body;
  await LibraryBook.create({ title, author, isbn: isbn || '', total_copies, available_copies: total_copies });
  req.session.flash = { type: 'success', message: 'Book added to library successfully!' };
  res.redirect('/library');
}

async function issueBook(req, res) {
  const { student_id, book_id, duration } = req.body;
  const book = await LibraryBook.findById(book_id);
  if (!book || book.available_copies <= 0) {
    req.session.flash = { type: 'danger', message: 'Book is not available for issue.' };
    return res.redirect('/library');
  }
  
  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + parseInt(duration || 14, 10));

  await LibraryIssue.create({
    book: book_id,
    student: student_id,
    issue_date: issueDate,
    due_date: dueDate,
    status: 'Issued'
  });

  await LibraryBook.findByIdAndUpdate(book_id, { $inc: { available_copies: -1 } });

  req.session.flash = { type: 'success', message: 'Book issued successfully.' };
  res.redirect('/library');
}

async function returnBook(req, res) {
  const issue = await LibraryIssue.findById(req.params.id);
  if (!issue || issue.status !== 'Issued') {
    req.session.flash = { type: 'danger', message: 'Invalid issue record or already returned.' };
    return res.redirect('/library');
  }

  await LibraryIssue.findByIdAndUpdate(req.params.id, { status: 'Returned' });
  await LibraryBook.findByIdAndUpdate(issue.book, { $inc: { available_copies: 1 } });

  req.session.flash = { type: 'success', message: 'Book returned successfully.' };
  res.redirect('/library');
}

module.exports = { library, addBook, issueBook, returnBook };
