const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('./'));
app.use('/uploads', express.static(uploadsDir));

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'zigzag_hairplace'
});

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS bio TEXT,
        ADD COLUMN IF NOT EXISTS instagram VARCHAR(255),
        ADD COLUMN IF NOT EXISTS tiktok VARCHAR(255),
        ADD COLUMN IF NOT EXISTS photo_urls TEXT[],
        ADD COLUMN IF NOT EXISTS services TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS barber_id INTEGER,
        ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS appointment_date DATE,
        ADD COLUMN IF NOT EXISTS appointment_time VARCHAR(10),
        ADD COLUMN IF NOT EXISTS service_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      ALTER TABLE day_offs
        ADD COLUMN IF NOT EXISTS barber_id INTEGER,
        ADD COLUMN IF NOT EXISTS day_off_date DATE,
        ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS recurring_day_of_week INTEGER,
        ADD COLUMN IF NOT EXISTS notes VARCHAR(255),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
  } finally {
    client.release();
  }
};

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('✅ Connected to PostgreSQL database successfully.');
    await ensureSchema();
    console.log('✅ Database schema checked and updated.');
  } finally {
    client.release();
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
const SLOT_TIMES = ['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM', '5:30 PM'];

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, bio: user.bio, instagram: user.instagram, tiktok: user.tiktok, photo_urls: user.photo_urls, services: user.services } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, bio, instagram, tiktok, photo_urls, services FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

// ==================== BARBER ROUTES ====================

app.get('/api/barbers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, bio, instagram, tiktok, photo_urls, services FROM users WHERE role <> 'boss' ORDER BY role DESC, name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch barbers' });
  }
});

