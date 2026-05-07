-- PostgreSQL Schema for ZigZag Hairplace
-- Run this file to set up the database

CREATE DATABASE zigzag_hairplace;

-- Connect to the new database
\c zigzag_hairplace;

-- Users table (boss and barbers)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('boss', 'barber')),
  bio TEXT,
  instagram VARCHAR(255),
  tiktok VARCHAR(255),
  photo_urls TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(barber_id, appointment_date, appointment_time)
);

-- Day-offs table (supports recurring)
CREATE TABLE day_offs (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  day_off_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_day_of_week INTEGER CHECK (recurring_day_of_week BETWEEN 0 AND 6),
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX idx_appointments_barber_date ON appointments(barber_id, appointment_date);
CREATE INDEX idx_dayoffs_barber_date ON day_offs(barber_id, day_off_date);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);

-- Insert default users
INSERT INTO users (name, email, password, role) VALUES
  ('ZigZag Boss', 'boss@zigzag.com', '$2a$10$ZQIPoLW9k43OdCYADIN3L.FPO8eMClEevulVoSlG19QYDSqU9FLL.', 'boss'),
  ('Alex Mercer', 'alex@zigzag.com', '$2a$10$peowVLs8e7k42yYXuBtPwOFnWy.PYQotK5kzYQLJtB10UJQuzFP4m', 'barber'),
  ('Maya Lane', 'maya@zigzag.com', '$2a$10$6fExTKbH9KXG1K3D.FdhL.W46yJqdn9aOG.DfnMzOLTRK9Ad.WvKS', 'barber');

-- Note: Default passwords are hashed versions of:
-- Boss: Boss123!
-- Alex: Alex2026!
-- Maya: Maya2026!