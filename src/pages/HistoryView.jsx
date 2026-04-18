import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Users, 
  ChevronDown, 
  ChevronUp,
  Download,
  CheckCircle2,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

export default function HistoryView() {
  const [historyDocs, setHistoryDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [expandedGrades, setExpandedGrades] = useState(new Set()); // Keys like: 'date_type_grade'

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      setLoading(true);
      // Fetch attendance JOIN students to get Names and Grade
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          session_date, 
          session_type, 
          is_present, 
          students ( first_name, last_name, grade )
        `)
        .order('session_date', { ascending: false });

      if (error) throw error;

      const grouped = {};
      (data || []).forEach(row => {
        const key = `${row.session_date}_${row.session_type}`;
        if (!grouped[key]) {
          grouped[key] = {
            date: row.session_date,
            type: row.session_type,
            total: 0,
            present: 0,
            gradeData: {} 
          };
        }
        
        const grade = row.students?.grade || 'Unassigned';
        if (!grouped[key].gradeData[grade]) {
          grouped[key].gradeData[grade] = { 
            total: 0, 
            present: 0,
            students: [] 
          };
        }

        const studentInfo = {
          name: `${row.students?.first_name} ${row.students?.last_name}`,
          status: row.is_present ? 'Present' : 'Absent'
        };

        grouped[key].total += 1;
        grouped[key].gradeData[grade].total += 1;
        grouped[key].gradeData[grade].students.push(studentInfo);
        
        if (row.is_present) {
          grouped[key].present += 1;
          grouped[key].gradeData[grade].present += 1;
        }
      });

      setHistoryDocs(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching history:', error.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleSession = (key) => {
    const next = new Set(expandedSessions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedSessions(next);
  };

  const toggleGrade = (e, key) => {
    e.stopPropagation();
    const next = new Set(expandedGrades);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGrades(next);
  };

  const exportGradeCSV = (e, date, type, grade, studentList) => {
    e.stopPropagation();
    const headers = ['First Name', 'Last Name', 'Grade', 'Status', 'Date', 'Type'];
    const csvContent = [
      headers.join(','),
      ...studentList.map(s => {
        const [first, ...last] = s.name.split(' ');
        return `"${first}","${last.join(' ')}","${grade}","${s.status}","${date}","${type}"`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${grade.replace(' ', '_')}_${date}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <h1 className="page-title flex items-center gap-3">
          <TrendingUp className="text-primary" /> Institutional Analytics
        </h1>
        <p className="text-muted">Class-by-class reporting with deep student-level visibility.</p>
      </div>

      <div className="content">
        <div className="dash-stats-grid mb-8">
          <div className="card glass border-l-4 border-primary info-box-compact">
            <p className="text-xs font-black text-muted uppercase tracking-widest mb-2">Lifetime Sessions</p>
            <p className="text-3xl font-black m-0 leading-none">{historyDocs.length}</p>
          </div>
          <div className="card glass border-l-4 border-success info-box-compact">
            <p className="text-xs font-black text-muted uppercase tracking-widest mb-2">Global Participation</p>
            <p className="text-3xl font-black m-0 leading-none text-success">
              {historyDocs.length > 0 
                ? Math.round(historyDocs.reduce((acc, curr) => acc + (curr.present / curr.total), 0) / historyDocs.length * 100) 
                : 0}%
            </p>
          </div>
        </div>

        <div className="history-list flex flex-col gap-4">
          {loading ? (
            <div className="card text-center py-16 text-muted glass border-none">
              <div className="animate-pulse">Analyzing Archives...</div>
            </div>
          ) : historyDocs.length === 0 ? (
            <div className="card text-center py-16 text-muted glass">No recorded history found in the digital ledger.</div>
          ) : (
            historyDocs.map(session => {
              const sessionKey = `${session.date}_${session.type}`;
              const isSessionExpanded = expandedSessions.has(sessionKey);
              const percentage = Math.round((session.present / session.total) * 100) || 0;
              
              return (
                <div key={sessionKey} className="card glass transition-all overflow-hidden p-0 border-none shadow-sm">
                  <div className="history-card-header cursor-pointer hover:bg-white transition-colors" onClick={() => toggleSession(sessionKey)}>
                    <div className="flex items-center gap-5">
                      <div className="icon-wrapper m-0 bg-primary/10 text-primary w-12 h-12 flex items-center justify-center rounded-xl">
                        <CalendarIcon size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-lg leading-tight m-0">{format(parseISO(session.date), 'MMMM do, yyyy')}</h3>
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-md text-white mt-1.5 inline-block uppercase tracking-wider`} style={{ backgroundColor: session.type === 'Sunday' ? '#6366f1' : '#f97316' }}>
                          {session.type}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="hidden md:flex flex-col items-end">
                        <p className="text-[10px] font-black text-muted uppercase mb-1.5 tracking-tight">{session.present} / {session.total} Present</p>
                        <div className="w-28 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                      {isSessionExpanded ? <ChevronUp className="text-primary" size={20} /> : <ChevronDown className="text-muted" size={20} />}
                    </div>
                  </div>

                  {isSessionExpanded && (
                    <div className="border-t p-4 sm:p-8 animate-fade-in" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex flex-col gap-3">
                        {Object.entries(session.gradeData)
                          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                          .map(([grade, gData]) => {
                            const gradeKey = `${sessionKey}_${grade}`;
                            const isGradeExpanded = expandedGrades.has(gradeKey);
                            const gradePct = Math.round((gData.present / gData.total) * 100) || 0;

                            return (
                              <div key={grade} className="flex flex-col">
                                <div className="grade-row-item cursor-pointer group" onClick={(e) => toggleGrade(e, gradeKey)}>
                                  <div className="flex items-center gap-5 flex-1">
                                    <div className={`p-2.5 rounded-xl transition-colors ${gradePct > 80 ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'} group-hover:bg-primary group-hover:text-white`}>
                                      <FileSpreadsheet size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                      <p className="text-sm font-black m-0 uppercase tracking-tight mb-1">{grade}</p>
                                      <p className="text-[10px] text-muted m-0 font-bold tracking-wide">{gData.present} / {gData.total} Students Recorded</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-5">
                                    <button 
                                      className="btn-outline px-4 py-2 text-[9px] font-black uppercase flex items-center gap-2 hover:bg-primary hover:text-white transition-all border-2"
                                      style={{ borderRadius: '10px' }}
                                      onClick={(e) => exportGradeCSV(e, session.date, session.type, grade, gData.students)}
                                    >
                                      <Download size={12} /> Export CSV
                                    </button>
                                    <div className="text-right min-w-[50px] hidden sm:block">
                                      <span className={`text-sm font-black ${gradePct >= 90 ? 'text-success' : 'text-primary'}`}>
                                        {gradePct}%
                                      </span>
                                    </div>
                                    {isGradeExpanded ? <ChevronUp size={18} className="text-primary" /> : <ChevronDown size={18} className="text-muted" />}
                                  </div>
                                </div>

                                {isGradeExpanded && (
                                  <div className="mx-2 sm:mx-6 mb-6 p-6 border rounded-3xl shadow-xl animate-fade-in" style={{ background: 'var(--bg-card)' }}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                                      {gData.students.sort((a,b) => a.name.localeCompare(b.name)).map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between py-2.5 px-4 hover:bg-gray-50 rounded-2xl transition-colors">
                                          <span className="text-xs font-bold">{s.name}</span>
                                          <span className={`flex items-center gap-2 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg ${s.status === 'Present' ? 'text-success bg-success/5' : 'text-danger bg-danger/5'}`}>
                                            {s.status === 'Present' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            {s.status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}



