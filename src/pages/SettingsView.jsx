import React, { useState } from 'react';
import { Download, LogOut, FileText, Loader2, Shield, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsView() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, role, assignedGrade, assignedMode, isAdmin } = useAuth();
  const { confirm, alert: showAlert } = useDialog();
  const { t, language, toggleLanguage } = useLanguage();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const exportData = async () => {
    setLoading(true);
    try {
      const { data: students, error } = await supabase
        .from('students')
        .select('*');

      if (error) throw error;

      const headers = ['First Name', 'Last Name', 'Grade', 'Program', 'Phone', 'Status'];
      const csvRows = [
        headers.join(','),
        ...students.map(s => `${s.first_name},${s.last_name},${s.grade},${s.program_type || 'weekend'},${s.parent_phone},${s.enrollment_status}`)
      ];

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      await showAlert('Export failed: ' + err.message, { title: 'Export Error', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handlePromotion = async () => {
    const ok = await confirm(
      "This will increment the grade for ALL active students (e.g. Grade 7 → Grade 8). Grade 12 students will be marked as 'Graduated' and deactivated.",
      { title: 'Yearly Promotion', confirmText: 'Promote All', variant: 'warning' }
    );

    if (!ok) return;

    setLoading(true);
    try {
      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      const updates = students.map(s => {
        let nextGrade = '';
        let isActive = true;
        let status = 'Active';

        if (s.grade === 'Grade 7') nextGrade = 'Grade 8';
        else if (s.grade === 'Grade 8') nextGrade = 'Grade 9';
        else if (s.grade === 'Grade 9') nextGrade = 'Grade 10';
        else if (s.grade === 'Grade 10') nextGrade = 'Grade 11';
        else if (s.grade === 'Grade 11') nextGrade = 'Grade 12';
        else if (s.grade === 'Grade 12') {
          nextGrade = 'Grade 12';
          isActive = false;
          status = 'Graduated';
        }

        return { ...s, grade: nextGrade, is_active: isActive, enrollment_status: status };
      });

      const { error: updateError } = await supabase
        .from('students')
        .upsert(updates);

      if (updateError) throw updateError;

      await showAlert('All students have been moved to their next grade.', { title: 'Promotion Successful', variant: 'success' });
    } catch (err) {
      await showAlert('Promotion failed: ' + err.message, { title: 'Error', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <h1 className="page-title">{t('set.title')}</h1>
      </div>
      <div className="content">

        {/* Current Role Info */}
        <div className="card glass mb-4" style={{ borderLeft: '4px solid var(--primary)' }}>
          <h3 className="section-title flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>
            {isAdmin ? <Shield size={18} className="text-primary" /> : <User size={18} className="text-primary" />}
            {t('set.accessProfile')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <p className="text-xs text-muted font-bold uppercase mb-1">{t('set.email')}</p>
              <p className="text-sm font-bold m-0">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-bold uppercase mb-1">{t('set.role')}</p>
              <p className="text-sm font-bold m-0" style={{ textTransform: 'capitalize' }}>{role}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-bold uppercase mb-1">Grade</p>
              <p className="text-sm font-bold m-0">{assignedGrade || 'All Grades'}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-bold uppercase mb-1">Program</p>
              <p className="text-sm font-bold m-0" style={{ textTransform: 'capitalize' }}>{assignedMode}</p>
            </div>
            <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
               <p className="text-xs text-muted font-bold uppercase mb-2">{t('set.language')}</p>
               <button 
                 onClick={toggleLanguage} 
                 className="btn-outline flex items-center justify-center gap-2 w-full"
                 style={{ padding: '0.5rem' }}
               >
                 <span className={language === 'en' ? 'font-black text-primary' : 'text-muted'}>ENG</span>
                 <span className="text-muted text-xs">/</span>
                 <span className={language === 'am' ? 'font-black text-primary' : 'text-muted'}>አማርኛ</span>
               </button>
            </div>
          </div>
        </div>

        <div className="settings-group card">
          <h3 className="section-title text-muted mb-4">{t('set.dataManagement')}</h3>
          
          <button className="settings-row" onClick={exportData} disabled={loading}>
            <div className="flex items-center gap-3">
              <Download className="text-primary" />
              <span>{t('set.export')}</span>
            </div>
            {loading && <Loader2 className="animate-spin" size={18} />}
          </button>
          
          <button className="settings-row" onClick={handlePromotion} disabled={loading}>
            <div className="flex items-center gap-3">
              <FileText className="text-primary" />
              <span>{t('set.yearlyPromotion')}</span>
            </div>
            {loading && <Loader2 className="animate-spin" size={18} />}
          </button>
        </div>

        <div className="settings-group card mt-4">
          <button className="settings-row text-danger" onClick={handleSignOut}>
            <div className="flex items-center gap-3">
              <LogOut />
              <span>{t('btn.signOut')}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
