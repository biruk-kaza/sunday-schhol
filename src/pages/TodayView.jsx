import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Search, UserCheck, CloudOff, Lock, Unlock, Send, Edit3 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Professional attendance states
  const [draftLog, setDraftLog] = useState({});       // Local-only marks (not saved)
  const [submittedLog, setSubmittedLog] = useState({}); // Saved marks from DB
  const [isSubmitted, setIsSubmitted] = useState(false); // Whether this session was already submitted
  const [isEditing, setIsEditing] = useState(false);     // Edit mode after submission
  const [submitting, setSubmitting] = useState(false);

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
    const handleSynced = () => loadSessionData();
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
      setIsEditing(false);

      if (!navigator.onLine) {
        const cachedData = await getCachedStudents();
        if (cachedData.length > 0) {
          setStudents(cachedData);
          setDraftLog({});
          setSubmittedLog({});
          setIsSubmitted(false);
          setIsOfflineMode(true);
        } else {
          setStudents([]);
        }
        return;
      }

      // Fetch students
      const { data: studentsData, error: studentErr } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .eq('enrollment_status', 'Active')
        .order('first_name', { ascending: true });
        
      if (studentErr) throw studentErr;

      // Fetch existing attendance for this session
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_date', activeDateStr)
        .eq('session_type', sessionType);

      if (attErr) throw attErr;

      setStudents(studentsData || []);

      // Cache students for offline
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

      // If there are existing records, this session was already submitted
      if (Object.keys(logMap).length > 0) {
        setSubmittedLog(logMap);
        setDraftLog(logMap); // Pre-fill draft with submitted data for editing
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
        if (cachedData.length > 0) {
          setStudents(cachedData);
          setDraftLog({});
          setSubmittedLog({});
          setIsSubmitted(false);
          setIsOfflineMode(true);
        }
      } catch (cacheErr) {
        console.error('Cache fallback also failed:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }

  // Mark a student in draft (local only — not saved yet)
  function handleMark(studentId, isPresent) {
    if (isSubmitted && !isEditing) return; // Locked
    setDraftLog(prev => ({ ...prev, [studentId]: isPresent }));
  }

  // Mark all visible students as present in draft
  function handleMarkAllPresent() {
    if (isSubmitted && !isEditing) return;
    const nextLog = { ...draftLog };
    filteredStudents.forEach(s => { nextLog[s.id] = true; });
    setDraftLog(nextLog);
  }

  // Submit all draft marks to Supabase
  async function handleSubmit() {
    const markedStudents = filteredStudents.filter(s => draftLog[s.id] !== undefined);
    const unmarked = filteredStudents.length - markedStudents.length;
    const presentCount = filteredStudents.filter(s => draftLog[s.id] === true).length;
    const absentCount = filteredStudents.filter(s => draftLog[s.id] === false).length;

    if (markedStudents.length === 0) {
      await showAlert('Please mark at least one student before submitting.', { title: 'No Records', variant: 'warning' });
      return;
    }

    let message = `${presentCount} present, ${absentCount} absent`;
    if (unmarked > 0) {
      message += `. ${unmarked} student${unmarked !== 1 ? 's' : ''} not marked — they will be skipped.`;
    }

    const ok = await confirm(
      message,
      { 
        title: isEditing ? 'Update Attendance' : 'Submit Attendance', 
        confirmText: isEditing ? 'Save Changes' : 'Submit', 
        variant: 'primary' 
      }
    );
    if (!ok) return;

    setSubmitting(true);

    // Build records only for marked students
    const records = filteredStudents
      .filter(s => draftLog[s.id] !== undefined)
      .map(s => ({
        student_id: s.id,
        session_date: activeDateStr,
        session_type: sessionType,
        is_present: draftLog[s.id]
      }));

    if (!navigator.onLine) {
      // Offline: queue all records
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

    // Online: upsert all records at once
    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'student_id, session_date, session_type' });

    if (error) {
      console.error('Submit failed:', error);
      await showAlert('Failed to submit attendance: ' + error.message, { title: 'Error', variant: 'danger' });
      setSubmitting(false);
      return;
    }

    setSubmittedLog({ ...draftLog });
    setIsSubmitted(true);
    setIsEditing(false);
    setSubmitting(false);
  }

  // Enter edit mode
  async function handleEdit() {
    const ok = await confirm(
      'Unlock this session to make corrections?',
      { title: 'Edit Attendance', confirmText: 'Unlock & Edit', variant: 'warning' }
    );
    if (!ok) return;
    setIsEditing(true);
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGrade === 'All' || s.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  // The active log to display (draft when marking, submitted when locked)
  const displayLog = (isSubmitted && !isEditing) ? submittedLog : draftLog;
  const isLocked = isSubmitted && !isEditing;

  // Stats for the submit bar
  const totalFiltered = filteredStudents.length;
  const markedCount = filteredStudents.filter(s => draftLog[s.id] !== undefined).length;
  const presentCount = filteredStudents.filter(s => draftLog[s.id] === true).length;

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 className="page-title m-0">Attendance Tracking</h1>
          {isSubmitted && (
            <div className={`att-status-badge ${isEditing ? 'att-status-badge--editing' : 'att-status-badge--submitted'}`}>
              {isEditing ? (
                <><Unlock size={13} /> Editing</>
              ) : (
                <><Lock size={13} /> Submitted</>
              )}
            </div>
          )}
        </div>
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
              <span>{displayDateStr}</span>
              {isPastSession && <span className="text-xs bg-warning text-white px-2 py-1 rounded-full font-semibold">Previous Weekend</span>}
              {!isPastSession && !isFutureSession && <span className="text-xs bg-success text-white px-2 py-1 rounded-full font-semibold">Active Session</span>}
              {isFutureSession && <span className="text-xs bg-primary text-white px-2 py-1 rounded-full font-semibold">Upcoming</span>}
            </div>
            <span className="text-sm font-normal text-muted">{filteredStudents.length} Students</span>
          </h2>
          
          {loading ? (
            <p className="text-center text-muted mt-8">Loading class roster...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="card text-center text-muted py-8 glass">No matching students found in the directory.</div>
          ) : (
            filteredStudents.map((student, index) => {
              const presentState = displayLog[student.id];
              return (
                <div 
                  key={student.id} 
                  className={`student-row card flex justify-between items-center glass transition-colors ${isLocked ? 'att-locked-row' : ''}`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div>
                    <p className="font-bold m-0" style={{ fontSize: '1.05rem' }}>{student.first_name} {student.last_name}</p>
                    <p className="text-muted m-0 text-xs mt-1 font-semibold uppercase tracking-wider">{student.grade}</p>
                  </div>
                  <div className="attendance-actions">
                    <button 
                      onClick={() => handleMark(student.id, true)} 
                      className={`action-btn present ${presentState === true ? 'active' : ''}`}
                      disabled={isLocked}
                    >
                      <CheckCircle2 size={32} />
                    </button>
                    <button 
                      onClick={() => handleMark(student.id, false)} 
                      className={`action-btn absent ${presentState === false ? 'active' : ''}`}
                      disabled={isLocked}
                    >
                      <XCircle size={32} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Spacer for submit bar */}
        {!isLocked && filteredStudents.length > 0 && !loading && (
          <div style={{ height: '90px' }} />
        )}
      </div>

      {/* Sticky Submit Bar */}
      {!isLocked && filteredStudents.length > 0 && !loading && (
        <div className="att-submit-bar">
          <div className="att-submit-info">
            <span className="att-submit-count">
              <span className="text-success font-black">{presentCount}</span>
              <span className="text-muted">/</span>
              <span>{totalFiltered}</span>
              <span className="text-muted text-xs ml-1">present</span>
            </span>
            {markedCount < totalFiltered && (
              <span className="att-submit-remaining">
                {totalFiltered - markedCount} unmarked
              </span>
            )}
          </div>
          <button 
            className="att-submit-btn" 
            onClick={handleSubmit}
            disabled={submitting || markedCount === 0}
          >
            {submitting ? (
              <span className="animate-pulse">Saving...</span>
            ) : (
              <><Send size={16} /> {isEditing ? 'Save Changes' : 'Submit Attendance'}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
