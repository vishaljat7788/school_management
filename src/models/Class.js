const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  _id: { type: String },
  label: { type: String, required: true },
  color: { type: String, default: '#2a5a8c' }
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
