const mongoose = require('mongoose');

const homeworkSubmissionSchema = new mongoose.Schema({
  homework: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  submission_date: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Submitted', 'Graded'], default: 'Submitted' },
  grade: { type: String, default: '' }
}, { timestamps: true });

homeworkSubmissionSchema.index({ homework: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('HomeworkSubmission', homeworkSubmissionSchema);
