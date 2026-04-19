import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function LoginView() {
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();

  // If already logged in, redirect to dashboard
  if (!authLoading && session) {
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
        setErrorMsg(error.message);
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        // Success — navigate to dashboard
        navigate('/', { replace: true });
      } else {
        setErrorMsg('Login succeeded but no session was returned. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMsg(error?.message || 'Network error. Please check your internet connection.');
      setIsLoading(false);
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="card glass" style={{ maxWidth: '420px', width: '100%', padding: '3rem 2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
          <img src="/sunday_school_pro_logo.png" alt="Logo" className="brand-logo-lg" />
          <h1 className="page-title text-center" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', fontWeight: '800' }}>{t('app.title')}</h1>
        </div>
        
        <p className="text-muted text-center mb-6">{t('auth.enterCredentials')}</p>

        {errorMsg && (
          <div className="text-center mb-6" style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: '600', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="form-grid">
          <div>
            <label className="text-sm font-semibold mb-1 block">{t('auth.email')}</label>
            <input required type="email" className="form-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">{t('auth.password')}</label>
            <input required type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={isLoading} className="btn-primary py-4 mt-4" style={{ fontSize: '1.1rem', border: 'none', borderRadius: 'var(--radius-md)' }}>
            {isLoading ? t('auth.authenticating') : t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