app.post('/api/barbers', authenticateToken, async (req, res) => {
  // Allow boss and senior_barber to create staff accounts
  if (req.user.role !== 'boss' && req.user.role !== 'senior_barber') {
    return res.status(403).json({ error: 'Only boss and senior barber can create staff accounts' });
  }

  const { name, email, password, role, bio, instagram, tiktok, photoUrls, services } = req.body;
  const validRoles = ['boss', 'senior_barber', 'barber', 'junior_barber'];
  const normalizedRole = validRoles.includes(role) ? role : 'barber';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, bio, instagram, tiktok, photo_urls, services) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, email, role, bio, instagram, tiktok, photo_urls, services',
      [name, email.toLowerCase(), hashedPassword, normalizedRole, bio || null, instagram || null, tiktok || null, photoUrls || null, services || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

app.put('/api/barbers/:id', authenticateToken, async (req, res) => {
  const barberId = parseInt(req.params.id);
  if (isNaN(barberId)) {
    return res.status(400).json({ error: 'Invalid barber ID' });
  }

  const { bio, instagram, tiktok, photoUrls, services, role } = req.body;
  try {
    const existingResult = await pool.query('SELECT role, bio, instagram, tiktok, photo_urls, services FROM users WHERE id = $1', [barberId]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }
    const existing = existingResult.rows[0];
    const targetRole = existing.role;

    if (req.user.id !== barberId && req.user.role !== 'boss' && req.user.role !== 'senior_barber') {
      return res.status(403).json({ error: 'Only a boss or the barber can update this profile' });
    }

    let desiredRole = targetRole;
    const validRoles = ['boss', 'senior_barber', 'barber', 'junior_barber'];

    if (role && role !== targetRole) {
      if (req.user.role === 'boss') {
        desiredRole = validRoles.includes(role) ? role : targetRole;
      } else if (req.user.role === 'senior_barber') {
        if (targetRole === 'junior_barber' && role === 'barber') {
          desiredRole = 'barber';
        } else {
          return res.status(403).json({ error: 'Senior barber can only change junior barber to regular barber' });
        }
      } else {
        return res.status(403).json({ error: 'Cannot change role' });
      }
    }

    if (req.user.id === barberId && role && role !== targetRole) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }

    const updatedBio = bio !== undefined ? bio : existing.bio;
    const updatedInstagram = instagram !== undefined ? instagram : existing.instagram;
    const updatedTiktok = tiktok !== undefined ? tiktok : existing.tiktok;
    const updatedPhotoUrls = photoUrls !== undefined ? photoUrls : existing.photo_urls;
    const updatedServices = services !== undefined ? services : existing.services;

    const result = await pool.query(
      'UPDATE users SET bio = $1, instagram = $2, tiktok = $3, photo_urls = $4, services = $5, role = $6 WHERE id = $7 RETURNING id, name, email, role, bio, instagram, tiktok, photo_urls, services',
      [updatedBio || null, updatedInstagram || null, updatedTiktok || null, updatedPhotoUrls || null, updatedServices || null, desiredRole, barberId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update barber profile' });
  }
});

app.delete('/api/barbers/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'boss' && req.user.role !== 'senior_barber') {
    return res.status(403).json({ error: 'Only boss or senior barber can fire barbers' });
  }

  const barberId = parseInt(req.params.id);
  if (isNaN(barberId)) {
    return res.status(400).json({ error: 'Invalid barber ID' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 AND role IN ($2, $3) RETURNING id',
      [barberId, 'barber', 'junior_barber']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found or cannot fire this user' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fire barber' });
  }
});

// ==================== APPOINTMENT ROUTES ====================

const parseDateString = (dateStr) => {
  const [year, month, day] = (dateStr || '').split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeAppointmentRecord = (row) => ({
  ...row,
  appointment_date: row.appointment_date instanceof Date
    ? formatDateOnly(row.appointment_date)
    : row.appointment_date,
});

app.get('/api/appointments', authenticateToken, async (req, res) => {
  const { date, barberId } = req.query;
  try {
    if (req.user.role === 'senior_barber') {
      return res.json([]);
    }

    let query = 'SELECT * FROM appointments';
    const params = [];
    const conditions = [];

    // Non-boss users only see their own appointments
    if (req.user.role !== 'boss') {
      conditions.push('barber_id = $' + (params.length + 1));
      params.push(req.user.id);
    } else if (barberId) {
      conditions.push('barber_id = $' + (params.length + 1));
      params.push(parseInt(barberId));
    }

    if (date) {
      conditions.push('appointment_date = $' + (params.length + 1));
      params.push(date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY appointment_date, appointment_time';
    const result = await pool.query(query, params);
    res.json(result.rows.map(normalizeAppointmentRecord));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.get('/api/appointments/month/:year/:month', authenticateToken, async (req, res) => {
  const { year, month } = req.params;
  const { barberId } = req.query;
  try {
    if (req.user.role === 'senior_barber') {
      return res.json([]);
    }

    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    let query = 'SELECT * FROM appointments WHERE appointment_date BETWEEN $1 AND $2';
    const params = [startDate, endDate];

    if (req.user.role !== 'boss') {
      query += ' AND barber_id = $3';
      params.push(req.user.id);
    } else if (barberId) {
      query += ' AND barber_id = $3';
      params.push(parseInt(barberId));
    }

    query += ' ORDER BY appointment_date, appointment_time';
    const result = await pool.query(query, params);
    console.log(`Monthly appointments for ${req.user.role} ${req.user.id} in ${year}-${month}:`, result.rows.length, 'appointments');
    res.json(result.rows.map(normalizeAppointmentRecord));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.get('/api/appointments/available', async (req, res) => {
  const { barberId, date } = req.query;
  try {
    // Get booked slots
    const bookedResult = await pool.query(
      'SELECT appointment_time FROM appointments WHERE barber_id = $1 AND appointment_date = $2',
      [parseInt(barberId), date]
    );
    const bookedTimes = bookedResult.rows.map(row => row.appointment_time);

    // Check day offs
    const dayOffResult = await pool.query(
      'SELECT * FROM day_offs WHERE barber_id = $1 AND (day_off_date = $2 OR (is_recurring = true AND recurring_day_of_week = $3))',
      [parseInt(barberId), date, parseDateString(date).getDay()]
    );

    if (dayOffResult.rows.length > 0) {
      return res.json({ available: [], isDayOff: true });
    }

    const available = SLOT_TIMES.filter(time => !bookedTimes.includes(time));
    res.json({ available, isDayOff: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

app.post('/api/appointments', async (req, res) => {
  const { barberId, date, time, clientName, clientPhone, serviceType } = req.body;
  try {
    const checkDayOff = await pool.query(
      'SELECT * FROM day_offs WHERE barber_id = $1 AND (day_off_date = $2 OR (is_recurring = true AND recurring_day_of_week = $3))',
      [parseInt(barberId), date, parseDateString(date).getDay()]
    );

    if (checkDayOff.rows.length > 0) {
      return res.status(400).json({ error: 'Barber is off on this date' });
    }

    const checkBooked = await pool.query(
      'SELECT id FROM appointments WHERE barber_id = $1 AND appointment_date = $2 AND appointment_time = $3',
      [parseInt(barberId), date, time]
    );

    if (checkBooked.rows.length > 0) {
      return res.status(400).json({ error: 'Time slot is no longer available' });
    }

    const result = await pool.query(
      'INSERT INTO appointments (barber_id, client_name, client_phone, appointment_date, appointment_time, service_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [parseInt(barberId), clientName, clientPhone, date, time, serviceType || 'Haircut']
    );

    console.log('Appointment booked:', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Time slot already booked' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

app.post('/api/appointments/:id/move-next-day', authenticateToken, async (req, res) => {
  const appointmentId = parseInt(req.params.id);
  if (isNaN(appointmentId)) {
    return res.status(400).json({ error: 'Invalid appointment ID' });
  }

  try {
    const appointmentResult = await pool.query(
      'SELECT * FROM appointments WHERE id = $1',
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];
    if (req.user.role !== 'boss' && req.user.role !== 'senior_barber' && appointment.barber_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to move this appointment' });
    }

    const currentDate = parseDateString(appointment.appointment_date);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDate = formatDateOnly(currentDate);

    const dayOffResult = await pool.query(
      'SELECT * FROM day_offs WHERE barber_id = $1 AND (day_off_date = $2 OR (is_recurring = true AND recurring_day_of_week = $3))',
      [appointment.barber_id, nextDate, parseDateString(nextDate).getDay()]
    );

    if (dayOffResult.rows.length > 0) {
      return res.status(400).json({ error: 'Barber is off on the next day' });
    }

    const bookedResult = await pool.query(
      'SELECT id FROM appointments WHERE barber_id = $1 AND appointment_date = $2 AND appointment_time = $3',
      [appointment.barber_id, nextDate, appointment.appointment_time]
    );

    if (bookedResult.rows.length > 0) {
      return res.status(400).json({ error: 'The same time slot is already booked on the next day' });
    }

    const updateResult = await pool.query(
      'UPDATE appointments SET appointment_date = $1 WHERE id = $2 RETURNING *',
      [nextDate, appointmentId]
    );

    res.json(normalizeAppointmentRecord(updateResult.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to move appointment' });
  }
});

app.post('/api/appointments/:id/reschedule', authenticateToken, async (req, res) => {
  const appointmentId = parseInt(req.params.id);
  const { date, time } = req.body;

  if (isNaN(appointmentId) || !date || !time) {
    return res.status(400).json({ error: 'Appointment ID, date, and time are required' });
  }

  try {
    const appointmentResult = await pool.query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);
    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];
    if (req.user.role !== 'boss' && req.user.role !== 'senior_barber' && appointment.barber_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to reschedule this appointment' });
    }

    const dayOffResult = await pool.query(
      'SELECT * FROM day_offs WHERE barber_id = $1 AND (day_off_date = $2 OR (is_recurring = true AND recurring_day_of_week = $3))',
      [appointment.barber_id, date, parseDateString(date).getDay()]
    );

    if (dayOffResult.rows.length > 0) {
      return res.status(400).json({ error: 'Barber is off on the selected date' });
    }

    const bookedResult = await pool.query(
      'SELECT id FROM appointments WHERE barber_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND id != $4',
      [appointment.barber_id, date, time, appointmentId]
    );

    if (bookedResult.rows.length > 0) {
      return res.status(400).json({ error: 'Selected slot is already booked' });
    }

    const updateResult = await pool.query(
      'UPDATE appointments SET appointment_date = $1, appointment_time = $2 WHERE id = $3 RETURNING *',
      [date, time, appointmentId]
    );

    res.json(normalizeAppointmentRecord(updateResult.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
});

app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
  const appointmentId = parseInt(req.params.id);
  if (isNaN(appointmentId)) {
    return res.status(400).json({ error: 'Invalid appointment ID' });
  }

  try {
    const appointmentResult = await pool.query('SELECT barber_id FROM appointments WHERE id = $1', [appointmentId]);
    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];
    if (req.user.role !== 'boss' && req.user.role !== 'senior_barber' && appointment.barber_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to cancel this appointment' });
    }

    const deleteResult = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING id', [appointmentId]);
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

app.post('/api/upload', authenticateToken, upload.array('photos', 12), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const uploaded = req.files.map(file => `/uploads/${file.filename}`);
  res.json({ uploaded });
});

// ==================== DAY-OFF ROUTES ====================

app.get('/api/dayoffs', authenticateToken, async (req, res) => {
  const { barberId, year, month } = req.query;
  try {
    let query = 'SELECT * FROM day_offs WHERE 1=1';
    const params = [];

    if (req.user.role === 'barber') {
      query += ' AND barber_id = $' + (params.length + 1);
      params.push(req.user.id);
    } else if (barberId) {
      query += ' AND barber_id = $' + (params.length + 1);
      params.push(parseInt(barberId));
    }

    if (year && month) {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      query += ' AND day_off_date BETWEEN $' + (params.length + 1) + ' AND $' + (params.length + 2);
      params.push(startDate, endDate);
    }

    query += ' ORDER BY day_off_date';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch day-offs' });
  }
});

app.post('/api/dayoffs', authenticateToken, async (req, res) => {
  const { date, isRecurring, recurringDayOfWeek, notes } = req.body;
  const barberId = (req.user.role === 'boss' || req.user.role === 'senior_barber') ? req.body.barberId : req.user.id;

  try {
    const result = await pool.query(
      'INSERT INTO day_offs (barber_id, day_off_date, is_recurring, recurring_day_of_week, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [barberId, date, isRecurring || false, recurringDayOfWeek || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create day-off' });
  }
});

app.put('/api/dayoffs/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { isRecurring, recurringDayOfWeek, notes } = req.body;

  try {
    const result = await pool.query(
      'UPDATE day_offs SET is_recurring = $1, recurring_day_of_week = $2, notes = $3 WHERE id = $4 AND barber_id = $5 RETURNING *',
      [isRecurring || false, recurringDayOfWeek || null, notes || null, parseInt(id), req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day-off not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update day-off' });
  }
});

app.delete('/api/dayoffs/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const query = req.user.role === 'boss'
      ? 'DELETE FROM day_offs WHERE id = $1 RETURNING id'
      : 'DELETE FROM day_offs WHERE id = $1 AND barber_id = $2 RETURNING id';
    const params = req.user.role === 'boss'
      ? [parseInt(id)]
      : [parseInt(id), req.user.id];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day-off not found or access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete day-off' });
  }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const startServer = async () => {
  try {
    await initializeDatabase();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✨ ZigZag Hairplace server running on http://localhost:${PORT}`);
      console.log('📦 Database: PostgreSQL');
    });
  } catch (err) {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  }
};

startServer();
