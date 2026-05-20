const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  _id: { type: String },
  svalue: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
