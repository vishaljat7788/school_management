const mongoose = require('mongoose');

const libraryIssueSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
  issue_date: { type: Date, required: true },
  due_date: { type: Date, required: true },
  return_date: { type: Date, default: null },
  status: { type: String, enum: ['Issued', 'Returned', 'Overdue'], default: 'Issued' },
  fine: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('LibraryIssue', libraryIssueSchema);
