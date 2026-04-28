const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  type: String,
  name: String,
  price: Number,
  capacity: Number,
  image: String,
  features: [String]
});

const eventHallSchema = new mongoose.Schema({
  name: String,
  capacity: Number,
  image: String,
  price: String,
  features: [{ icon: String, label: String }],
  useCases: [String]
});

const hotelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  city: { type: String, required: true },
  rating: { type: Number, default: 4.5 },
  priceFrom: { type: Number, required: true },
  image: { type: String },
  thumbImage: { type: String },
  amenities: [String],
  amenityIcons: [String],
  description: { type: String },
  gallery: [String],
  services: [{ icon: String, label: String }],
  rooms: [roomSchema],
  hasEventHall: { type: Boolean, default: false },
  eventHall: eventHallSchema,
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Hotel', hotelSchema);
