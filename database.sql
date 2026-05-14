-- 1. Create the User Role Enum
CREATE TYPE "UserRole" AS ENUM ('BOSS', 'SENIOR_BARBER', 'BARBER', 'JUNIOR_BARBER');

-- 2. Create the Users table
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BARBER',
    "bio" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "profile_photo_url" TEXT,
    "photo_urls" TEXT[] DEFAULT '{}',
    "services" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create the Appointments table
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" SERIAL PRIMARY KEY,
    "barber_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
    "client_name" TEXT,
    "client_phone" TEXT,
    "appointment_date" DATE,
    "appointment_time" TEXT,
    "service_type" TEXT,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NOT NULL DEFAULT 60;

CREATE INDEX IF NOT EXISTS "appointments_barber_date_idx"
ON "appointments" ("barber_id", "appointment_date");

-- 4. Create the Day Offs table
CREATE TABLE IF NOT EXISTS "day_offs" (
    "id" SERIAL PRIMARY KEY,
    "barber_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
    "day_off_date" DATE,
    "is_recurring" BOOLEAN DEFAULT FALSE,
    "recurring_day_of_week" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "day_offs_barber_date_idx"
ON "day_offs" ("barber_id", "day_off_date");

-- 5. Create custom barber availability times
CREATE TABLE IF NOT EXISTS "barber_available_times" (
    "id" SERIAL PRIMARY KEY,
    "barber_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "time_label" TEXT NOT NULL,
    "sort_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("barber_id", "sort_minutes")
);

CREATE INDEX IF NOT EXISTS "barber_available_times_barber_sort_idx"
ON "barber_available_times" ("barber_id", "sort_minutes");

-- 6. Create the Reviews table
CREATE TABLE IF NOT EXISTS "reviews" (
    "id" SERIAL PRIMARY KEY,
    "barber_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "client_name" TEXT,
    "client_phone" TEXT,
    "reviewer_name" TEXT,
    "reviewer_phone" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "review_text" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Insert default users
INSERT INTO "users" ("name", "email", "password", "role") VALUES
  ('ZigZag Boss', 'boss@zigzag.com', '$2a$10$ZQIPoLW9k43OdCYADIN3L.FPO8eMClEevulVoSlG19QYDSqU9FLL.', 'BOSS'),
  ('Alex Mercer', 'alex@zigzag.com', '$2a$10$peowVLs8e7k42yYXuBtPwOFnWy.PYQotK5kzYQLJtB10UJQuzFP4m', 'BARBER'),
  ('Maya Lane', 'maya@zigzag.com', '$2a$10$6fExTKbH9KXG1K3D.FdhL.W46yJqdn9aOG.DfnMzOLTRK9Ad.WvKS', 'BARBER'),
  ('Marcus Stone', 'marcus@zigzag.com', '$2a$10$X8vN4kM2zY9pR3sL7tQ1H.uWj5PmKnD2bE6cF4hG8iJ1lO0aB2C3Y', 'SENIOR_BARBER')
ON CONFLICT ("email") DO NOTHING;

-- Note: Default passwords are hashed versions of:
-- Boss: Boss123!
-- Alex: Alex2026!
-- Maya: Maya2026!
-- Marcus: MarCus2026!
