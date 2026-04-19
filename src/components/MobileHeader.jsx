import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  MoreVertical, 
  LogOut, 
  Settings, 
  AlertCircle, 
  User 
} from 'lucide-react';

export default function MobileHeader() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { t, language, toggleLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleNavigate = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="mobile-header mobile-only">
      <div className="mobile-header-brand">
        <img src="/sunday_school_pro_logo.png" alt="Logo" className="mobile-header-logo" />
        <span className="mobile-header-title">{t('app.title')}</span>
      </div>

      <div className="mobile-header-actions" ref={menuRef}>
        <button
          className="mobile-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
          id="mobile-menu-toggle"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <MoreVertical size={20} />
          )}
        </button>

        {menuOpen && (
          <>
            <div className="dropdown-overlay" onClick={() => setMenuOpen(false)} />
            <div className="mobile-dropdown">
              {/* User Info */}
              <div className="mobile-dropdown-item" style={{ cursor: 'default', opacity: 0.7 }}>
                <User size={18} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{isAdmin ? 'Administrator' : t('set.role')}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email || 'User'}
                  </span>
                </div>
              </div>

              <div className="mobile-dropdown-divider" />

              {/* Language Toggle */}
              <button 
                 onClick={toggleLanguage} 
                 className="mobile-dropdown-item flex items-center justify-between"
               >
                 <span>{t('set.language')}</span>
                 <div className="flex gap-1 text-xs">
                   <span className={language === 'en' ? 'font-black text-primary' : 'text-muted'}>ENG</span>
                   <span className="text-muted">/</span>
                   <span className={language === 'am' ? 'font-black text-primary' : 'text-muted'}>አማ</span>
                 </div>
               </button>

               <div className="mobile-dropdown-divider" />

              {isAdmin && (
                <>
                  <button className="mobile-dropdown-item" onClick={() => handleNavigate('/action')}>
                    <AlertCircle size={18} />
                    <span>{t('nav.riskWatch')}</span>
                  </button>
                  <button className="mobile-dropdown-item" onClick={() => handleNavigate('/settings')}>
                    <Settings size={18} />
                    <span>{t('nav.settings')}</span>
                  </button>
                  <div className="mobile-dropdown-divider" />
                </>
              )}

              <button className="mobile-dropdown-item danger" onClick={handleSignOut} id="mobile-sign-out-btn">
                <LogOut size={18} />
                <span>{t('btn.signOut')}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
