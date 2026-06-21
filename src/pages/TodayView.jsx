import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Search, UserCheck, CloudOff, Lock, Unlock, Send, Edit3, ShieldAlert, Music } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { format, isSaturday, isSunday, previousSaturday, previousSunday, nextSunday, startOfWeek, addDays } from 'date-fns';
import { saveOfflineAttendance, cacheStudents, getCachedStudents } from '../lib/offlineDb';
import { GRADE_CLASSES, MEZMUR_CLASSES, isMezmurClass, studentName } from '../lib/classes';

// ── Day Sets ──────────────────────────────────────────────────────────────────
const WEEKDAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEKEND_DAYS = ['Saturday', 'Sunday'];
const ALL_DAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getTodayName() {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[new Date().getDay()];
}
function isWeekdayName(name) { return WEEKDAYS.includes(name); }

// ── Component ─────────────────────────────────────────────────────────────────
export default function TodayView() {
  const { isAdmin, assignedGrade, canSeeWeekend, canSeeWeekday } = useAuth();
  const { confirm, alert: showAlert } = useDialog();
  const { t } = useLanguage();

  const todayName = getTodayName();

  // Determine the initial mode based on logged-in user's profile
  const getInitialMode = () => {
    if (assignedGrade && isMezmurClass(assignedGrade)) return 'mezmur';
    if (isWeekdayName(todayName) && canSeeWeekday) return 'weekday';
    if (!isWeekdayName(todayName) && canSeeWeekend) return 'weekend';
    if (canSeeWeekend) return 'weekend';
    if (canSeeWeekday) return 'weekday';
    return 'weekend';
  };

  const getInitialDay = (m) => {
    if (m === 'mezmur')  return todayName;
    if (m === 'weekday') return isWeekdayName(todayName) ? todayName : 'Monday';
    return WEEKEND_DAYS.includes(todayName) ? todayName : 'Sunday';
  };

  // ── State ───────────────────────────────────────────────────────────────────
  // mode: 'weekend' | 'weekday' | 'mezmur'
  const [mode, setMode]               = useState('weekend');
  const [sessionDay, setSessionDay]   = useState('Sunday');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [students, setStudents]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const [draftLog, setDraftLog]       = useState({});
  const [submittedLog, setSubmittedLog] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  // ── Auth-driven mode init ────────────────────────────────────────────────────
  useEffect(() => {
    const m = getInitialMode();
    setMode(m);
    setSessionDay(getInitialDay(m));
    // Set the default grade for Mezmur mode
    if (m === 'mezmur') {
      setSelectedGrade(assignedGrade && isMezmurClass(assignedGrade)
        ? assignedGrade
        : MEZMUR_CLASSES[0]);
    } else {
      setSelectedGrade(isAdmin ? 'All' : (assignedGrade || 'Grade 7'));
    }
  }, [canSeeWeekend, canSeeWeekday, assignedGrade, isAdmin]);

  // ── When admin switches mode tabs ────────────────────────────────────────────
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setSessionDay(getInitialDay(newMode));
    setSearchQuery('');
    // Reset grade selection sensibly
    if (newMode === 'mezmur') {
      setSelectedGrade(MEZMUR_CLASSES[0]);
    } else {
      setSelectedGrade('All');
    }
  };

  // ── Session date resolution ──────────────────────────────────────────────────
  const getSessionDate = useCallback((day) => {
    const today    = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = dayNames.indexOf(day);
    const todayIdx = today.getDay();

    if (dayIndex === todayIdx) return today;

    if (day === 'Saturday') return previousSaturday(today);
    if (day === 'Sunday') {
      return isSaturday(today) ? nextSunday(today)
           : isSunday(today)   ? today
           : previousSunday(today);
    }

    // Weekday: find this week's occurrence
    const weekStart  = startOfWeek(today, { weekStartsOn: 1 }); // Mon
    return addDays(weekStart, dayIndex - 1); // Mon offset
  }, []);

  const activeDateObj  = getSessionDate(sessionDay);
  const activeDateStr  = format(activeDateObj, 'yyyy-MM-dd');
  const displayDateStr = format(activeDateObj, 'EEEE, MMMM do, yyyy');

  const todayOnlyDateStr = format(new Date(), 'yyyy-MM-dd');
  const isPastSession    = activeDateStr < todayOnlyDateStr;
  const isFutureSession  = activeDateStr > todayOnlyDateStr;
  const isTodaySession   = activeDateStr === todayOnlyDateStr;

  // ── What days to show in the picker ─────────────────────────────────────────
  const daysToShow = mode === 'mezmur'  ? ALL_DAYS
                   : mode === 'weekday' ? WEEKDAYS
                   : WEEKEND_DAYS;

  // ── Program type for regular grade fetch ─────────────────────────────────────
  const programType = mode === 'weekday' ? 'weekday' : 'weekend';

  // ── Load on day / mode / grade change ────────────────────────────────────────
  useEffect(() => {
    const handleSynced = () => loadSessionData();
    window.addEventListener('attendance-synced', handleSynced);
    return () => window.removeEventListener('attendance-synced', handleSynced);
  }, [sessionDay, mode, selectedGrade]);

  useEffect(() => {
    loadSessionData();
  }, [sessionDay, mode, selectedGrade]);

  // ── Data loader ──────────────────────────────────────────────────────────────
  async function loadSessionData() {
    try {
      setLoading(true);
      setIsOfflineMode(false);
      setIsEditing(false);

      // ── OFFLINE ────────────────────────────────────────────────────────────
      if (!navigator.onLine) {
        const cached = await getCachedStudents();
        let filtered;
        if (mode === 'mezmur') {
          filtered = cached.filter(s => selectedGrade === 'All Mezmur'
            ? isMezmurClass(s.grade)
            : s.grade === selectedGrade);
        } else {
          filtered = cached.filter(s => (s.program_type || 'weekend') === programType);
        }
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

      // ── ONLINE — fetch students ────────────────────────────────────────────
      let q = supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .eq('enrollment_status', 'Active')
        .order('first_name', { ascending: true });

      if (mode === 'mezmur') {
        // Mezmur mode: filter by specific family group OR all Mezmur groups
        if (selectedGrade && selectedGrade !== 'All Mezmur') {
          q = q.eq('grade', selectedGrade);
        } else {
          q = q.in('grade', MEZMUR_CLASSES);
        }
      } else {
        // Regular grade mode
        q = q.eq('program_type', programType);
      }

      const { data: studentsData, error: studentErr } = await q;
      if (studentErr) throw studentErr;

      // Fetch existing attendance for this session
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_date', activeDateStr)
        .eq('session_type', sessionDay);
      if (attErr) throw attErr;

      setStudents(studentsData || []);

      // Cache roster for offline use
      if (studentsData?.length > 0) {
        cacheStudents(studentsData).catch(err =>
          console.warn('Cache failed:', err));
      }

      // Build attendance log map
      const logMap = {};
      (attData || []).forEach(r => {
        logMap[r.student_id] = r.status || (r.is_present ? 'present' : 'absent');
      });

      const studentIds   = new Set((studentsData || []).map(s => s.id));
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
      console.error('loadSessionData error:', err.message || err);
      try {
        const cached = await getCachedStudents();
        const filtered = mode === 'mezmur'
          ? cached.filter(s => s.grade === selectedGrade)
          : cached.filter(s => (s.program_type || 'weekend') === programType);
        if (filtered.length > 0) {
          setStudents(filtered);
          setDraftLog({});
          setSubmittedLog({});
          setIsSubmitted(false);
          setIsOfflineMode(true);
        }
      } catch (e) {
        console.error('Cache fallback failed:', e);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Attendance marking ───────────────────────────────────────────────────────
  function handleMark(studentId, status) {
    if (isSubmitted && !isEditing) return;
    setDraftLog(prev => {
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
    const markedStudents  = filteredStudents.filter(s => draftLog[s.id] !== undefined);
    const unmarked        = filteredStudents.length - markedStudents.length;
    const presentCount    = filteredStudents.filter(s => draftLog[s.id] === 'present').length;
    const absentCount     = filteredStudents.filter(s => draftLog[s.id] === 'absent').length;
    const permissionCount = filteredStudents.filter(s => draftLog[s.id] === 'permission').length;

    if (markedStudents.length === 0) {
      await showAlert(t('att.noStudents'), { title: 'No Records', variant: 'warning' });
      return;
    }

    let message = `${presentCount} ${t('att.present').toLowerCase()}, ${absentCount} ${t('att.absent').toLowerCase()}`;
    if (permissionCount > 0) message += `, ${permissionCount} ${t('att.permission').toLowerCase()}`;
    if (unmarked > 0) message += `. ${unmarked} ${t('att.unmarked')}.`;

    const ok = await confirm(message, {
      title:       isEditing ? t('btn.edit') : t('btn.submit'),
      confirmText: isEditing ? t('btn.save') : t('btn.submit'),
      variant: 'primary'
    });
    if (!ok) return;

    setSubmitting(true);

    const records = filteredStudents
      .filter(s => draftLog[s.id] !== undefined)
      .map(s => ({
        student_id:   s.id,
        session_date: activeDateStr,
        session_type: sessionDay,
        is_present:   draftLog[s.id] === 'present',
        status:       draftLog[s.id]
      }));

    // ── Offline: queue for later sync ──────────────────────────────────────
    if (!navigator.onLine) {
      try {
        for (const record of records) await saveOfflineAttendance(record);
        setSubmittedLog({ ...draftLog });
        setIsSubmitted(true);
        setIsEditing(false);
      } catch (err) {
        await showAlert('Failed to save offline: ' + err.message, { title: 'Error', variant: 'danger' });
      } finally { setSubmitting(false); }
      return;
    }

    // ── Online: direct upsert ──────────────────────────────────────────────
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

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filteredStudents = students.filter(s => {
    const matchesSearch = studentName(s).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade  = mode === 'mezmur'
      ? (selectedGrade === 'All Mezmur' || s.grade === selectedGrade)
      : (selectedGrade === 'All' || s.grade === selectedGrade);
    return matchesSearch && matchesGrade;
  });

  const displayLog      = (isSubmitted && !isEditing) ? submittedLog : draftLog;
  const isLocked        = isSubmitted && !isEditing;
  const totalFiltered   = filteredStudents.length;
  const markedCount     = filteredStudents.filter(s => draftLog[s.id] !== undefined).length;
  const presentCount    = filteredStudents.filter(s => draftLog[s.id] === 'present').length;
  const absentCount     = filteredStudents.filter(s => draftLog[s.id] === 'absent').length;
  const permissionCount = filteredStudents.filter(s => draftLog[s.id] === 'permission').length;

  // Can admin see the Mezmur tab?
  const showBothModes  = canSeeWeekend && canSeeWeekday;
  const isMezmurMode   = mode === 'mezmur';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <div className="header-glass glass">

        {/* Title + submitted badge */}
        <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 className="page-title m-0">{t('att.title')}</h1>
          {isSubmitted && (
            <div className={`att-status-badge ${isEditing ? 'att-status-badge--editing' : 'att-status-badge--submitted'}`}>
              {isEditing ? <><Unlock size={13} /> {t('att.editing')}</> : <><Lock size={13} /> {t('att.submitted')}</>}
            </div>
          )}
        </div>

        {/* ── Mode Selector ───────────────────────────────────────────────── */}
        {isAdmin && showBothModes && (
          <div className="mode-selector mb-3">
            <button
              className={`mode-btn ${mode === 'weekend' ? 'active' : ''}`}
              onClick={() => handleModeChange('weekend')}
            >
              {t('att.weekend')}
            </button>
            <button
              className={`mode-btn ${mode === 'weekday' ? 'active' : ''}`}
              onClick={() => handleModeChange('weekday')}
            >
              {t('att.weekday')}
            </button>
            <button
              className={`mode-btn ${mode === 'mezmur' ? 'active' : ''}`}
              onClick={() => handleModeChange('mezmur')}
              style={mode === 'mezmur' ? {
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                color: '#fff', border: 'none'
              } : {}}
            >
              🎵 Mezmur
            </button>
          </div>
        )}

        {/* Mezmur badge for non-admin Mezmur teachers */}
        {!isAdmin && isMezmurMode && (
          <div className="mode-selector mb-3">
            <button
              className="mode-btn active"
              style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', color:'#fff', border:'none', cursor:'default' }}
            >
              🎵 Mezmur — All 7 Days
            </button>
          </div>
        )}

        {/* ── Day Picker ──────────────────────────────────────────────────── */}
        <div className="day-picker-scroll">
          {daysToShow.map(day => (
            <button
              key={day}
              className={`day-chip ${sessionDay === day ? 'active' : ''} ${day === todayName ? 'today' : ''}`}
              onClick={() => setSessionDay(day)}
            >
              {t(`day.${day.toLowerCase()}`).slice(0, 3)}
              {day === todayName && <span className="day-chip-dot" />}
            </button>
          ))}
        </div>
      </div>

      <div className="content">
        {isOfflineMode && (
          <div className="offline-mode-badge">
            <CloudOff size={14} />
            <span>{t('att.offlineMode')}</span>
          </div>
        )}

        {/* ── Filters Row ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6" style={{ alignItems: 'center' }}>
          <div className="search-container flex-1 bg-white" style={{ marginBottom: 0, width: '100%' }}>
            <Search size={20} className="text-muted" />
            <input
              type="text"
              placeholder={t('att.search')}
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Grade / Family Group selector */}
          {isAdmin && isMezmurMode ? (
            // Mezmur mode: show Mezmur family groups only
            <select
              className="form-input"
              style={{ width: 'auto' }}
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            >
              <option value="All Mezmur">All Mezmur Groups</option>
              {MEZMUR_CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          ) : isAdmin ? (
            // Regular mode: show grades only
            <select
              className="form-input"
              style={{ width: 'auto' }}
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            >
              <option value="All">{t('att.allGrades')}</option>
              {GRADE_CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          ) : (
            // Teacher: show their fixed assignment
            <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
              <span className="text-sm font-black text-primary">{selectedGrade}</span>
            </div>
          )}

          {!isLocked && selectedGrade !== 'All' && selectedGrade !== 'All Mezmur' && filteredStudents.length > 0 && (
            <button
              className="btn-outline flex items-center gap-2 px-4 whitespace-nowrap w-full sm:w-auto"
              onClick={handleMarkAllPresent}
            >
              <UserCheck size={18} /> {t('att.allPresent')}
            </button>
          )}

          {isSubmitted && !isEditing && (
            <button
              className="btn-outline flex items-center gap-2 px-4 whitespace-nowrap w-full sm:w-auto"
              onClick={handleEdit}
              style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--warning)' }}
            >
              <Edit3 size={16} /> {t('btn.edit')}
            </button>
          )}
        </div>

        {/* ── Student List ─────────────────────────────────────────────────── */}
        <div className="student-list mt-4">
          <h2 className="section-title flex items-center justify-between px-2">
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.92rem' }}>{displayDateStr}</span>
              {isTodaySession  && <span className="text-xs bg-success text-white px-2 py-1 rounded-full font-semibold">{t('att.today')}</span>}
              {isPastSession   && <span className="text-xs bg-warning text-white px-2 py-1 rounded-full font-semibold">{t('att.past')}</span>}
              {isFutureSession && <span className="text-xs bg-primary text-white px-2 py-1 rounded-full font-semibold">{t('att.upcoming')}</span>}
            </div>
            <span className="text-sm font-normal text-muted">{filteredStudents.length}</span>
          </h2>

          {loading ? (
            <p className="text-center text-muted mt-8">{t('app.loading')}</p>
          ) : filteredStudents.length === 0 ? (
            <div className="card text-center text-muted py-8 glass">
              {t('att.noStudents')} {selectedGrade !== 'All' && selectedGrade !== 'All Mezmur' ? `(${selectedGrade})` : ''}
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
                    <p className="font-bold m-0" style={{ fontSize: '1.05rem' }}>{studentName(student)}</p>
                    <p className="text-muted m-0 text-xs mt-1 font-semibold uppercase tracking-wider">{student.grade}</p>
                  </div>
                  <div className="attendance-actions">
                    <button
                      onClick={() => handleMark(student.id, 'present')}
                      className={`action-btn present ${status === 'present' ? 'active' : ''}`}
                      disabled={isLocked}
                      title={t('att.present')}
                    >
                      <CheckCircle2 size={30} />
                    </button>
                    <button
                      onClick={() => handleMark(student.id, 'permission')}
                      className={`action-btn permission ${status === 'permission' ? 'active' : ''}`}
                      disabled={isLocked}
                      title={t('att.permission')}
                    >
                      <ShieldAlert size={30} />
                    </button>
                    <button
                      onClick={() => handleMark(student.id, 'absent')}
                      className={`action-btn absent ${status === 'absent' ? 'active' : ''}`}
                      disabled={isLocked}
                      title={t('att.absent')}
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

      {/* ── Sticky Submit Bar ───────────────────────────────────────────────── */}
      {!isLocked && filteredStudents.length > 0 && !loading && (
        <div className="att-submit-bar">
          <div className="att-submit-info">
            <span className="att-submit-count">
              <span className="text-success font-black">{presentCount}</span>
              {permissionCount > 0 && <><span className="text-muted">/</span><span className="text-warning font-black">{permissionCount}</span></>}
              <span className="text-muted">/</span>
              <span className="text-danger font-black">{absentCount}</span>
            </span>
            {markedCount < totalFiltered && (
              <span className="att-submit-remaining">{totalFiltered - markedCount} {t('att.unmarked')}</span>
            )}
          </div>
          <button
            className="att-submit-btn"
            onClick={handleSubmit}
            disabled={submitting || markedCount === 0}
          >
            {submitting
              ? <span className="animate-pulse">{t('att.saving')}</span>
              : <><Send size={16} /> {isEditing ? t('btn.save') : t('att.submitBtn')}</>
            }
          </button>
        </div>
      )}
    </div>
  );
}
