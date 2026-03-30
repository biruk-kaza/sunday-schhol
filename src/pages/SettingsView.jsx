import React, { useState } from 'react';
import { Download, LogOut, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function SettingsView() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const exportData = async () => {
    setLoading(true);
    try {
      const { data: students, error } = await supabase
        .from('students')
        .select('*');

      if (error) throw error;

      const headers = ['First Name', 'Last Name', 'Grade', 'Phone', 'Status'];
      const csvRows = [
        headers.join(','),
        ...students.map(s => `${s.first_name},${s.last_name},${s.grade},${s.parent_phone},${s.enrollment_status}`)
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
      alert('Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePromotion = async () => {
    const confirm = window.confirm(
      "YEARLY PROMOTION:\n\nThis will increment the grade for ALL active students (e.g. Grade 7 -> Grade 8).\nGrade 12 students will be marked as 'Graduated' and deactivated.\n\nAre you sure you want to proceed?"
    );

    if (!confirm) return;

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

      alert('Promotion successful! All students have been moved to their next grade.');
    } catch (err) {
      alert('Promotion failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="content">
        <div className="settings-group card">
          <h3 className="section-title text-muted mb-4">Data Management</h3>
          
          <button className="settings-row" onClick={exportData} disabled={loading}>
            <div className="flex items-center gap-3">
              <Download className="text-primary" />
              <span>Export Students List (CSV)</span>
            </div>
            {loading && <Loader2 className="animate-spin" size={18} />}
          </button>
          
          <button className="settings-row" onClick={handlePromotion} disabled={loading}>
            <div className="flex items-center gap-3">
              <FileText className="text-primary" />
              <span>Yearly Grade Promotion</span>
            </div>
            {loading && <Loader2 className="animate-spin" size={18} />}
          </button>
        </div>

        <div className="settings-group card mt-4">
          <button className="settings-row text-danger" onClick={handleSignOut}>
            <div className="flex items-center gap-3">
              <LogOut />
              <span>Sign Out Admin</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

