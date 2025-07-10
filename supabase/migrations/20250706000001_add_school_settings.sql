-- Add school settings and timings tables
-- Up migration

-- Create school_settings table
CREATE TABLE IF NOT EXISTS school_settings (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Create school_timings table
CREATE TABLE IF NOT EXISTS school_timings (
  id BIGSERIAL PRIMARY KEY,
  day VARCHAR(20) NOT NULL,
  day_order INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  breaks JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(day)
);

-- Insert default school settings
INSERT INTO school_settings (id, name, address, phone, email, website) 
VALUES (1, 'Ibex School', '123 Education Street', '+1 (555) 123-4567', 'info@ibexschool.edu', 'https://ibexschool.edu')
ON CONFLICT (id) DO NOTHING;

-- Insert default school timings
INSERT INTO school_timings (day, day_order, start_time, end_time, is_active, breaks) VALUES
  ('Monday', 0, '08:00', '15:00', true, '[
    {"name": "Morning Recess", "startTime": "10:00", "endTime": "10:15", "type": "recess"},
    {"name": "Lunch Break", "startTime": "12:00", "endTime": "12:45", "type": "lunch"}
  ]'),
  ('Tuesday', 1, '08:00', '15:00', true, '[
    {"name": "Morning Recess", "startTime": "10:00", "endTime": "10:15", "type": "recess"},
    {"name": "Lunch Break", "startTime": "12:00", "endTime": "12:45", "type": "lunch"}
  ]'),
  ('Wednesday', 2, '08:00', '15:00', true, '[
    {"name": "Morning Recess", "startTime": "10:00", "endTime": "10:15", "type": "recess"},
    {"name": "Lunch Break", "startTime": "12:00", "endTime": "12:45", "type": "lunch"}
  ]'),
  ('Thursday', 3, '08:00', '15:00', true, '[
    {"name": "Morning Recess", "startTime": "10:00", "endTime": "10:15", "type": "recess"},
    {"name": "Lunch Break", "startTime": "12:00", "endTime": "12:45", "type": "lunch"}
  ]'),
  ('Friday', 4, '08:00', '15:00', true, '[
    {"name": "Morning Recess", "startTime": "10:00", "endTime": "10:15", "type": "recess"},
    {"name": "Lunch Break", "startTime": "12:00", "endTime": "12:45", "type": "lunch"}
  ]'),
  ('Saturday', 5, '08:00', '15:00', false, '[]'),
  ('Sunday', 6, '08:00', '15:00', false, '[]')
ON CONFLICT (day) DO NOTHING;

-- Add RLS policies for school_settings
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School settings are viewable by all authenticated users" ON school_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "School settings are editable by admins only" ON school_settings
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Add RLS policies for school_timings
ALTER TABLE school_timings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School timings are viewable by all authenticated users" ON school_timings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "School timings are editable by admins only" ON school_timings
  FOR ALL USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_school_timings_day ON school_timings(day);
CREATE INDEX IF NOT EXISTS idx_school_timings_active ON school_timings(is_active);
CREATE INDEX IF NOT EXISTS idx_school_timings_order ON school_timings(day_order); 