import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  CalendarCheck2, 
  AlertCircle, 
  History, 
  Users 
} from 'lucide-react';

export default function BottomNav() {
  const { isAdmin } = useAuth();

  return (
    <nav className="bottom-nav mobile-only glass">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <LayoutDashboard size={20} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/attendance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <CalendarCheck2 size={20} />
        <span>Today</span>
      </NavLink>
      
      {isAdmin && (
        <>
          <NavLink to="/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>People</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <History size={20} />
            <span>Stats</span>
          </NavLink>
        </>
      )}
    </nav>
  );
}
