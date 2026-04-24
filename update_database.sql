-- 1. Remove the old session_type constraint if it exists (which blocks Weekday attendance)
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.attendance'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%session_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.attendance DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 2. Add the 'status' column to attendance if it doesn't exist
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status TEXT;

-- 3. Add the 'program_type' column to students if it doesn't exist (default to weekend)
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'weekend';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'weekend';

-- 4. Fix Dashboard View to support Weekday analysis
CREATE OR REPLACE VIEW public.student_risk_dashboard AS
WITH recent_sessions AS (
    -- Gets the last 6 sessions marked globally in the system
    SELECT DISTINCT session_date, session_type 
    FROM public.attendance 
    ORDER BY session_date DESC 
    LIMIT 6
),
student_misses AS (
    -- Counts how many of those last 6 sessions the student was marked absent
    SELECT 
        a.student_id,
        COUNT(*) as missed_sessions
    FROM public.attendance a
    JOIN recent_sessions rs ON a.session_date = rs.session_date AND a.session_type = rs.session_type
    WHERE a.is_present = false OR a.status = 'absent'
    GROUP BY a.student_id
)
SELECT 
    s.id,
    s.first_name,
    s.last_name,
    s.grade,
    s.parent_phone,
    COALESCE(sm.missed_sessions, 0) * 15 AS risk_score, -- 15 points per miss
    CASE 
        WHEN COALESCE(sm.missed_sessions, 0) = 0 THEN 'Active'
        WHEN COALESCE(sm.missed_sessions, 0) <= 2 THEN 'Watching'
        ELSE 'Action Required'
    END as status
FROM public.students s
LEFT JOIN student_misses sm ON s.id = sm.student_id
WHERE s.is_active = true AND s.enrollment_status = 'Active';
