const mongoose = require('mongoose');

const transportStudentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  stop_name: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Approved' }
}, { timestamps: true });

module.exports = mongoose.model('TransportStudent', transportStudentSchema);
