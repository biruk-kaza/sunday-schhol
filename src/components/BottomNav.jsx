import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  LayoutDashboard, 
  CalendarCheck2, 
  Users, 
  History,
  Settings
} from 'lucide-react';

export default function BottomNav() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  return (
    <nav className="bottom-nav mobile-only">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <LayoutDashboard size={20} />
        <span>{t('nav.home')}</span>
      </NavLink>
      <NavLink to="/attendance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <CalendarCheck2 size={20} />
        <span>{t('nav.today')}</span>
      </NavLink>
      
      {isAdmin && (
        <>
          <NavLink to="/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>{t('nav.people')}</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <History size={20} />
            <span>{t('nav.stats')}</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </>
      )}
    </nav>
  );
}
