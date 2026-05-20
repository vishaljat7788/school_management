const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  month: { type: String, required: true },
  basic_salary: { type: Number, default: 0 },
  allowance: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  net_salary: { type: Number, default: 0 },
  status: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' },
  paid_date: { type: Date, default: null }
}, { timestamps: true });

payrollSchema.index({ teacher: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
