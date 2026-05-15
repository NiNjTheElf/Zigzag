const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'profilePhoto';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('./'));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

const { Pool } = require('pg');

// Initialize the Postgres connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This is required for Supabase
  }
});

// A simple way to check if it's working
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error acquiring client', err.stack);
  }
  console.log('✅ Connected to Supabase via Raw SQL');
  release();
});

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
const SLOT_TIMES = ['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM', '5:30 PM'];
const DEFAULT_SERVICE_DURATION = 60;
const BOOKING_CONFIRMATION_TTL_MINUTES = 10;
const MAX_CONFIRMATION_ATTEMPTS = 5;

async function ensureRuntimeSchema() {
  await pool.query('ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NOT NULL DEFAULT 60');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "booking_confirmations" (
      "id" SERIAL PRIMARY KEY,
      "confirmation_token" TEXT UNIQUE NOT NULL,
      "barber_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "client_name" TEXT NOT NULL,
      "client_phone" TEXT NOT NULL,
      "appointment_date" DATE NOT NULL,
      "appointment_time" TEXT NOT NULL,
      "service_type" TEXT NOT NULL DEFAULT 'Haircut',
      "duration_minutes" INTEGER NOT NULL DEFAULT 60,
      "code_hash" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "attempt_count" INTEGER NOT NULL DEFAULT 0,
      "expires_at" TIMESTAMPTZ NOT NULL,
      "confirmed_at" TIMESTAMPTZ,
      "appointment_id" INTEGER REFERENCES "appointments"("id") ON DELETE SET NULL,
      "created_at" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "barber_available_times" (
      "id" SERIAL PRIMARY KEY,
      "barber_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "time_label" TEXT NOT NULL,
      "sort_minutes" INTEGER NOT NULL,
      "created_at" TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE ("barber_id", "sort_minutes")
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS "appointments_barber_date_idx" ON "appointments" ("barber_id", "appointment_date")');
  await pool.query('CREATE INDEX IF NOT EXISTS "day_offs_barber_date_idx" ON "day_offs" ("barber_id", "day_off_date")');
  await pool.query('CREATE INDEX IF NOT EXISTS "barber_available_times_barber_sort_idx" ON "barber_available_times" ("barber_id", "sort_minutes")');
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "booking_confirmations_pending_token_idx"
    ON "booking_confirmations" ("confirmation_token")
    WHERE "status" = 'pending'
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "booking_confirmations_pending_phone_idx"
    ON "booking_confirmations" ("client_phone", "created_at")
    WHERE "status" = 'pending'
  `);
}

ensureRuntimeSchema().catch(error => {
  console.error('Failed to prepare database schema', error);
});

// Helper function to normalize user object
function normalizeUser(dbUser) {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    bio: dbUser.bio,
    instagram: dbUser.instagram,
    tiktok: dbUser.tiktok,
    profile_photo_url: dbUser.profile_photo_url,
    photo_urls: dbUser.photo_urls,
    profilePhotoUrl: dbUser.profile_photo_url,
    photoUrls: dbUser.photo_urls,
    services: dbUser.services
  };
}

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function parseServiceList(rawServices) {
  if (!rawServices) return [];
  if (Array.isArray(rawServices)) {
    return rawServices.map(item => (typeof item === 'string' ? { name: item } : item));
  }
  if (typeof rawServices !== 'string') return [];

  const trimmed = rawServices.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.map(item => (typeof item === 'string' ? { name: item } : item))
        : [];
    } catch {
      // Legacy parsing below.
    }
  }

  const parts = trimmed.split(';').map(s => s.trim()).filter(Boolean);
  const services = [];
  parts.forEach(part => {
    const [category, items] = part.split(':').map(s => s.trim());
    if (!items) return;
    items.split(',').map(item => item.trim()).filter(Boolean).forEach(item => {
      services.push({ name: `${category} - ${item}` });
    });
  });
  return services.length ? services : [{ name: trimmed }];
}

function normalizeDuration(value) {
  const duration = parseInt(value, 10);
  if (!Number.isFinite(duration)) return DEFAULT_SERVICE_DURATION;
  return Math.min(Math.max(duration, 5), 480);
}

function parseTimeToMinutes(label) {
  if (!label) return null;
  const text = String(label).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3] ? match[3].toUpperCase() : '';
  if (minutes < 0 || minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  } else if (hours < 0 || hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatMinutesToLabel(totalMinutes) {
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getDurationFromServices(rawServices, serviceType, fallback = DEFAULT_SERVICE_DURATION) {
  const services = parseServiceList(rawServices);
  const match = services.find(service => String(service.name || '').trim() === String(serviceType || '').trim());
  return normalizeDuration(match?.durationMinutes || match?.duration || fallback);
}

async function getBarberServices(barberId, db = pool) {
  const result = await db.query('SELECT "services" FROM "users" WHERE "id" = $1', [barberId]);
  return result.rows[0]?.services || '';
}

async function resolveAppointmentDuration(barberId, serviceType, requestedDuration, db = pool) {
  if (requestedDuration !== undefined && requestedDuration !== null && requestedDuration !== '') {
    return normalizeDuration(requestedDuration);
  }
  const services = await getBarberServices(barberId, db);
  return getDurationFromServices(services, serviceType);
}

async function getBarberAvailableTimes(barberId, db = pool) {
  const result = await db.query(
    'SELECT "id", "time_label", "sort_minutes" FROM "barber_available_times" WHERE "barber_id" = $1 ORDER BY "sort_minutes"',
    [barberId]
  );
  if (result.rows.length) return result.rows;
  return SLOT_TIMES.map(time => ({
    id: null,
    time_label: time,
    sort_minutes: parseTimeToMinutes(time),
  }));
}

async function getBookedIntervals(barberId, date, ignoreAppointmentId = null, db = pool) {
  let query = 'SELECT "id", "appointment_time", "service_type", "duration_minutes" FROM "appointments" WHERE "barber_id" = $1 AND "appointment_date" = $2';
  const params = [barberId, date];
  if (ignoreAppointmentId) {
    query += ' AND "id" != $3';
    params.push(ignoreAppointmentId);
  }
  const result = await db.query(query, params);
  const services = await getBarberServices(barberId, db);
  return result.rows.map(row => {
    const start = parseTimeToMinutes(row.appointment_time);
    const duration = normalizeDuration(row.duration_minutes || getDurationFromServices(services, row.service_type));
    return start === null ? null : { start, end: start + duration };
  }).filter(Boolean);
}

async function isTimeAvailable(barberId, date, time, durationMinutes, ignoreAppointmentId = null, db = pool) {
  const start = parseTimeToMinutes(time);
  if (start === null) return false;
  const slots = await getBarberAvailableTimes(barberId, db);
  const matchesSlot = slots.some(slot => slot.sort_minutes === start || slot.time_label === time);
  if (!matchesSlot) return false;
  const bookedIntervals = await getBookedIntervals(barberId, date, ignoreAppointmentId, db);
  return !bookedIntervals.some(interval => intervalsOverlap(start, start + durationMinutes, interval.start, interval.end));
}

function createConfirmationToken() {
  return crypto.randomBytes(18).toString('hex');
}

function createVerificationCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashVerificationCode(token, code) {
  return crypto
    .createHash('sha256')
    .update(`${token}:${String(code || '').trim()}:${JWT_SECRET}`)
    .digest('hex');
}

function normalizeClientPhone(phone) {
  return String(phone || '').trim();
}

function hasUsablePhoneNumber(phone) {
  return normalizeClientPhone(phone).replace(/\D/g, '').length >= 7;
}

function normalizeDateKey(value) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function getDateLockKey(dateKey) {
  const compact = normalizeDateKey(dateKey).replace(/\D/g, '');
  const parsed = parseInt(compact, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function checkBookingAvailability(barberId, date, time, duration, db = pool) {
  const dateKey = normalizeDateKey(date);
  const dayOffResult = await db.query(
    'SELECT "id" FROM "day_offs" WHERE "barber_id" = $1 AND ("day_off_date" = $2 OR ("is_recurring" = true AND "recurring_day_of_week" = $3))',
    [barberId, dateKey, getDayOfWeekFromDateKey(dateKey)]
  );

  if (dayOffResult.rows.length > 0) {
    return { available: false, error: 'Barber is off on this date' };
  }

  const available = await isTimeAvailable(barberId, dateKey, time, duration, null, db);
  return available
    ? { available: true }
    : { available: false, error: 'Time slot is no longer available' };
}

async function sendBookingConfirmationCode(phone, code) {
  console.log(`Booking confirmation code for ${phone}: ${code}`);
  return { channel: 'demo_sms', message: 'Demo SMS generated. Connect an SMS provider to send this for real.' };
}

function getSafeUploadName(originalName) {
  return String(originalName || 'photo').replace(/[^a-zA-Z0-9.\-]/g, '_');
}

function getPublicStorageUrl(objectPath) {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`;
}

async function uploadFileToSupabase(file, objectPath) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Content-Type': file.mimetype || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file.buffer,
  });
  if (!response.ok) {
    const details = await response.text().catch(() => 'Upload failed');
    throw new Error(`Supabase upload failed: ${details}`);
  }
  return getPublicStorageUrl(objectPath);
}

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
    // Correct SQL query
    const result = await pool.query('SELECT * FROM "users" WHERE LOWER(email) = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    
    // Use snake_case names from the database result
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        profile_photo_url: user.profile_photo_url,
        photo_urls: user.photo_urls,
        profilePhotoUrl: user.profile_photo_url, 
        photoUrls: user.photo_urls 
      } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, bio, instagram, tiktok, profile_photo_url, photo_urls, services FROM "users" WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = normalizeUser(result.rows[0]);
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

