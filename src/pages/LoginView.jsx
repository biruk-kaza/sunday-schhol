import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginView() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        throw error;
      }

      // Use React Router navigation (not window.location) to avoid full page reload
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="card glass" style={{ maxWidth: '420px', width: '100%', padding: '3rem 2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
          <img src="/sunday_school_pro_logo.png" alt="Logo" className="brand-logo-lg" />
          <h1 className="page-title text-center" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', fontWeight: '800' }}>Sunday School Pro</h1>
        </div>
        
        <p className="text-muted text-center mb-6">Enter your credentials to access the portal.</p>

        {errorMsg && (
          <div className="text-danger bg-danger text-center mb-6" style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'white', fontWeight: '500' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="form-grid">
          <div>
            <label className="text-sm font-semibold mb-1 block">Email</label>
            <input required type="email" className="form-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Password</label>
            <input required type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={isLoading} className="btn-primary py-4 mt-4" style={{ fontSize: '1.1rem', border: 'none', borderRadius: 'var(--radius-md)' }}>
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
