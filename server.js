require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Booking = require('./models/Booking');
const Hotel = require('./models/Hotel');
const SiteSettings = require('./models/SiteSettings');
const Admin = require('./models/Admin');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public')); // serves index.html and admin.html from /public

// ── MongoDB ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await seedDefaults();
  })
  .catch(err => console.error('MongoDB error:', err));

// ── Seed default admin & settings if first run ───────────────────────────────
async function seedDefaults() {
  // Default admin
  const existing = await Admin.findOne({ username: 'admin' });
  if (!existing) {
    await Admin.create({
      username: 'admin',
      password: 'staybridge2025', // hashed automatically via pre-save hook
      name: 'StayBridge Admin',
      role: 'super'
    });
    console.log('✅ Default admin created — username: admin / password: staybridge2025');
    console.log('⚠️  CHANGE THIS PASSWORD immediately after first login!');
  }

  // Default site settings
  const defaults = [
    { key: 'whatsapp_number', value: '2348000000000', label: 'WhatsApp Number', group: 'contact' },
    { key: 'phone_number', value: '+234 800 0000 000', label: 'Phone Number', group: 'contact' },
    { key: 'email', value: 'hello@staybridge.ng', label: 'Email Address', group: 'contact' },
    { key: 'hero_title', value: 'Find & Book Your Perfect Hotel Stay', label: 'Hero Title', group: 'hero' },
    { key: 'hero_subtitle', value: 'Browse premium hotels across Nigeria. We confirm availability, handle the booking, and get you the best deal — personally.', label: 'Hero Subtitle', group: 'hero' },
    { key: 'hero_badge', value: "Nigeria's #1 Hotel Booking Platform", label: 'Hero Badge Text', group: 'hero' },
    { key: 'brand_name', value: 'StayBridge', label: 'Brand Name', group: 'brand' },
    { key: 'response_time', value: 'Under 2 Hours', label: 'Response Time', group: 'general' },
    { key: 'working_hours', value: 'Mon–Sat, 8am–8pm', label: 'Working Hours', group: 'general' },
    { key: 'total_hotels', value: '6+', label: 'Total Hotels (stat)', group: 'stats' },
    { key: 'total_rooms', value: '150+', label: 'Total Rooms (stat)', group: 'stats' },
    { key: 'total_guests', value: '1,200+', label: 'Happy Guests (stat)', group: 'stats' },
    { key: 'avg_rating', value: '4.9', label: 'Average Rating (stat)', group: 'stats' },
  ];
  for (const d of defaults) {
    await SiteSettings.updateOne({ key: d.key }, d, { upsert: true });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET site settings (public — frontend reads this)
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await SiteSettings.find({});
    const map = {};
    settings.forEach(s => map[s.key] = s.value);
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET all hotels (public)
app.get('/api/hotels', async (req, res) => {
  try {
    const hotels = await Hotel.find({ active: true }).select('-__v');
    res.json(hotels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create booking (public — called from frontend before WhatsApp redirect)
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = await Booking.create(req.body);
    res.status(201).json({ success: true, id: booking._id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    admin.lastLogin = new Date();
    await admin.save();
    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role, name: admin.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, admin: { username: admin.username, name: admin.name, role: admin.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — BOOKINGS
// ══════════════════════════════════════════════════════════════════════════════

// GET all bookings
app.get('/api/admin/bookings', auth, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Booking.countDocuments(filter);
    res.json({ bookings, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET booking stats
app.get('/api/admin/bookings/stats', auth, async (req, res) => {
  try {
    const total = await Booking.countDocuments();
    const pending = await Booking.countDocuments({ status: 'pending' });
    const confirmed = await Booking.countDocuments({ status: 'confirmed' });
    const rejected = await Booking.countDocuments({ status: 'rejected' });
    const completed = await Booking.countDocuments({ status: 'completed' });
    const rooms = await Booking.countDocuments({ type: 'room' });
    const events = await Booking.countDocuments({ type: 'event' });
    res.json({ total, pending, confirmed, rejected, completed, rooms, events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH update booking status (confirm / reject / complete)
app.patch('/api/admin/bookings/:id', auth, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const update = { status };
    if (adminNote !== undefined) update.adminNote = adminNote;
    if (status === 'confirmed') update.confirmedAt = new Date();
    const booking = await Booking.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE booking
app.delete('/api/admin/bookings/:id', auth, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — HOTELS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/hotels', auth, async (req, res) => {
  try {
    const hotels = await Hotel.find().sort({ createdAt: -1 });
    res.json(hotels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/hotels', auth, async (req, res) => {
  try {
    // Auto-generate id from name if not provided
    if (!req.body.id) {
      req.body.id = req.body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    const hotel = await Hotel.create(req.body);
    res.status(201).json(hotel);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/admin/hotels/:id', auth, async (req, res) => {
  try {
    const hotel = await Hotel.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, runValidators: true });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(hotel);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/admin/hotels/:id', auth, async (req, res) => {
  try {
    await Hotel.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — SITE SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/settings', auth, async (req, res) => {
  try {
    const settings = await SiteSettings.find().sort({ group: 1 });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/settings', auth, async (req, res) => {
  try {
    // req.body is { key: value, key: value, ... }
    const updates = [];
    for (const [key, value] of Object.entries(req.body)) {
      updates.push(
        SiteSettings.findOneAndUpdate({ key }, { value }, { new: true })
      );
    }
    await Promise.all(updates);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — CHANGE PASSWORD
// ══════════════════════════════════════════════════════════════════════════════

app.put('/api/admin/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!(await admin.comparePassword(currentPassword))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    admin.password = newPassword;
    await admin.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 StayBridge server running on port ${PORT}`));
