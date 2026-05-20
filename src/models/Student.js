const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  roll_no: { type: String, required: true },
  class_id: { type: String, required: true },
  gender: { type: String, required: true },
  phone: { type: String, default: '' },
  fee_status: { type: String, enum: ['Paid', 'Pending', 'Overdue'], default: 'Pending' },
  address: { type: String, default: '' },
  father_name: { type: String, default: '' },
  mother_name: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
