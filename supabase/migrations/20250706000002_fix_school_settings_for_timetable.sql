-- Fix school settings for timetable compatibility
-- Up migration

-- Add periods column to school_timings table
ALTER TABLE school_timings 
ADD COLUMN IF NOT EXISTS periods JSONB DEFAULT '[]';

-- Update existing records to have empty periods array
UPDATE school_timings 
SET periods = '[]' 
WHERE periods IS NULL;

-- Add periods column to classes table for class-specific schedules
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '{}';

-- Update existing classes to have empty schedule
UPDATE classes 
SET schedule = '{}' 
WHERE schedule IS NULL;

-- Create index for better performance on schedule queries
CREATE INDEX IF NOT EXISTS idx_classes_schedule ON classes USING GIN (schedule);

-- Add function to validate schedule format
CREATE OR REPLACE FUNCTION validate_schedule_format(schedule_data JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  day_record RECORD;
BEGIN
  -- Check if schedule is an object
  IF jsonb_typeof(schedule_data) != 'object' THEN
    RETURN FALSE;
  END IF;
  
  -- Check each day has the correct structure
  FOR day_record IN SELECT * FROM jsonb_each(schedule_data)
  LOOP
    -- Check if day value is an object
    IF jsonb_typeof(day_record.value) != 'object' THEN
      RETURN FALSE;
    END IF;
    
    -- Check required fields: enabled, startTime, endTime
    IF NOT (day_record.value ? 'enabled' AND day_record.value ? 'startTime' AND day_record.value ? 'endTime') THEN
      RETURN FALSE;
    END IF;
    
    -- Check enabled is boolean
    IF jsonb_typeof(day_record.value->'enabled') != 'boolean' THEN
      RETURN FALSE;
    END IF;
    
    -- Check startTime and endTime are strings
    IF jsonb_typeof(day_record.value->'startTime') != 'string' OR jsonb_typeof(day_record.value->'endTime') != 'string' THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to ensure valid schedule format
ALTER TABLE classes 
ADD CONSTRAINT check_schedule_format 
CHECK (validate_schedule_format(schedule));

-- Add function to validate periods format
CREATE OR REPLACE FUNCTION validate_periods_format(periods_data JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  i INTEGER;
  period JSONB;
BEGIN
  -- Check if periods is an array
  IF jsonb_typeof(periods_data) != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Check each period has required fields
  FOR i IN 0..jsonb_array_length(periods_data) - 1
  LOOP
    period := periods_data->i;
    
    -- Check required fields: name, startTime, endTime, type
    IF NOT (period ? 'name' AND period ? 'startTime' AND period ? 'endTime' AND period ? 'type') THEN
      RETURN FALSE;
    END IF;
    
    -- Check type is valid
    IF NOT (period->>'type' IN ('class', 'break', 'lunch', 'recess', 'assembly')) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to ensure valid periods format
ALTER TABLE school_timings 
ADD CONSTRAINT check_periods_format 
CHECK (validate_periods_format(periods));

-- Create view for timetable data
CREATE OR REPLACE VIEW timetable_view AS
SELECT 
  c.id as class_id,
  c.name as class_name,
  c.subject,
  c.room_number,
  c.schedule,
  u.first_name || ' ' || u.last_name as teacher_name,
  st.day,
  st.start_time as school_start,
  st.end_time as school_end,
  st.breaks,
  st.periods
FROM classes c
JOIN users u ON c.teacher_id = u.id
CROSS JOIN school_timings st
WHERE c.is_active = true AND st.is_active = true;

-- Grant access to the view for authenticated users
GRANT SELECT ON timetable_view TO authenticated;

-- Create function to get classes for specific day and time
CREATE OR REPLACE FUNCTION get_classes_for_timeslot(
  target_day VARCHAR(20),
  target_time TIME
)
RETURNS TABLE (
  class_id UUID,
  class_name VARCHAR(255),
  subject VARCHAR(255),
  teacher_name TEXT,
  room_number VARCHAR(50),
  start_time TIME,
  end_time TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.subject,
    u.first_name || ' ' || u.last_name,
    c.room_number,
    (c.schedule->target_day->>'startTime')::TIME,
    (c.schedule->target_day->>'endTime')::TIME
  FROM classes c
  JOIN users u ON c.teacher_id = u.id
  WHERE c.is_active = true
    AND c.schedule ? target_day
    AND (c.schedule->target_day->>'enabled')::BOOLEAN = true
    AND target_time >= (c.schedule->target_day->>'startTime')::TIME
    AND target_time < (c.schedule->target_day->>'endTime')::TIME;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION get_classes_for_timeslot TO authenticated; 