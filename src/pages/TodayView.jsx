import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Search, UserCheck, CloudOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { format, isSaturday, isSunday, previousSaturday, previousSunday, nextSunday } from 'date-fns';
import { saveOfflineAttendance, cacheStudents, getCachedStudents } from '../lib/offlineDb';

export default function TodayView() {
  const { isAdmin, assignedGrade } = useAuth();
  const { confirm, alert: showAlert } = useDialog();
  const [sessionType, setSessionType] = useState('Sunday');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(isAdmin ? 'All' : (assignedGrade || 'Grade 7'));
  const [students, setStudents] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState({});
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Force grade if not admin
  useEffect(() => {
    if (!isAdmin && assignedGrade) {
      setSelectedGrade(assignedGrade);
    }
  }, [isAdmin, assignedGrade]);

  const getSessionDate = useCallback((targetDay) => {
    const today = new Date();
    if (targetDay === 'Saturday') {
      if (isSaturday(today)) return today;
      if (isSunday(today)) return previousSaturday(today);
      return previousSaturday(today);
    } else {
      if (isSunday(today)) return today;
      if (isSaturday(today)) return nextSunday(today);
      return previousSunday(today);
    }
  }, []);

  const activeDateObj = getSessionDate(sessionType);
  const activeDateStr = format(activeDateObj, 'yyyy-MM-dd');
  const displayDateStr = format(activeDateObj, 'MMMM do, yyyy');
  
  const todayOnlyDateStr = format(new Date(), 'yyyy-MM-dd');
  const isPastSession = activeDateStr < todayOnlyDateStr;
  const isFutureSession = activeDateStr > todayOnlyDateStr;

  // Listen for sync completion to reload data
  useEffect(() => {
    const handleSynced = () => {
      console.log('[TodayView] Sync completed, reloading data...');
      loadSessionData();
    };
    window.addEventListener('attendance-synced', handleSynced);
    return () => window.removeEventListener('attendance-synced', handleSynced);
  }, [sessionType]);

  useEffect(() => {
    loadSessionData();
  }, [sessionType]);

  async function loadSessionData() {
    try {
      setLoading(true);
      setIsOfflineMode(false);

      if (!navigator.onLine) {
        const cachedData = await getCachedStudents();
        if (cachedData.length > 0) {
          setStudents(cachedData);
          setAttendanceLog({});
          setIsOfflineMode(true);
        } else {
          setStudents([]);
        }
        return;
      }

      // ONLINE: Fetch students
      const { data: studentsData, error: studentErr } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .eq('enrollment_status', 'Active')
        .order('first_name', { ascending: true });
        
      if (studentErr) {
        console.error('Student fetch error:', studentErr);
        throw studentErr;
      }

      // ONLINE: Fetch attendance for this session
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_date', activeDateStr)
        .eq('session_type', sessionType);

      if (attErr) {
        console.error('Attendance fetch error:', attErr);
        throw attErr;
      }

      setStudents(studentsData || []);

      // Cache students for offline use
      if (studentsData && studentsData.length > 0) {
        cacheStudents(studentsData).catch(err => 
          console.warn('Failed to cache students:', err)
        );
      }

      // Build the attendance map
      const logMap = {};
      (attData || []).forEach(record => {
        logMap[record.student_id] = record.is_present;
      });
      setAttendanceLog(logMap);

    } catch (err) {
      console.error('Error loading session data:', err.message || err);
      // Fallback to cache on network error
      try {
        const cachedData = await getCachedStudents();
        if (cachedData.length > 0) {
          setStudents(cachedData);
          setAttendanceLog({});
          setIsOfflineMode(true);
        }
      } catch (cacheErr) {
        console.error('Cache fallback also failed:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAttendance(studentId, isPresent) {
    // Optimistic UI update
    setAttendanceLog(prev => ({ ...prev, [studentId]: isPresent }));

    const record = {
      student_id: studentId,
      session_date: activeDateStr,
      session_type: sessionType,
      is_present: isPresent
    };

    if (!navigator.onLine) {
      try {
        await saveOfflineAttendance(record);
      } catch (err) {
        console.error('Failed to save offline:', err);
      }
      return;
    }

    // ONLINE: Upsert to Supabase with PROPER error checking
    const { error } = await supabase
      .from('attendance')
      .upsert(record, { onConflict: 'student_id, session_date, session_type' });

    if (error) {
      console.error('Supabase upsert failed:', error);
      // Revert the optimistic update
      setAttendanceLog(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      // Try saving offline as fallback
      try {
        await saveOfflineAttendance(record);
        setAttendanceLog(prev => ({ ...prev, [studentId]: isPresent }));
      } catch (offlineErr) {
        console.error('Offline fallback also failed:', offlineErr);
      }
    }
  }

  async function handleMarkAllPresent() {
    const ok = await confirm(
      `Mark all ${filteredStudents.length} students in ${selectedGrade} as present?`,
      { title: 'Bulk Attendance', confirmText: 'Mark All Present', variant: 'primary' }
    );
    if (!ok) return;
    
    const updates = filteredStudents.map(s => ({
      student_id: s.id,
      session_date: activeDateStr,
      session_type: sessionType,
      is_present: true
    }));

    if (!navigator.onLine) {
      try {
        for (const record of updates) {
          await saveOfflineAttendance(record);
        }
        const nextLog = { ...attendanceLog };
        filteredStudents.forEach(s => nextLog[s.id] = true);
        setAttendanceLog(nextLog);
      } catch (err) {
        await showAlert('Failed to save offline: ' + err.message, { title: 'Error', variant: 'danger' });
      }
      return;
    }

    // ONLINE with proper error checking
    const { error } = await supabase
      .from('attendance')
      .upsert(updates, { onConflict: 'student_id, session_date, session_type' });
    
    if (error) {
      await showAlert('Bulk mark failed: ' + error.message, { title: 'Error', variant: 'danger' });
      return;
    }
    
    const nextLog = { ...attendanceLog };
    filteredStudents.forEach(s => nextLog[s.id] = true);
    setAttendanceLog(nextLog);
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGrade === 'All' || s.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <h1 className="page-title">Attendance Tracking</h1>
        <div className="session-toggle">
          <button className={`toggle-btn ${sessionType === 'Saturday' ? 'active' : ''}`} onClick={() => setSessionType('Saturday')}>Saturday</button>
          <button className={`toggle-btn ${sessionType === 'Sunday' ? 'active' : ''}`} onClick={() => setSessionType('Sunday')}>Sunday</button>
        </div>
      </div>

      <div className="content">
        {isOfflineMode && (
          <div className="offline-mode-badge">
            <CloudOff size={14} />
            <span>Offline mode — using cached roster</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6" style={{ alignItems: 'center' }}>
          <div className="search-container flex-1 bg-white" style={{ marginBottom: 0, border: '1px solid rgba(0,0,0,0.05)', width: '100%' }}>
            <Search size={20} className="text-muted" />
            <input type="text" placeholder="Search student..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          
          {isAdmin ? (
            <select className="form-input" style={{ width: 'auto', border: '1px solid rgba(0,0,0,0.05)' }} value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              <option value="All">All Grades</option>
              <option value="Grade 7">Grade 7</option><option value="Grade 8">Grade 8</option><option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option><option value="Grade 11">Grade 11</option><option value="Grade 12">Grade 12</option>
            </select>
          ) : (
            <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
              <span className="text-sm font-black text-primary">{selectedGrade}</span>
            </div>
          )}

          {selectedGrade !== 'All' && filteredStudents.length > 0 && (
            <button className="btn-primary flex items-center gap-2 px-4 whitespace-nowrap w-full sm:w-auto" onClick={handleMarkAllPresent}>
              <UserCheck size={18} /> Mark All Present
            </button>
          )}
        </div>

        <div className="student-list mt-8">
          <h2 className="section-title flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <span>{displayDateStr}</span>
              {isPastSession && <span className="text-xs bg-warning text-white px-2 py-1 rounded-full font-semibold">Previous Weekend</span>}
              {!isPastSession && !isFutureSession && <span className="text-xs bg-success text-white px-2 py-1 rounded-full font-semibold">Active Session</span>}
              {isFutureSession && <span className="text-xs bg-primary text-white px-2 py-1 rounded-full font-semibold">Upcoming</span>}
            </div>
            <span className="text-sm font-normal text-muted">{filteredStudents.length} Students listed</span>
          </h2>
          
          {loading ? (
            <p className="text-center text-muted mt-8">Loading class roster...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="card text-center text-muted py-8 glass">No matching students found in the directory.</div>
          ) : (
            filteredStudents.map((student, index) => {
              const presentState = attendanceLog[student.id];
              return (
                <div 
                  key={student.id} 
                  className="student-row card flex justify-between items-center glass hover:bg-white transition-colors"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div>
                    <p className="font-bold m-0" style={{ fontSize: '1.05rem' }}>{student.first_name} {student.last_name}</p>
                    <p className="text-muted m-0 text-xs mt-1 font-semibold uppercase tracking-wider">{student.grade}</p>
                  </div>
                  <div className="attendance-actions">
                    <button onClick={() => handleMarkAttendance(student.id, true)} className={`action-btn present ${presentState === true ? 'active' : ''}`}><CheckCircle2 size={32} /></button>
                    <button onClick={() => handleMarkAttendance(student.id, false)} className={`action-btn absent ${presentState === false ? 'active' : ''}`}><XCircle size={32} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
