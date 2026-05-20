const mongoose = require('mongoose');

const transportRouteSchema = new mongoose.Schema({
  route_name: { type: String, required: true },
  vehicle_no: { type: String, required: true },
  driver_name: { type: String, required: true },
  driver_phone: { type: String, required: true },
  fee: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('TransportRoute', transportRouteSchema);