// ==================== BARBER ROUTES ====================

app.get('/api/barbers', async (req, res) => {
  try {
    const query = `
      SELECT id, name, role, bio, instagram, tiktok, profile_photo_url, photo_urls, services 
      FROM "users" 
      WHERE role != 'BOSS'
    `;
    const result = await pool.query(query);
    const normalizedBarbers = result.rows.map(normalizeUser);
    res.json(normalizedBarbers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch barbers' });
  }
});

app.post('/api/barbers', authenticateToken, async (req, res) => {
  if (req.user.role !== 'BOSS' && req.user.role !== 'SENIOR_BARBER') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, email, password, role, bio, instagram, tiktok, profilePhotoUrl, photoUrls, services } = req.body;
  const requestedRole = normalizeRole(role) || 'BARBER';
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO "users" (name, email, password, role, bio, instagram, tiktok, profile_photo_url, photo_urls, services)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, email, role`;
    
    const values = [name, email.toLowerCase(), hashedPassword, requestedRole, bio, instagram, tiktok, profilePhotoUrl, photoUrls || [], services];
    const result = await pool.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // 23505 is the SQL code for Unique Violation (Duplicate Email)
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.put('/api/barbers/:id', authenticateToken, async (req, res) => {
  const barberId = parseInt(req.params.id);
  if (isNaN(barberId)) {
    return res.status(400).json({ error: 'Invalid barber ID' });
  }

  const { name, bio, instagram, tiktok, profilePhotoUrl, photoUrls, services, role } = req.body;
  try {
    const existingResult = await pool.query(
      'SELECT name, role, bio, instagram, tiktok, profile_photo_url, photo_urls, services FROM "users" WHERE id = $1',
      [barberId]
    );
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }
    const existingBarber = existingResult.rows[0];
    const targetRole = existingBarber.role;

    if (req.user.id !== barberId && req.user.role !== 'BOSS' && req.user.role !== 'SENIOR_BARBER') {
      return res.status(403).json({ error: 'Only a boss or the barber can update this profile' });
    }

    let desiredRole = targetRole;
    const validRoles = ['BOSS', 'SENIOR_BARBER', 'BARBER', 'JUNIOR_BARBER'];

    const requestedRole = normalizeRole(role);
    if (requestedRole && requestedRole !== targetRole) {
      if (req.user.role === 'BOSS') {
        desiredRole = validRoles.includes(requestedRole) ? requestedRole : targetRole;
      } else if (req.user.role === 'SENIOR_BARBER') {
        if (targetRole === 'JUNIOR_BARBER' && requestedRole === 'BARBER') {
          desiredRole = 'BARBER';
        } else {
          return res.status(403).json({ error: 'Senior barber can only change junior barber to regular barber' });
        }
      } else {
        return res.status(403).json({ error: 'Cannot change role' });
      }
    }

    if (req.user.id === barberId && requestedRole && requestedRole !== targetRole) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      updates.push(`name = $${paramCount++}`);
      values.push(cleanName);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio);
    }
    if (instagram !== undefined) {
      updates.push(`instagram = $${paramCount++}`);
      values.push(instagram);
    }
    if (tiktok !== undefined) {
      updates.push(`tiktok = $${paramCount++}`);
      values.push(tiktok);
    }
    if (profilePhotoUrl !== undefined) {
      updates.push(`profile_photo_url = $${paramCount++}`);
      values.push(profilePhotoUrl);
    }
    if (photoUrls !== undefined) {
      updates.push(`photo_urls = $${paramCount++}`);
      values.push(photoUrls);
    }
    if (services !== undefined) {
      updates.push(`services = $${paramCount++}`);
      values.push(services);
    }
    if (desiredRole !== targetRole) {
      updates.push(`role = $${paramCount++}`);
      values.push(desiredRole);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(barberId);
    const updateQuery = `UPDATE "users" SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, role, bio, instagram, tiktok, profile_photo_url, photo_urls, services`;
    const updatedResult = await pool.query(updateQuery, values);
    const updatedBarber = normalizeUser(updatedResult.rows[0]);

    res.json(updatedBarber);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update barber profile' });
  }
});

app.delete('/api/barbers/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'BOSS' && req.user.role !== 'SENIOR_BARBER') {
    return res.status(403).json({ error: 'Only boss or senior barber can fire barbers' });
  }

  const barberId = parseInt(req.params.id);
  if (isNaN(barberId)) {
    return res.status(400).json({ error: 'Invalid barber ID' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM "users" WHERE id = $1 AND role IN ($2, $3) RETURNING id',
      [barberId, 'BARBER', 'JUNIOR_BARBER']
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

const getDayOfWeekFromDateKey = (dateStr) => {
  const [year, month, day] = String(dateStr || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
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

const normalizeDayOffRecord = (row) => ({
  ...row,
  day_off_date: row.day_off_date instanceof Date
    ? formatDateOnly(row.day_off_date)
    : row.day_off_date,
});

app.get('/api/appointments', authenticateToken, async (req, res) => {
  const { date, barberId } = req.query;
  try {
    let query = 'SELECT * FROM "appointments"';
    const params = [];
    const conditions = [];

    const isManager = req.user.role === 'BOSS' || req.user.role === 'SENIOR_BARBER';
    if (!isManager) {
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
    const startDate = formatDateOnly(new Date(year, month - 1, 1));
    const endDate = formatDateOnly(new Date(year, month, 0));

    let query = 'SELECT * FROM "appointments" WHERE "appointment_date" BETWEEN $1 AND $2';
    const params = [startDate, endDate];

    const isManager = req.user.role === 'BOSS' || req.user.role === 'SENIOR_BARBER';
    if (!isManager) {
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
  const { barberId, date, serviceType, durationMinutes } = req.query;
  const parsedBarberId = parseInt(barberId);
  if (isNaN(parsedBarberId) || !date) {
    return res.status(400).json({ error: 'Barber and date are required' });
  }
  try {
    const dayOffResult = await pool.query(
      'SELECT * FROM "day_offs" WHERE "barber_id" = $1 AND ("day_off_date" = $2 OR ("is_recurring" = true AND "recurring_day_of_week" = $3))',
      [parsedBarberId, date, getDayOfWeekFromDateKey(date)]
    );

    if (dayOffResult.rows.length > 0) {
      return res.json({ available: [], isDayOff: true });
    }

    const duration = await resolveAppointmentDuration(parsedBarberId, serviceType, durationMinutes);
    const slots = await getBarberAvailableTimes(parsedBarberId);
    const bookedIntervals = await getBookedIntervals(parsedBarberId, date);
    const available = slots
      .filter(slot => !bookedIntervals.some(interval => intervalsOverlap(slot.sort_minutes, slot.sort_minutes + duration, interval.start, interval.end)))
      .map(slot => slot.time_label);
    res.json({ available, isDayOff: false, durationMinutes: duration });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

app.post('/api/booking-confirmations/request', async (req, res) => {
  const { barberId, date, time, clientName, clientPhone, serviceType, durationMinutes } = req.body;
  const parsedBarberId = parseInt(barberId, 10);
  const normalizedName = String(clientName || '').trim();
  const normalizedPhone = normalizeClientPhone(clientPhone);

  if (isNaN(parsedBarberId) || !date || !time || !normalizedName || !hasUsablePhoneNumber(normalizedPhone)) {
    return res.status(400).json({ error: 'Missing booking details or phone number' });
  }

  try {
    const duration = await resolveAppointmentDuration(parsedBarberId, serviceType, durationMinutes);
    const availability = await checkBookingAvailability(parsedBarberId, date, time, duration);
    if (!availability.available) {
      return res.status(400).json({ error: availability.error });
    }

    const code = createVerificationCode();
    const token = createConfirmationToken();
    const codeHash = hashVerificationCode(token, code);
    const delivery = await sendBookingConfirmationCode(normalizedPhone, code);

    const result = await pool.query(
      `INSERT INTO "booking_confirmations"
        ("confirmation_token", "barber_id", "client_name", "client_phone", "appointment_date", "appointment_time", "service_type", "duration_minutes", "code_hash", "expires_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + ($10 * interval '1 minute'))
       RETURNING "confirmation_token", "barber_id", "client_name", "client_phone", "appointment_date", "appointment_time", "service_type", "duration_minutes", "expires_at"`,
      [
        token,
        parsedBarberId,
        normalizedName,
        normalizedPhone,
        date,
        time,
        serviceType || 'Haircut',
        duration,
        codeHash,
        BOOKING_CONFIRMATION_TTL_MINUTES,
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      expiresInMinutes: BOOKING_CONFIRMATION_TTL_MINUTES,
      delivery,
      demoCode: code,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to prepare booking confirmation' });
  }
});

app.post('/api/booking-confirmations/confirm', async (req, res) => {
  const { confirmationToken, code } = req.body;
  if (!confirmationToken || !code) {
    return res.status(400).json({ error: 'Confirmation code is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const confirmationResult = await client.query(
      `SELECT *
       FROM "booking_confirmations"
       WHERE "confirmation_token" = $1
       FOR UPDATE`,
      [confirmationToken]
    );
    const confirmation = confirmationResult.rows[0];

    if (!confirmation || confirmation.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Confirmation request was not found or already used' });
    }

    if (new Date(confirmation.expires_at).getTime() <= Date.now()) {
      await client.query(
        'UPDATE "booking_confirmations" SET "status" = $1 WHERE "id" = $2',
        ['expired', confirmation.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Confirmation code expired. Request a new one.' });
    }

    if (confirmation.attempt_count >= MAX_CONFIRMATION_ATTEMPTS) {
      await client.query(
        'UPDATE "booking_confirmations" SET "status" = $1 WHERE "id" = $2',
        ['failed', confirmation.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }

    const codeHash = hashVerificationCode(confirmation.confirmation_token, code);
    if (codeHash !== confirmation.code_hash) {
      await client.query(
        'UPDATE "booking_confirmations" SET "attempt_count" = "attempt_count" + 1 WHERE "id" = $1',
        [confirmation.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Incorrect confirmation code' });
    }

    await client.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [confirmation.barber_id, getDateLockKey(confirmation.appointment_date)]
    );

    const availability = await checkBookingAvailability(
      confirmation.barber_id,
      confirmation.appointment_date,
      confirmation.appointment_time,
      normalizeDuration(confirmation.duration_minutes),
      client
    );

    if (!availability.available) {
      await client.query(
        'UPDATE "booking_confirmations" SET "status" = $1 WHERE "id" = $2',
        ['failed', confirmation.id]
      );
      await client.query('COMMIT');
      return res.status(400).json({ error: availability.error });
    }

    const appointmentResult = await client.query(
      'INSERT INTO "appointments" ("barber_id", "client_name", "client_phone", "appointment_date", "appointment_time", "service_type", "duration_minutes") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        confirmation.barber_id,
        confirmation.client_name,
        confirmation.client_phone,
        confirmation.appointment_date,
        confirmation.appointment_time,
        confirmation.service_type || 'Haircut',
        normalizeDuration(confirmation.duration_minutes),
      ]
    );

    await client.query(
      'UPDATE "booking_confirmations" SET "status" = $1, "confirmed_at" = NOW(), "appointment_id" = $2 WHERE "id" = $3',
      ['confirmed', appointmentResult.rows[0].id, confirmation.id]
    );
    await client.query('COMMIT');

    res.status(201).json(appointmentResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  } finally {
    client.release();
  }
});

app.post('/api/appointments', async (req, res) => {
  const { barberId, date, time, clientName, clientPhone, serviceType, durationMinutes } = req.body;
  const parsedBarberId = parseInt(barberId);
  if (isNaN(parsedBarberId) || !date || !time || !clientName || !clientPhone) {
    return res.status(400).json({ error: 'Missing appointment details' });
  }
  try {
    const duration = await resolveAppointmentDuration(parsedBarberId, serviceType, durationMinutes);
    const checkDayOff = await pool.query(
      'SELECT * FROM "day_offs" WHERE "barber_id" = $1 AND ("day_off_date" = $2 OR ("is_recurring" = true AND "recurring_day_of_week" = $3))',
      [parsedBarberId, date, getDayOfWeekFromDateKey(date)]
    );

    if (checkDayOff.rows.length > 0) {
      return res.status(400).json({ error: 'Barber is off on this date' });
    }

    const available = await isTimeAvailable(parsedBarberId, date, time, duration);
    if (!available) {
      return res.status(400).json({ error: 'Time slot is no longer available' });
    }

    const result = await pool.query(
      'INSERT INTO "appointments" ("barber_id", "client_name", "client_phone", "appointment_date", "appointment_time", "service_type", "duration_minutes") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [parsedBarberId, clientName, clientPhone, date, time, serviceType || 'Haircut', duration]
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
    if (req.user.role !== 'BOSS' && req.user.role !== 'SENIOR_BARBER' && appointment.barber_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to move this appointment' });
    }

    const currentDate = parseDateString(appointment.appointment_date);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDate = formatDateOnly(currentDate);

    const dayOffResult = await pool.query(
      'SELECT * FROM "day_offs" WHERE "barber_id" = $1 AND ("day_off_date" = $2 OR ("is_recurring" = true AND "recurring_day_of_week" = $3))',
      [appointment.barber_id, nextDate, getDayOfWeekFromDateKey(nextDate)]
    );

    if (dayOffResult.rows.length > 0) {
      return res.status(400).json({ error: 'Barber is off on the next day' });
    }

    const duration = normalizeDuration(appointment.duration_minutes || await resolveAppointmentDuration(appointment.barber_id, appointment.service_type));
    const available = await isTimeAvailable(appointment.barber_id, nextDate, appointment.appointment_time, duration, appointmentId);
    if (!available) {
      return res.status(400).json({ error: 'The same time slot is already booked on the next day' });
    }

    const updateResult = await pool.query(
      'UPDATE "appointments" SET "appointment_date" = $1 WHERE "id" = $2 RETURNING *',
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
    const appointmentResult = await pool.query('SELECT * FROM "appointments" WHERE "id" = $1', [appointmentId]);
    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];
    if (req.user.role !== 'BOSS' && req.user.role !== 'SENIOR_BARBER' && appointment.barber_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to reschedule this appointment' });
    }

    const dayOffResult = await pool.query(
      'SELECT * FROM "day_offs" WHERE "barber_id" = $1 AND ("day_off_date" = $2 OR ("is_recurring" = true AND "recurring_day_of_week" = $3))',
      [appointment.barber_id, date, getDayOfWeekFromDateKey(date)]
    );

    if (dayOffResult.rows.length > 0) {
      return res.status(400).json({ error: 'Barber is off on the selected date' });
    }

    const duration = normalizeDuration(appointment.duration_minutes || await resolveAppointmentDuration(appointment.barber_id, appointment.service_type));
    const available = await isTimeAvailable(appointment.barber_id, date, time, duration, appointmentId);
    if (!available) {
      return res.status(400).json({ error: 'Selected slot is already booked' });
    }

    const updateResult = await pool.query(
      'UPDATE "appointments" SET "appointment_date" = $1, "appointment_time" = $2 WHERE "id" = $3 RETURNING *',
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
    const appointmentResult = await pool.query('SELECT "barber_id" FROM "appointments" WHERE "id" = $1', [appointmentId]);
    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];
    if (req.user.role !== 'BOSS' && req.user.role !== 'SENIOR_BARBER' && appointment.barber_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to cancel this appointment' });
    }

    const deleteResult = await pool.query('DELETE FROM "appointments" WHERE "id" = $1 RETURNING "id"', [appointmentId]);
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

app.post('/api/upload', authenticateToken, upload.array('photos', 12), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  try {
    const type = String(req.body.type || 'photos').replace(/[^a-zA-Z0-9_-]/g, '') || 'photos';
    const uploaded = [];

    for (const [index, file] of req.files.entries()) {
      const safeName = getSafeUploadName(file.originalname);
      const objectPath = `user-${req.user.id}/${type}/${Date.now()}-${index}-${safeName}`;
      const supabaseUrl = await uploadFileToSupabase(file, objectPath);

      if (supabaseUrl) {
        uploaded.push(supabaseUrl);
      } else {
        const filename = `${Date.now()}-${index}-${safeName}`;
        fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
        uploaded.push(`/uploads/${filename}`);
      }
    }

    res.json({ uploaded });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ==================== AVAILABILITY ROUTES ====================

app.get('/api/availability/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT "id", "time_label", "sort_minutes" FROM "barber_available_times" WHERE "barber_id" = $1 ORDER BY "sort_minutes"',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch availability times' });
  }
});

app.post('/api/availability', authenticateToken, async (req, res) => {
  const minutes = parseTimeToMinutes(req.body.time);
  if (minutes === null) {
    return res.status(400).json({ error: 'Enter a valid time' });
  }

  try {
    const label = formatMinutesToLabel(minutes);
    const result = await pool.query(
      `INSERT INTO "barber_available_times" ("barber_id", "time_label", "sort_minutes")
       VALUES ($1, $2, $3)
       ON CONFLICT ("barber_id", "sort_minutes") DO UPDATE SET "time_label" = EXCLUDED."time_label"
       RETURNING "id", "time_label", "sort_minutes"`,
      [req.user.id, label, minutes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save availability time' });
  }
});

app.delete('/api/availability/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid availability time' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM "barber_available_times" WHERE "id" = $1 AND "barber_id" = $2 RETURNING "id"',
      [id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Availability time not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete availability time' });
  }
});

// ==================== DAY-OFF ROUTES ====================

app.get('/api/dayoffs/public', async (req, res) => {
  const parsedBarberId = parseInt(req.query.barberId, 10);
  const parsedYear = parseInt(req.query.year, 10);
  const parsedMonth = parseInt(req.query.month, 10);

  if (isNaN(parsedBarberId) || isNaN(parsedYear) || isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return res.status(400).json({ error: 'barberId, year, and month are required' });
  }

  try {
    const startDate = formatDateOnly(new Date(parsedYear, parsedMonth - 1, 1));
    const endDate = formatDateOnly(new Date(parsedYear, parsedMonth, 0));

    const result = await pool.query(
      `SELECT "day_off_date", "is_recurring", "recurring_day_of_week"
       FROM "day_offs"
       WHERE "barber_id" = $1
         AND (
           ("is_recurring" = false AND "day_off_date" BETWEEN $2 AND $3)
           OR
           ("is_recurring" = true AND "day_off_date" <= $3)
         )`,
      [parsedBarberId, startDate, endDate]
    );

    const closedDates = new Set();
    const recurringRules = [];

    result.rows.forEach(row => {
      const dayOffDateKey = row.day_off_date instanceof Date ? formatDateOnly(row.day_off_date) : String(row.day_off_date || '');
      if (!dayOffDateKey) return;
      if (row.is_recurring && row.recurring_day_of_week !== null && row.recurring_day_of_week !== undefined) {
        recurringRules.push({
          startDateKey: dayOffDateKey,
          dayOfWeek: Number(row.recurring_day_of_week),
        });
      } else if (dayOffDateKey >= startDate && dayOffDateKey <= endDate) {
        closedDates.add(dayOffDateKey);
      }
    });

    const daysInMonth = new Date(parsedYear, parsedMonth, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(parsedYear, parsedMonth - 1, day);
      const dateKey = formatDateOnly(date);
      const dayOfWeek = date.getDay();

      recurringRules.forEach(rule => {
        if (dayOfWeek === rule.dayOfWeek && dateKey >= rule.startDateKey) {
          closedDates.add(dateKey);
        }
      });
    }

    res.json({ closedDates: Array.from(closedDates).sort() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch public day-offs' });
  }
});

app.get('/api/dayoffs', authenticateToken, async (req, res) => {
  const { barberId, year, month } = req.query;
  try {
    let query = 'SELECT * FROM "day_offs" WHERE 1=1';
    const params = [];

    const isManager = req.user.role === 'BOSS' || req.user.role === 'SENIOR_BARBER';
    if (!isManager) {
      query += ' AND barber_id = $' + (params.length + 1);
      params.push(req.user.id);
    } else if (barberId) {
      query += ' AND barber_id = $' + (params.length + 1);
      params.push(parseInt(barberId));
    }

    if (year && month) {
      const startDate = formatDateOnly(new Date(year, month - 1, 1));
      const endDate = formatDateOnly(new Date(year, month, 0));
      query += ' AND day_off_date BETWEEN $' + (params.length + 1) + ' AND $' + (params.length + 2);
      params.push(startDate, endDate);
    }

    query += ' ORDER BY day_off_date';
    const result = await pool.query(query, params);
    res.json(result.rows.map(normalizeDayOffRecord));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch day-offs' });
  }
});

app.post('/api/dayoffs', authenticateToken, async (req, res) => {
  const { date, isRecurring, recurringDayOfWeek, notes } = req.body;
  const isManager = req.user.role === 'BOSS' || req.user.role === 'SENIOR_BARBER';
  const barberId = isManager && req.body.barberId ? parseInt(req.body.barberId) : req.user.id;

  try {
    const normalizedRecurringDow = isRecurring
      ? (recurringDayOfWeek !== null && recurringDayOfWeek !== undefined
        ? parseInt(recurringDayOfWeek, 10)
        : getDayOfWeekFromDateKey(date))
      : null;
    const result = await pool.query(
      'INSERT INTO day_offs (barber_id, day_off_date, is_recurring, recurring_day_of_week, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [barberId, date, isRecurring || false, normalizedRecurringDow, notes || null]
    );
    res.status(201).json(normalizeDayOffRecord(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create day-off' });
  }
});

app.put('/api/dayoffs/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { isRecurring, recurringDayOfWeek, notes } = req.body;

  try {
    const normalizedRecurringDow = isRecurring
      ? (recurringDayOfWeek !== null && recurringDayOfWeek !== undefined ? parseInt(recurringDayOfWeek, 10) : null)
      : null;
    const result = await pool.query(
      'UPDATE day_offs SET is_recurring = $1, recurring_day_of_week = $2, notes = $3 WHERE id = $4 AND barber_id = $5 RETURNING *',
      [isRecurring || false, normalizedRecurringDow, notes || null, parseInt(id), req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day-off not found or access denied' });
    }

    res.json(normalizeDayOffRecord(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update day-off' });
  }
});

app.delete('/api/dayoffs/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const isManager = req.user.role === 'BOSS' || req.user.role === 'SENIOR_BARBER';
    const query = isManager
      ? 'DELETE FROM "day_offs" WHERE "id" = $1 RETURNING "id"'
      : 'DELETE FROM "day_offs" WHERE "id" = $1 AND "barber_id" = $2 RETURNING "id"';
    const params = isManager
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

// ==================== REVIEW ROUTES ====================

app.get('/api/reviews', async (req, res) => {
  const { barberId } = req.query;
  try {
    let query = `SELECT
        id,
        barber_id,
        COALESCE(reviewer_name, client_name) AS client_name,
        COALESCE(reviewer_phone, client_phone) AS client_phone,
        rating,
        COALESCE(review_text, comment) AS comment,
        created_at
      FROM reviews`;
    const params = [];

    if (barberId) {
      query += ' WHERE barber_id = $1';
      params.push(parseInt(barberId));
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.get('/api/reviews/average/:barberId', async (req, res) => {
  const { barberId } = req.params;
  try {
    const result = await pool.query(
      'SELECT ROUND(AVG("rating")::numeric, 1) as average, COUNT(*) as count FROM "reviews" WHERE "barber_id" = $1',
      [parseInt(barberId)]
    );
    const row = result.rows[0];
    res.json({
      average: row.average ? parseFloat(row.average) : 0,
      count: parseInt(row.count),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch average rating' });
  }
});

app.post('/api/reviews', async (req, res) => {
  const { barberId, clientName, clientPhone, rating, comment } = req.body;

  if (!barberId || !clientName || !clientPhone || !rating) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    // Check if the client has an appointment with this barber
    const appointmentCheck = await pool.query(
      'SELECT "id" FROM "appointments" WHERE "barber_id" = $1 AND "client_phone" = $2',
      [parseInt(barberId), clientPhone]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must have an appointment with this barber to leave a review' });
    }

    const result = await pool.query(
      'INSERT INTO reviews (barber_id, client_name, client_phone, reviewer_name, reviewer_phone, rating, comment, review_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [
        parseInt(barberId),
        clientName,
        clientPhone,
        clientName,
        clientPhone,
        parseInt(rating),
        comment || null,
        comment || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Simplified Start Logic
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✨ ZigZag Hairplace server running on http://localhost:${PORT}`);
  console.log('📦 Database: PostgreSQL (Connected via Pool)');
});
