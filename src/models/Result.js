const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  exam_name: { type: String, required: true },
  subject: { type: String, required: true },
  marks_obtained: { type: Number, required: true },
  total_marks: { type: Number, default: 100 },
  grade: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
