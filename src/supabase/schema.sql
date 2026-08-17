-- Paste this in your Supabase SQL Editor to run

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    full_name TEXT,
    dob TEXT,
    gender TEXT,
    email TEXT,
    address TEXT,
    emergency_contact TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) for patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients can view own record" ON patients FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own record" ON patients FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own record" ON patients FOR UPDATE USING (auth.uid() = id);

-- Create staff_accounts table
CREATE TABLE IF NOT EXISTS staff_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'staff' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for staff
ALTER TABLE staff_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own record" ON staff_accounts FOR SELECT USING (auth.uid() = id);

-- Optionally insert an admin staff account for testing (password 'admin123', hashed using bcrypt/pgcrypto ideally)
-- Note: actual password hashing should be handled through Supabase auth or a server API, this is just arbitrary if you want a raw login
-- INSERT INTO staff_accounts (staff_id, password_hash, role) VALUES ('admin', 'admin123_hash_placeholder', 'admin');

-- Create emergency_alerts table (separate from queue — emergency patients do NOT create queue entries)
CREATE TABLE IF NOT EXISTS emergency_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id TEXT UNIQUE NOT NULL,
    patient_name TEXT NOT NULL,
    patient_age INTEGER,
    patient_gender TEXT,
    contact_number TEXT,
    emergency_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'urgent', 'moderate')),
    condition_details TEXT,
    arrival_method TEXT CHECK (arrival_method IN ('ambulance', 'own_transport', 'already_here')),
    estimated_arrival TEXT,
    assistance_needed TEXT[] DEFAULT '{}',
    alert_status TEXT DEFAULT 'new' CHECK (alert_status IN ('new', 'acknowledged', 'in_progress', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for emergency_alerts
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
-- Allow all authenticated users to insert (patients submitting alerts)
CREATE POLICY "Anyone can insert emergency alerts" ON emergency_alerts FOR INSERT WITH CHECK (true);
-- Allow all authenticated users to view (staff viewing alerts)
CREATE POLICY "Anyone can view emergency alerts" ON emergency_alerts FOR SELECT USING (true);
-- Allow staff to update alert status
CREATE POLICY "Anyone can update emergency alerts" ON emergency_alerts FOR UPDATE USING (true);
