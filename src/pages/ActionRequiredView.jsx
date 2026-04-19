import React, { useState, useEffect } from 'react';
import { Phone, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function ActionRequiredView() {
  const { t } = useLanguage();
  const [highRiskStudents, setHighRiskStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAtRiskStudents();
  }, []);

  async function fetchAtRiskStudents() {
    try {
      setLoading(true);
      // Fetch only students with 'Action Required' from our powerful View
      const { data, error } = await supabase
        .from('student_risk_dashboard')
        .select('*')
        .eq('status', 'Action Required')
        .order('risk_score', { ascending: false });

      if (error) throw error;
      setHighRiskStudents(data || []);
    } catch (error) {
      console.error('Error fetching risk dashboard:', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <h1 className="page-title text-danger flex items-center gap-2">
          <AlertTriangle /> Action Required
        </h1>
        <p className="text-muted">High-priority students needing follow-up (Risk Score {'>'} 45)</p>
      </div>

      <div className="content">
        {loading ? (
          <p className="text-center text-muted mt-4">Analyzing attendance patterns...</p>
        ) : highRiskStudents.length === 0 ? (
          <div className="card text-center text-muted py-4">
            <CheckCircle2 className="text-success m-auto mb-2" size={48} />
            <p>All clear! No students are currently in the red zone.</p>
          </div>
        ) : (
          highRiskStudents.map(student => (
            <div key={student.id} className="card risk-card">
              <div className="risk-header flex justify-between items-center">
                <div>
                  <h3 className="student-name font-semibold m-0">{student.first_name} {student.last_name}</h3>
                  <p className="text-danger font-semibold m-0 text-sm mt-1">Risk Score: {student.risk_score}</p>
                  <p className="text-muted text-sm m-0">Grade: {student.grade}</p>
                </div>
                <div className="contact-actions">
                  <a href={`tel:${student.parent_phone}`} className="btn-circle bg-primary">
                    <Phone size={20} color="white" />
                  </a>
                  <a href={`sms:${student.parent_phone}`} className="btn-circle bg-secondary">
                    <MessageSquare size={20} color="white" />
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
