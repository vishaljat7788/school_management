const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  class_id: { type: String, required: true, default: '10' },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  monday: { type: String, default: '' },
  tuesday: { type: String, default: '' },
  wednesday: { type: String, default: '' },
  thursday: { type: String, default: '' },
  friday: { type: String, default: '' },
  saturday: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
