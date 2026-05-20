const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  qualification: { type: String, required: true },
  experience_years: { type: Number, default: 0 },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  bg_color: { type: String, default: '#e8f0fa' },
  text_color: { type: String, default: '#1a5da0' },
  disabled: { type: Boolean, default: false },
  salary: { type: Number, default: 35000 },
  classes: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
