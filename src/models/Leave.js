const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  applied_on: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
