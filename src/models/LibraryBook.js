const mongoose = require('mongoose');

const libraryBookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  isbn: { type: String, default: '' },
  total_copies: { type: Number, default: 1 },
  available_copies: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('LibraryBook', libraryBookSchema);
