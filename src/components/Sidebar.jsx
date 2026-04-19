import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  CalendarCheck2, 
  AlertCircle, 
  History, 
  Users, 
  Settings,
  LogOut
} from 'lucide-react';

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar desktop-only glass">
      <div className="sidebar-header flex flex-col items-center">
        <img src="/sunday_school_pro_logo.png" alt="Logo" className="brand-logo" />
        <h2 className="brand-title">{t('app.title')}</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard size={20} />
          <span>{t('nav.dashboard')}</span>
        </NavLink>
        
        <NavLink to="/attendance" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <CalendarCheck2 size={20} />
          <span>{t('nav.attendance')}</span>
        </NavLink>

        {isAdmin && (
          <>
            <NavLink to="/action" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <AlertCircle size={20} />
              <span>{t('nav.riskWatch')}</span>
            </NavLink>
            <NavLink to="/students" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>{t('nav.students')}</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <History size={20} />
              <span>{t('nav.analytics')}</span>
            </NavLink>
            <div className="sidebar-divider"></div>
            <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Settings size={20} />
              <span>{t('nav.settings')}</span>
            </NavLink>
          </>
        )}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button 
          onClick={toggleLanguage} 
          className="btn-outline flex items-center justify-center gap-2 w-full mx-auto"
          style={{ padding: '0.5rem', width: '90%' }}
        >
          <span className={language === 'en' ? 'font-black text-primary' : 'text-muted'}>ENG</span>
          <span className="text-muted text-xs">/</span>
          <span className={language === 'am' ? 'font-black text-primary' : 'text-muted'}>አማርኛ</span>
        </button>
        <button 
          onClick={handleLogout} 
          className="sidebar-item w-full text-danger"
          style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%' }}
          id="desktop-sign-out-btn"
        >
          <LogOut size={20} />
          <span>{t('btn.signOut')}</span>
        </button>
      </div>
    </aside>
  );
}
