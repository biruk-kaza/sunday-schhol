import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RegisterView() {
  const [formData, setFormData] = useState({ first_name: '', last_name: '', grade: 'Grade 7', parent_phone: '', program_type: 'weekend' });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('students')
        .insert([{
            first_name: formData.first_name,
            last_name: formData.last_name,
            grade: formData.grade,
            parent_phone: formData.parent_phone,
            program_type: formData.program_type,
            enrollment_status: 'Pending' // Requires Admin Approval from /students view
        }]);

      if (error) throw error;
      
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      setErrorMsg('Something went wrong. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '1rem' }}>
        <div className="card text-center glass" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center m-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 className="section-title">Registration Complete!</h2>
          <p className="text-muted">Thank you. Your child's details have been sent to the Sunday School Administration for approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="card glass" style={{ maxWidth: '450px', width: '100%' }}>
        <h1 className="page-title text-center text-primary">Sunday School Registration</h1>
        <p className="text-muted text-center mb-4">Please fill out your child's information below.</p>

        {errorMsg && <p className="text-danger text-center mb-4 bg-danger" style={{ padding: '0.5rem', borderRadius: '8px', color: 'white' }}>{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <label className="text-sm font-semibold mb-1 block">First Name</label>
            <input required type="text" className="form-input" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Last Name</label>
            <input required type="text" className="form-input" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Grade / Class</label>
            <select className="form-input" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})}>
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Program</label>
            <select className="form-input" value={formData.program_type} onChange={e => setFormData({...formData, program_type: e.target.value})}>
              <option value="weekend">Weekend (Saturday & Sunday)</option>
              <option value="weekday">Weekday (Monday–Friday)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Parent Phone Number</label>
            <input required type="tel" className="form-input" placeholder="+251..." value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary py-4 mt-4" style={{ fontSize: '1.1rem' }}>
            {isSubmitting ? 'Registering...' : 'Submit Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
