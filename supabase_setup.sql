-- 1. Create Students Table
CREATE TABLE public.students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    enrollment_status TEXT DEFAULT 'Pending'::text NOT NULL, -- "Pending" or "Active"
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- 2. Create Attendance Table
CREATE TABLE public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    session_date DATE NOT NULL,
    session_type TEXT NOT NULL check (session_type in ('Saturday', 'Sunday')),
    is_present BOOLEAN NOT NULL,
    notes TEXT,
    UNIQUE(student_id, session_date, session_type) -- Prevent double logging for same day/type
);

-- 3. Create Follow Ups Table
CREATE TABLE public.follow_ups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    call_date DATE DEFAULT CURRENT_DATE NOT NULL,
    summary TEXT,
    resolved BOOLEAN DEFAULT false NOT NULL
);

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- For now, allow anonymous inserts to Students (for the parent registration link)
CREATE POLICY "Allow anon insert (Registration Link)" ON public.students FOR INSERT TO anon WITH CHECK (true);

-- Allow full access to anon/authenticated for now (We will lock this down to 'authenticated' once Admin Login is built)
CREATE POLICY "Allow public read/write access during setup" ON public.students FOR ALL TO public USING (true);
CREATE POLICY "Allow public read/write access during setup" ON public.attendance FOR ALL TO public USING (true);
CREATE POLICY "Allow public read/write access during setup" ON public.follow_ups FOR ALL TO public USING (true);


-- 6. Create the Pro Dashboard View (Weighted Risk Score Calculation)
CREATE OR REPLACE VIEW public.student_risk_dashboard AS
WITH recent_sessions AS (
    -- Gets the last 6 sessions (approx 3 weekends) marked globally in the system
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
    WHERE a.is_present = false
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
