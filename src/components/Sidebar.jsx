import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <aside className="sidebar desktop-only glass">
      <div className="sidebar-header flex flex-col items-center">
        <img src="/sunday_school_pro_logo.png" alt="Logo" className="brand-logo" />
        <h2 className="brand-title">Sunday School Pro</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink to="/attendance" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <CalendarCheck2 size={20} />
          <span>Attendance</span>
        </NavLink>

        {isAdmin && (
          <>
            <NavLink to="/action" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <AlertCircle size={20} />
              <span>Risk Watch</span>
            </NavLink>
            <NavLink to="/students" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>Students</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <History size={20} />
              <span>Analytics</span>
            </NavLink>
            <div className="sidebar-divider"></div>
            <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Settings size={20} />
              <span>Settings</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-100/50">
        <button onClick={handleLogout} className="sidebar-item w-full text-danger hover:bg-danger/5" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
