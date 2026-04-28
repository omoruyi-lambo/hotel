const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['room', 'event'],
    required: true
  },
  // Room booking fields
  hotel: { type: String },
  hotelLocation: { type: String },
  roomType: { type: String },
  guests: { type: String },
  checkin: { type: String },
  checkout: { type: String },
  budget: { type: String },

  // Event booking fields
  hallName: { type: String },
  eventType: { type: String },
  eventDate: { type: String },
  expectedGuests: { type: String },
  duration: { type: String },

  // Common fields
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  notes: { type: String },

  // Admin fields
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'completed'],
    default: 'pending'
  },
  adminNote: { type: String },
  confirmedAt: { type: Date },

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
