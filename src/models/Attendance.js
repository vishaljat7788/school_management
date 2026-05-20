const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  class_id: { type: String, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  attendance_date: { type: Date, required: true },
  status: { type: String, enum: ['P', 'A', 'L'], default: 'P' },
  marked_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

attendanceSchema.index({ student: 1, attendance_date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
