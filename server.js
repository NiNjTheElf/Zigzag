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
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS barber_id INTEGER,
        ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS appointment_date DATE,
        ADD COLUMN IF NOT EXISTS appointment_time VARCHAR(10),
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
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, bio: user.bio, instagram: user.instagram, tiktok: user.tiktok, photo_urls: user.photo_urls } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, bio, instagram, tiktok, photo_urls FROM users WHERE id = $1',
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
    const result = await pool.query('SELECT id, name, bio, instagram, tiktok, photo_urls FROM users WHERE role = $1', ['barber']);
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

  const { name, email, password, role, bio, instagram, tiktok, photoUrls } = req.body;
  // Validate and normalize role
  const validRoles = ['boss', 'senior_barber', 'barber', 'junior_barber'];
  const normalizedRole = validRoles.includes(role) ? role : 'barber';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, bio, instagram, tiktok, photo_urls) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email, role, bio, instagram, tiktok, photo_urls',
      [name, email.toLowerCase(), hashedPassword, normalizedRole, bio || null, instagram || null, tiktok || null, photoUrls || null]
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

  if (req.user.role !== 'boss' && req.user.id !== barberId) {
    return res.status(403).json({ error: 'Only a boss or the barber can update this profile' });
  }

  const { bio, instagram, tiktok, photoUrls } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET bio = $1, instagram = $2, tiktok = $3, photo_urls = $4 WHERE id = $5 RETURNING id, name, email, role, bio, instagram, tiktok, photo_urls',
      [bio || null, instagram || null, tiktok || null, photoUrls || null, barberId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update barber profile' });
  }
});

app.delete('/api/barbers/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'boss') {
    return res.status(403).json({ error: 'Only senior barber can fire barbers' });
  }

  const barberId = parseInt(req.params.id);
  if (isNaN(barberId)) {
    return res.status(400).json({ error: 'Invalid barber ID' });
  }

  const { reason } = req.body;

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 AND role IN ($2, $3) RETURNING id',
      [barberId, 'barber', 'junior_barber']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found or cannot fire this user' });
    }

    console.log(`Barber ${barberId} fired by ${req.user.id}: ${reason || 'No reason provided'}`);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fire barber' });
  }
});

app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
  const apptId = parseInt(req.params.id);
  if (isNaN(apptId)) {
    return res.status(400).json({ error: 'Invalid appointment ID' });
  }

  try {
    const appt = await pool.query('SELECT barber_id FROM appointments WHERE id = $1', [apptId]);
    if (appt.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appt.rows[0];
    if (req.user.role !== 'boss' && req.user.role !== 'senior_barber' && appointment.barber_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM appointments WHERE id = $1', [apptId]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// ==================== APPOINTMENT ROUTES ====================

app.get('/api/appointments', authenticateToken, async (req, res) => {
  const { date, barberId } = req.query;
  try {
    let query = 'SELECT * FROM appointments';
    const params = [];
    const conditions = [];

    // Non-boss/non-senior-barber users only see their own appointments
    if (req.user.role !== 'boss' && req.user.role !== 'senior_barber') {
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
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.get('/api/appointments/month/:year/:month', authenticateToken, async (req, res) => {
  const { year, month } = req.params;
  const { barberId } = req.query;
  try {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    let query = 'SELECT * FROM appointments WHERE appointment_date BETWEEN $1 AND $2';
    const params = [startDate, endDate];

    // Non-boss/non-senior-barber users only see their own appointments
    if (req.user.role !== 'boss' && req.user.role !== 'senior_barber') {
      query += ' AND barber_id = $3';
      params.push(req.user.id);
    } else if (barberId) {
      query += ' AND barber_id = $3';
      params.push(parseInt(barberId));
    }

    query += ' ORDER BY appointment_date, appointment_time';
    const result = await pool.query(query, params);
    console.log(`Monthly appointments for ${req.user.role} ${req.user.id} in ${year}-${month}:`, result.rows.length, 'appointments');
    res.json(result.rows);
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
      [parseInt(barberId), date, new Date(date).getDay()]
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
  const { barberId, date, time, clientName, clientPhone } = req.body;
  try {
    // Verify slot is still available
    const checkDayOff = await pool.query(
      'SELECT * FROM day_offs WHERE barber_id = $1 AND (day_off_date = $2 OR (is_recurring = true AND recurring_day_of_week = $3))',
      [parseInt(barberId), date, new Date(date).getDay()]
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
      'INSERT INTO appointments (barber_id, client_name, client_phone, appointment_date, appointment_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [parseInt(barberId), clientName, clientPhone, date, time]
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
