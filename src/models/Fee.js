const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  amount: { type: Number, default: 12500 },
  paid_amount: { type: Number, default: 0 },
  status: { type: String, enum: ['Paid', 'Pending', 'Overdue'], default: 'Pending' },
  paid_date: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Fee', feeSchema);
