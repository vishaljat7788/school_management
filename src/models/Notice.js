const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  audience: { type: String, default: 'All Classes' },
  notice_date: { type: Date, required: true },
  type: { type: String, default: 'general' }
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
