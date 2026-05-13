require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function run() {
  try {
    await pool.connect();
    const hashed = await bcrypt.hash('password123', 10);

    await pool.query("DELETE FROM users WHERE role IN ('SENIOR_BARBER', 'BARBER', 'JUNIOR_BARBER')");

    const barbers = [
      { name: 'Senior Barber', email: 'senior@zigzag.com', role: 'SENIOR_BARBER' },
      { name: 'Barber One', email: 'barber1@zigzag.com', role: 'BARBER' },
      { name: 'Barber Two', email: 'barber2@zigzag.com', role: 'BARBER' },
      { name: 'Junior Barber', email: 'junior@zigzag.com', role: 'JUNIOR_BARBER' }
    ];

    for (const barber of barbers) {
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        [barber.name, barber.email, hashed, barber.role]
      );
    }

    console.log('✅ Inserted senior and 3 barbers successfully.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();