const mongoose = require('mongoose');

const transportTeacherSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, unique: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  stop_name: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('TransportTeacher', transportTeacherSchema);
