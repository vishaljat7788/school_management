const mongoose = require('mongoose');

const homeworkSchema = new mongoose.Schema({
  class_id: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  subject: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  due_date: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Homework', homeworkSchema);
