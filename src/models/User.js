const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  display_name: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
