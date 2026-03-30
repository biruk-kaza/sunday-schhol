import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  ChevronRight,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, isSaturday, isSunday, nextSaturday, nextSunday } from 'date-fns';

export default function DashboardView() {
  const navigate = useNavigate();
  const { isAdmin, assignedGrade } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    avgAttendance: 0,
    totalSessions: 0
  });
  const [atRisk, setAtRisk] = useState([]);
  const [gradeStats, setGradeStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculate Next Weekend for the CTA
  const getNextWeekend = () => {
    const today = new Date();
    const sat = isSaturday(today) ? today : nextSaturday(today);
    const sun = isSunday(today) ? today : nextSunday(today);
    return `${format(sat, 'MMM do')} & ${format(sun, 'MMM do')}`;
  };

  useEffect(() => {
    fetchDashboardData();
  }, [isAdmin, assignedGrade]);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      // 1. Total Active Students (Filtered for Teachers)
      let studentQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('enrollment_status', 'Active');
      
      if (!isAdmin && assignedGrade) {
        studentQuery = studentQuery.eq('grade', assignedGrade);
      }
      const { count: studentCount } = await studentQuery;

      // 2. Attendance Stats (Filtered for Teachers)
      let attQuery = supabase
        .from('attendance')
        .select('is_present, session_date, session_type, students(grade)');
      
      if (!isAdmin && assignedGrade) {
        // We filter attendance based on the student's grade
        attQuery = attQuery.eq('students.grade', assignedGrade);
      }
      const { data: attData } = await attQuery;

      // 3. At-Risk Students (Admin Only)
      let riskData = [];
      if (isAdmin) {
        const { data } = await supabase
          .from('student_risk_dashboard')
          .select('*')
          .eq('status', 'Action Required')
          .order('risk_score', { ascending: false })
          .limit(3);
        riskData = data || [];
      }

      // Process Stats
      const validRecords = attData?.filter(r => r.students) || [];
      const totalRecords = validRecords.length;
      const presentRecords = validRecords.filter(r => r.is_present).length;
      const uniqueSessions = new Set(validRecords.map(r => `${r.session_date}_${r.session_type}`)).size;

      // Process Grade Stats (Admin Only)
      let gStats = [];
      if (isAdmin) {
        const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
        gStats = grades.map(g => {
          const gRecords = attData?.filter(r => r.students?.grade === g) || [];
          const gPresent = gRecords.filter(r => r.is_present).length;
          const pct = gRecords.length > 0 ? Math.round((gPresent / gRecords.length) * 100) : 0;
          return { name: g, percentage: pct };
        });
      }

      setStats({
        totalStudents: studentCount || 0,
        avgAttendance: totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0,
        totalSessions: uniqueSessions
      });
      setAtRisk(riskData);
      setGradeStats(gStats);

    } catch (error) {
      console.error('Dashboard Fetch Error:', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="header-glass glass mb-8">
        <h1 className="page-title mb-1">{isAdmin ? 'Executive Dashboard' : 'Teacher Portal'}</h1>
        <p className="text-muted">
          {isAdmin 
            ? 'Institutional overview and global class performance metrics.' 
            : `Managed portal for ${assignedGrade} Sunday School Operations.`}
        </p>
      </div>

      <div className="content">
        {/* Top Stats Grid */}
        <div className="dash-stats-grid">
          <div className="card glass border-l-4 border-primary info-box-compact">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">
                  {isAdmin ? 'Total Enrollment' : 'Class size'}
                </p>
                <h2 className="text-2xl font-black m-0">{stats.totalStudents}</h2>
              </div>
            </div>
          </div>
          <div className="card glass border-l-4 border-success info-box-compact">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 text-success rounded-2xl flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Class Participation</p>
                <h2 className="text-2xl font-black m-0 text-success">{stats.avgAttendance}%</h2>
              </div>
            </div>
          </div>
          <div className="card glass border-l-4 border-warning info-box-compact">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 text-warning rounded-2xl flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Weekly Check-ins</p>
                <h2 className="text-2xl font-black m-0">{stats.totalSessions}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className={isAdmin ? "dash-main-grid" : "mt-8"}>
          
          {/* Main Action Card */}
          <div className="flex flex-col gap-6">
            <div className="hero-card shadow-2xl" onClick={() => navigate('/attendance')}>
              <div className="hero-content">
                <span className="badge">{isAdmin ? 'Executive Control' : 'Immediate Action'}</span>
                <h2 className="text-3xl font-black mb-2" style={{ color: 'white' }}>Weekend Roll Call</h2>
                <p className="mb-6 text-lg" style={{ opacity: 0.9, color: 'white' }}>Prepare attendance for: <span className="font-bold underline">{getNextWeekend()}</span></p>
                <button className="hero-btn">
                  Open Attendance Sheet <ArrowRight size={20} />
                </button>
              </div>
              <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '240px', height: '240px', background: 'white', opacity: 0.1, borderRadius: '50%', filter: 'blur(40px)' }}></div>
            </div>

            {/* Admin-only Grade Breakdown */}
            {isAdmin && (
              <div className="card glass animate-fade-in">
                <h3 className="section-title flex items-center gap-2 mb-8" style={{ color: 'var(--text-main)', fontWeight: 800 }}>
                  <TrendingUp size={18} className="text-primary" /> Grade-Level performance
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-8 gap-y-6">
                  {gradeStats.map(g => (
                    <div key={g.name} className="progress-container">
                      <div className="progress-label">
                        <span className="grade-label-text">{g.name}</span>
                        <span className={`grade-value-text ${g.percentage > 80 ? 'text-success' : 'text-primary'}`}>{g.percentage}%</span>
                      </div>
                      <div className="progress-bg">
                        <div className="progress-fill" 
                             style={{ width: `${g.percentage}%`, height: '100%', borderRadius: '99px', background: g.percentage > 80 ? 'var(--success)' : 'var(--primary)' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Admin Panels vs Teacher Info */}
          {isAdmin ? (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="card glass border-t-4 border-danger" style={{ height: 'fit-content' }}>
                <h3 className="section-title flex items-center gap-2 text-danger mb-6" style={{ fontWeight: 800 }}>
                  <AlertCircle size={18} /> High Priority Risk
                </h3>
                {atRisk.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="text-success m-auto mb-4" size={48} />
                    <p className="text-sm text-muted font-bold">No high-risk students found.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {atRisk.map(s => (
                      <div key={s.id} className="risk-item group" onClick={() => navigate('/action')} style={{ cursor: 'pointer' }}>
                        <div>
                          <p className="font-bold m-0 text-sm" style={{ marginBottom: '2px' }}>{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-muted m-0">{s.grade}</p>
                        </div>
                        <span className="text-[10px] font-black bg-danger/10 text-danger px-2 py-0.5 rounded-md">{s.risk_score}</span>
                      </div>
                    ))}
                    <button className="text-center text-xs font-bold text-primary mt-4 uppercase tracking-widest hover:underline" onClick={() => navigate('/action')} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      View Full Risk Dashboard
                    </button>
                  </div>
                )}
              </div>

              <div className="card glass text-center" style={{ padding: '2.5rem 1.5rem', height: 'fit-content' }}>
                <p className="text-xs font-bold text-muted uppercase mb-4">Security Status</p>
                <div className="flex items-center justify-center gap-3 text-success font-black text-sm">
                  <ShieldCheck size={18} /> Portals Verified
                </div>
              </div>
            </div>
          ) : (
            <div className="card glass text-center border-t-4 border-primary mt-6" style={{ padding: '3rem 2rem' }}>
              <ShieldCheck className="text-primary m-auto mb-4" size={48} />
              <h3 className="font-black text-xl mb-2">Authenticated Access</h3>
              <p className="text-muted text-sm max-w-xs mx-auto">
                You are logged in as the primary record keeper for <b>{assignedGrade}</b>. 
                All data entered is secured with institutional-grade monitoring.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
