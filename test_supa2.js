import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://gfnltslfmarndfvukywc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmbmx0c2xmbWFybmRmdnVreXdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjUyNjYsImV4cCI6MjA5MDQ0MTI2Nn0.0uAnWWiPKSyM0o6HorIaKqJKg06PlaGtzE8u4BeVp3k');

async function test() {
  // First, get a valid student ID
  const { data: students, error: err1 } = await supabase.from('students').select('id').limit(1);
  if (!students || students.length === 0) {
     console.log('No students found', err1);
     return;
  }
  const student_id = students[0].id;

  const testRecord = {
    student_id,
    session_date: '2026-04-20', // a Monday
    session_type: 'Monday',
    is_present: true,
  };

  const { data, error } = await supabase.from('attendance').insert([testRecord]).select();
  console.log('Insert Result:', data);
  console.log('Insert Error:', error);
}

test();
