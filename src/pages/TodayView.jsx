import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Search, UserCheck, CloudOff, Lock, Unlock, Send, Edit3, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { format, isSaturday, isSunday, isMonday, isTuesday, isWednesday, isThursday, isFriday, previousSaturday, previousSunday, nextSunday, previousMonday, previousFriday, startOfWeek, addDays } from 'date-fns';
import { saveOfflineAttendance, cacheStudents, getCachedStudents } from '../lib/offlineDb';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEKEND_DAYS = ['Saturday', 'Sunday'];

function getTodayName() {
  const today = new Date();
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[today.getDay()];
}

function isWeekdayName(name) {
  return WEEKDAYS.includes(name);
}

export default function TodayView() {
  const { isAdmin, assignedGrade, assignedMode, canSeeWeekend, canSeeWeekday } = useAuth();
  const { confirm, alert: showAlert } = useDialog();
  
  const todayName = getTodayName();

  const getCorrectMode = () => {
    if (isWeekdayName(todayName) && canSeeWeekday) return 'weekday';
    if (!isWeekdayName(todayName) && canSeeWeekend) return 'weekend';
    if (canSeeWeekend) return 'weekend';
    if (canSeeWeekday) return 'weekday';
    return 'weekend';
  };
  const getCorrectDay = (m) => {
    if (m === 'weekday') {
      return isWeekdayName(todayName) ? todayName : 'Monday';
    }
    return WEEKEND_DAYS.includes(todayName) ? todayName : 'Sunday';
  };

  const [mode, setMode] = useState('weekend');
  const [sessionDay, setSessionDay] = useState('Sunday');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Professional attendance states
  const [draftLog, setDraftLog] = useState({});
  const [submittedLog, setSubmittedLog] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync mode and grade when auth data changes (critical — runs after auth loads)
  useEffect(() => {
    const correctMode = getCorrectMode();
    setMode(correctMode);
    setSessionDay(getCorrectDay(correctMode));
  }, [canSeeWeekend, canSeeWeekday]);

  useEffect(() => {
    setSelectedGrade(isAdmin ? 'All' : (assignedGrade || 'Grade 7'));
  }, [isAdmin, assignedGrade]);

  const getSessionDate = useCallback((day) => {
    const today = new Date();
    const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
    const todayIndex = today.getDay();

    if (dayIndex === todayIndex) return today;

    // For weekend days
    if (day === 'Saturday') {
      return isSunday(today) ? previousSaturday(today) : previousSaturday(today);
    }
    if (day === 'Sunday') {
      return isSaturday(today) ? nextSunday(today) : (isSunday(today) ? today : previousSunday(today));
    }

    // For weekdays: find this week's instance of that day
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const targetDate = addDays(weekStart, dayIndex - 1); // Mon=0 offset
    // If target is in the future, use the same day (upcoming)
    return targetDate;
  }, []);

  const activeDateObj = getSessionDate(sessionDay);
  const activeDateStr = format(activeDateObj, 'yyyy-MM-dd');
  const displayDateStr = format(activeDateObj, 'EEEE, MMMM do, yyyy');

  const todayOnlyDateStr = format(new Date(), 'yyyy-MM-dd');
  const isPastSession = activeDateStr < todayOnlyDateStr;
  const isFutureSession = activeDateStr > todayOnlyDateStr;
  const isTodaySession = activeDateStr === todayOnlyDateStr;

  // Program type for student filtering
  const programType = mode === 'weekday' ? 'weekday' : 'weekend';

  useEffect(() => {
    const handleSynced = () => loadSessionData();
    window.addEventListener('attendance-synced', handleSynced);
    return () => window.removeEventListener('attendance-synced', handleSynced);
  }, [sessionDay, mode]);

  useEffect(() => {
    loadSessionData();
  }, [sessionDay, mode]);

  async function loadSessionData() {
    try {
      setLoading(true);
      setIsOfflineMode(false);
      setIsEditing(false);

      if (!navigator.onLine) {
        const cachedData = await getCachedStudents();
        const filtered = cachedData.filter(s => (s.program_type || 'weekend') === programType);
        if (filtered.length > 0) {
          setStudents(filtered);
          setDraftLog({});
          setSubmittedLog({});
          setIsSubmitted(false);
          setIsOfflineMode(true);
        } else {
          setStudents([]);
        }
        return;
      }

      // Fetch students filtered by program type
      let studentQuery = supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .eq('enrollment_status', 'Active')
        .eq('program_type', programType)
        .order('first_name', { ascending: true });

      const { data: studentsData, error: studentErr } = await studentQuery;
      if (studentErr) throw studentErr;

      // Fetch existing attendance
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_date', activeDateStr)
        .eq('session_type', sessionDay);

      if (attErr) throw attErr;

      setStudents(studentsData || []);

      if (studentsData && studentsData.length > 0) {
        cacheStudents(studentsData).catch(err => 
          console.warn('Failed to cache students:', err)
        );
      }

      const logMap = {};
      (attData || []).forEach(record => {
        logMap[record.student_id] = record.status || (record.is_present ? 'present' : 'absent');
      });

      // Only mark as "submitted" if at least some of THIS teacher's students have records
      const studentIds = new Set((studentsData || []).map(s => s.id));
      const myRecordCount = Object.keys(logMap).filter(id => studentIds.has(id)).length;

      if (myRecordCount > 0) {
        setSubmittedLog(logMap);
        setDraftLog(logMap);
        setIsSubmitted(true);
      } else {
        setSubmittedLog({});
        setDraftLog({});
        setIsSubmitted(false);
      }

    } catch (err) {
      console.error('Error loading session data:', err.message || err);
      try {
        const cachedData = await getCachedStudents();
        const filtered = cachedData.filter(s => (s.program_type || 'weekend') === programType);
        if (filtered.length > 0) {
          setStudents(filtered);
          setDraftLog({});
          setSubmittedLog({});
          setIsSubmitted(false);
          setIsOfflineMode(true);
        }
      } catch (cacheErr) {
        console.error('Cache fallback failed:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleMark(studentId, status) {
    if (isSubmitted && !isEditing) return;
    setDraftLog(prev => {
      // Toggle off if same status tapped again
      if (prev[studentId] === status) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return { ...prev, [studentId]: status };
    });
  }

  function handleMarkAllPresent() {
    if (isSubmitted && !isEditing) return;
    const nextLog = { ...draftLog };
    filteredStudents.forEach(s => { nextLog[s.id] = 'present'; });
    setDraftLog(nextLog);
  }

  async function handleSubmit() {
    const markedStudents = filteredStudents.filter(s => draftLog[s.id] !== undefined);
    const unmarked = filteredStudents.length - markedStudents.length;
    const presentCount = filteredStudents.filter(s => draftLog[s.id] === 'present').length;
    const absentCount = filteredStudents.filter(s => draftLog[s.id] === 'absent').length;
    const permissionCount = filteredStudents.filter(s => draftLog[s.id] === 'permission').length;

    if (markedStudents.length === 0) {
      await showAlert('Please mark at least one student before submitting.', { title: 'No Records', variant: 'warning' });
      return;
    }

    let message = `${presentCount} present, ${absentCount} absent`;
    if (permissionCount > 0) message += `, ${permissionCount} permission`;
    if (unmarked > 0) message += `. ${unmarked} student${unmarked !== 1 ? 's' : ''} not marked.`;

    const ok = await confirm(message, {
      title: isEditing ? 'Update Attendance' : 'Submit Attendance',
      confirmText: isEditing ? 'Save Changes' : 'Submit',
      variant: 'primary'
    });
    if (!ok) return;

    setSubmitting(true);

    const records = filteredStudents
      .filter(s => draftLog[s.id] !== undefined)
      .map(s => ({
        student_id: s.id,
        session_date: activeDateStr,
        session_type: sessionDay,
        is_present: draftLog[s.id] === 'present',
        status: draftLog[s.id]
      }));

    if (!navigator.onLine) {
      try {
        for (const record of records) {
          await saveOfflineAttendance(record);
        }
        setSubmittedLog({ ...draftLog });
        setIsSubmitted(true);
        setIsEditing(false);
      } catch (err) {
        await showAlert('Failed to save offline: ' + err.message, { title: 'Error', variant: 'danger' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'student_id, session_date, session_type' });

    if (error) {
      console.error('Submit failed:', error);
      await showAlert('Failed to submit: ' + error.message, { title: 'Error', variant: 'danger' });
      setSubmitting(false);
      return;
    }

    setSubmittedLog({ ...draftLog });
    setIsSubmitted(true);
    setIsEditing(false);
    setSubmitting(false);
  }

  async function handleEdit() {
    const ok = await confirm('Unlock this session to make corrections?', {
      title: 'Edit Attendance', confirmText: 'Unlock & Edit', variant: 'warning'
    });
    if (!ok) return;
    setIsEditing(true);
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGrade === 'All' || s.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  const displayLog = (isSubmitted && !isEditing) ? submittedLog : draftLog;
  const isLocked = isSubmitted && !isEditing;

  const totalFiltered = filteredStudents.length;
  const markedCount = filteredStudents.filter(s => draftLog[s.id] !== undefined).length;
  const presentCount = filteredStudents.filter(s => draftLog[s.id] === 'present').length;
  const absentCount = filteredStudents.filter(s => draftLog[s.id] === 'absent').length;
  const permissionCount = filteredStudents.filter(s => draftLog[s.id] === 'permission').length;

  const showBothModes = canSeeWeekend && canSeeWeekday;

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 className="page-title m-0">Attendance</h1>
          {isSubmitted && (
            <div className={`att-status-badge ${isEditing ? 'att-status-badge--editing' : 'att-status-badge--submitted'}`}>
              {isEditing ? <><Unlock size={13} /> Editing</> : <><Lock size={13} /> Submitted</>}
            </div>
          )}
        </div>

        {/* Mode Selector: Weekend / Weekday */}
        {showBothModes && (
          <div className="mode-selector mb-3">
            <button className={`mode-btn ${mode === 'weekend' ? 'active' : ''}`} onClick={() => setMode('weekend')}>
              Weekend
            </button>
            <button className={`mode-btn ${mode === 'weekday' ? 'active' : ''}`} onClick={() => setMode('weekday')}>
              Weekday
            </button>
          </div>
        )}

        {/* Day Picker */}
        <div className="day-picker-scroll">
          {(mode === 'weekend' ? WEEKEND_DAYS : WEEKDAYS).map(day => (
            <button
              key={day}
              className={`day-chip ${sessionDay === day ? 'active' : ''} ${day === todayName ? 'today' : ''}`}
              onClick={() => setSessionDay(day)}
            >
              {day.slice(0, 3)}
              {day === todayName && <span className="day-chip-dot" />}
            </button>
          ))}
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
          <div className="search-container flex-1 bg-white" style={{ marginBottom: 0, width: '100%' }}>
            <Search size={20} className="text-muted" />
            <input type="text" placeholder="Search student..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          
          {isAdmin ? (
            <select className="form-input" style={{ width: 'auto' }} value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              <option value="All">All Grades</option>
              <option value="Grade 7">Grade 7</option><option value="Grade 8">Grade 8</option><option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option><option value="Grade 11">Grade 11</option><option value="Grade 12">Grade 12</option>
            </select>
          ) : (
            <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
              <span className="text-sm font-black text-primary">{selectedGrade}</span>
            </div>
          )}

          {!isLocked && selectedGrade !== 'All' && filteredStudents.length > 0 && (
            <button className="btn-outline flex items-center gap-2 px-4 whitespace-nowrap w-full sm:w-auto" onClick={handleMarkAllPresent}>
              <UserCheck size={18} /> All Present
            </button>
          )}

          {isSubmitted && !isEditing && (
            <button className="btn-outline flex items-center gap-2 px-4 whitespace-nowrap w-full sm:w-auto" onClick={handleEdit} style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--warning)' }}>
              <Edit3 size={16} /> Edit
            </button>
          )}
        </div>

        <div className="student-list mt-4">
          <h2 className="section-title flex items-center justify-between px-2">
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.92rem' }}>{displayDateStr}</span>
              {isTodaySession && <span className="text-xs bg-success text-white px-2 py-1 rounded-full font-semibold">Today</span>}
              {isPastSession && <span className="text-xs bg-warning text-white px-2 py-1 rounded-full font-semibold">Past</span>}
              {isFutureSession && <span className="text-xs bg-primary text-white px-2 py-1 rounded-full font-semibold">Upcoming</span>}
            </div>
            <span className="text-sm font-normal text-muted">{filteredStudents.length}</span>
          </h2>
          
          {loading ? (
            <p className="text-center text-muted mt-8">Loading class roster...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="card text-center text-muted py-8 glass">
              No {programType} students found{selectedGrade !== 'All' ? ` in ${selectedGrade}` : ''}.
            </div>
          ) : (
            filteredStudents.map((student, index) => {
              const status = displayLog[student.id];
              return (
                <div 
                  key={student.id} 
                  className={`student-row card flex justify-between items-center glass transition-colors ${isLocked ? 'att-locked-row' : ''}`}
                  style={{ animationDelay: `${index * 25}ms` }}
                >
                  <div>
                    <p className="font-bold m-0" style={{ fontSize: '1.05rem' }}>{student.first_name} {student.last_name}</p>
                    <p className="text-muted m-0 text-xs mt-1 font-semibold uppercase tracking-wider">{student.grade}</p>
                  </div>
                  <div className="attendance-actions">
                    <button 
                      onClick={() => handleMark(student.id, 'present')} 
                      className={`action-btn present ${status === 'present' ? 'active' : ''}`}
                      disabled={isLocked}
                      title="Present"
                    >
                      <CheckCircle2 size={30} />
                    </button>
                    <button 
                      onClick={() => handleMark(student.id, 'permission')} 
                      className={`action-btn permission ${status === 'permission' ? 'active' : ''}`}
                      disabled={isLocked}
                      title="Permission"
                    >
                      <ShieldAlert size={30} />
                    </button>
                    <button 
                      onClick={() => handleMark(student.id, 'absent')} 
                      className={`action-btn absent ${status === 'absent' ? 'active' : ''}`}
                      disabled={isLocked}
                      title="Absent"
                    >
                      <XCircle size={30} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isLocked && filteredStudents.length > 0 && !loading && (
          <div style={{ height: '100px' }} />
        )}
      </div>

      {/* Sticky Submit Bar */}
      {!isLocked && filteredStudents.length > 0 && !loading && (
        <div className="att-submit-bar">
          <div className="att-submit-info">
            <span className="att-submit-count">
              <span className="text-success font-black">{presentCount}</span>
              {permissionCount > 0 && <><span className="text-muted">/</span><span className="text-warning font-black">{permissionCount}</span></>}
              <span className="text-muted">/</span>
              <span className="text-danger font-black">{absentCount}</span>
              <span className="text-muted text-xs ml-1">of {totalFiltered}</span>
            </span>
            {markedCount < totalFiltered && (
              <span className="att-submit-remaining">{totalFiltered - markedCount} unmarked</span>
            )}
          </div>
          <button className="att-submit-btn" onClick={handleSubmit} disabled={submitting || markedCount === 0}>
            {submitting ? <span className="animate-pulse">Saving...</span> : <><Send size={16} /> {isEditing ? 'Save' : 'Submit'}</>}
          </button>
        </div>
      )}
    </div>
  );
}
