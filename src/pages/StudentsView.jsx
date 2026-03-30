import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Upload, Link as LinkIcon, X, Trash2, UserCheck, Edit, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function StudentsView() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Forms
  const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', grade: 'Grade 7', parent_phone: '' });
  const [editingStudent, setEditingStudent] = useState(null);
  
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true) // Only show non-deleted
        .order('first_name', { ascending: true });
        
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('students')
        .insert([{
          first_name: newStudent.first_name,
          last_name: newStudent.last_name,
          grade: newStudent.grade,
          parent_phone: newStudent.parent_phone,
          enrollment_status: 'Active',
          is_active: true
        }])
        .select();

      if (error) throw error;
      
      setStudents([...students, data[0]]);
      setShowAddModal(false);
      setNewStudent({ first_name: '', last_name: '', grade: 'Grade 7', parent_phone: '' });
    } catch (error) {
      alert('Error adding student: ' + error.message);
    }
  }

  async function handleUpdateStudent(e) {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('students')
        .update({
          first_name: editingStudent.first_name,
          last_name: editingStudent.last_name,
          grade: editingStudent.grade,
          parent_phone: editingStudent.parent_phone
        })
        .eq('id', editingStudent.id);

      if (error) throw error;
      
      setStudents(students.map(s => s.id === editingStudent.id ? editingStudent : s));
      setShowEditModal(false);
      setEditingStudent(null);
    } catch (error) {
      alert('Update failed: ' + error.message);
    }
  }

  async function handleApprove(studentId) {
    try {
      const { error } = await supabase
        .from('students')
        .update({ enrollment_status: 'Active' })
        .eq('id', studentId);

      if (error) throw error;
      setStudents(students.map(s => s.id === studentId ? { ...s, enrollment_status: 'Active' } : s));
    } catch (error) {
      alert('Approval failed: ' + error.message);
    }
  }

  async function handleDelete(studentId) {
    if (!window.confirm("Are you sure you want to remove this student? All their attendance records will remain but the student will be deactivated.")) return;
    
    try {
      // Soft delete for safety
      const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);

      if (error) throw error;
      setStudents(students.filter(s => s.id !== studentId));
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        // Robust split handles Windows (\r\n) and Unix (\n) line endings
        const rows = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        const dataRows = rows.slice(1).map(row => {
          // Naive CSV split, but sanitized for basic school roster needs
          return row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
        });

        const newRecords = dataRows
          .filter(row => row.length >= 2 && row[0] !== '') // At least first/last name
          .map(row => {
            const firstName = row[0] || 'Unknown';
            const lastName = row[1] || '';
            const rawGrade = row[2] || 'Grade 7';
            const phone = row[3] || 'N/A';
            
            // Strictly enforce Grade 7-12 mapping even in CSV
            const validGrades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
            const finalGrade = validGrades.includes(rawGrade) ? rawGrade : 'Grade 7';

            return {
              first_name: firstName,
              last_name: lastName,
              grade: finalGrade,
              parent_phone: phone,
              enrollment_status: 'Active',
              is_active: true
            };
          });

        if (newRecords.length === 0) throw new Error("No valid student data found in the CSV file.");

        const { error } = await supabase.from('students').insert(newRecords);
        if (error) throw error;

        alert(`Successfully imported ${newRecords.length} students into the directory.`);
        fetchStudents();
      } catch (err) {
        alert('Bulk Import failed: ' + err.message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || s.enrollment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-container">
      <div className="header-glass glass">
        <h1 className="page-title">Manage Students</h1>
        <p className="text-muted">Onboard and organize your Class of 7-12 attendees.</p>
      </div>

      <div className="content">
        {/* Onboarding Grid */}
        <div className="grid desktop-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="card text-center glass info-box-compact">
            <div className="icon-wrapper bg-primary mx-auto"><Upload size={24} color="white" /></div>
            <h3 className="section-title mt-4" style={{ fontSize: '1rem', fontWeight: 800 }}>Bulk Import (CSV)</h3>
            <p className="text-muted text-xs mb-4">Fastest way to add existing students.</p>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button className="btn-primary w-full" disabled={isUploading} onClick={() => fileInputRef.current.click()}>
              {isUploading ? 'Importing...' : 'Upload CSV'}
            </button>
          </div>

          <div className="card text-center glass info-box-compact">
            <div className="icon-wrapper bg-secondary mx-auto"><UserPlus size={24} color="white" /></div>
            <h3 className="section-title mt-4" style={{ fontSize: '1rem', fontWeight: 800 }}>Manual Entry</h3>
            <p className="text-muted text-xs mb-4">Add a single student manually joined.</p>
            <button className="btn-outline w-full" onClick={() => setShowAddModal(true)}>Add Student</button>
          </div>

          <div className="card text-center glass info-box-compact">
            <div className="icon-wrapper bg-warning mx-auto"><LinkIcon size={24} color="white" /></div>
            <h3 className="section-title mt-4" style={{ fontSize: '1rem', fontWeight: 800 }}>Registration Link</h3>
            <p className="text-muted text-xs mb-4">Copy the link and send it to parents.</p>
            <button className="btn-outline w-full" onClick={() => {
              navigator.clipboard.writeText(window.location.origin + '/register');
              alert('Link copied to clipboard!');
            }}>Copy Link</button>
          </div>
        </div>

        {/* Directory Controls */}
        <div className="flex gap-4 mb-6" style={{ alignItems: 'center' }}>
          <div className="search-container flex-1 bg-white" style={{ marginBottom: 0, border: '1px solid rgba(0,0,0,0.05)' }}>
            <Search size={18} className="text-muted" />
            <input type="text" placeholder="Search by name..." className="search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-muted" />
            <select className="form-input" style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.8rem', fontWeight: 700 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Students</option>
              <option value="Active">Active Only</option>
              <option value="Pending">Pending (New)</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="card table-card glass p-0 overflow-hidden">
          <div className="p-6 border-bottom border-gray-50 flex justify-between items-center">
            <h3 className="section-title m-0" style={{ fontWeight: 800 }}>Student Directory</h3>
            <span className="text-xs font-black bg-primary text-white px-3 py-1.5 rounded-full uppercase tracking-tighter">{filteredStudents.length} Students Listed</span>
          </div>
          
          <div className="table-responsive">
            <table className="student-table w-full">
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                  <th style={{ padding: '1rem 1.5rem' }}>Full Name</th>
                  <th>Grade</th>
                  <th>Parent Phone</th>
                  <th className="text-center">Status</th>
                  <th className="text-right" style={{ paddingRight: '1.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center text-muted py-12">Fetching records...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted py-12">No matching students found in the directory.</td></tr>
                ) : (
                  filteredStudents.map(s => (
                    <tr key={s.id}>
                      <td style={{ paddingLeft: '1.5rem' }}>
                        <p className="font-black m-0 text-gray-900">{s.first_name} {s.last_name}</p>
                      </td>
                      <td>
                        <span className="text-xs font-bold text-muted bg-gray-50 px-2 py-1 rounded-md uppercase">{s.grade}</span>
                      </td>
                      <td className="text-sm font-medium">{s.parent_phone}</td>
                      <td className="text-center">
                        <span className={`px-2 py-1 text-[10px] font-black rounded-md uppercase ${s.enrollment_status === 'Active' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                          {s.enrollment_status}
                        </span>
                      </td>
                      <td className="text-right" style={{ paddingRight: '1.5rem' }}>
                        <div className="flex justify-end gap-2">
                          {s.enrollment_status === 'Pending' && (
                            <button className="btn-edit" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }} onClick={() => handleApprove(s.id)} title="Approve Student">
                              <UserCheck size={16} />
                            </button>
                          )}
                          <button className="btn-edit" onClick={() => { setEditingStudent(s); setShowEditModal(true); }} title="Edit">
                            <Edit size={16} />
                          </button>
                          <button className="btn-danger" onClick={() => handleDelete(s.id)} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content card shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="section-title m-0">Add New Student</h2>
              <button className="btn-close" onClick={() => setShowAddModal(false)}><X /></button>
            </div>
            <form onSubmit={handleAddStudent} className="form-grid">
              <div className="flex gap-4">
                <input required type="text" placeholder="First Name" className="form-input flex-1" value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} />
                <input required type="text" placeholder="Last Name" className="form-input flex-1" value={newStudent.last_name} onChange={e => setNewStudent({...newStudent, last_name: e.target.value})} />
              </div>
              <select className="form-input" value={newStudent.grade} onChange={e => setNewStudent({...newStudent, grade: e.target.value})}>
                <option value="Grade 7">Grade 7</option><option value="Grade 8">Grade 8</option><option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option><option value="Grade 11">Grade 11</option><option value="Grade 12">Grade 12</option>
              </select>
              <input required type="tel" placeholder="Parent Phone Number" className="form-input" value={newStudent.parent_phone} onChange={e => setNewStudent({...newStudent, parent_phone: e.target.value})} />
              <button type="submit" className="btn-primary w-full mt-2">Create Student</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingStudent && (
        <div className="modal-overlay">
          <div className="modal-content card shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="section-title m-0">Edit Details</h2>
              <button className="btn-close" onClick={() => setShowEditModal(false)}><X /></button>
            </div>
            <form onSubmit={handleUpdateStudent} className="form-grid">
              <div className="flex gap-4">
                <input required type="text" placeholder="First Name" className="form-input flex-1" value={editingStudent.first_name} onChange={e => setEditingStudent({...editingStudent, first_name: e.target.value})} />
                <input required type="text" placeholder="Last Name" className="form-input flex-1" value={editingStudent.last_name} onChange={e => setEditingStudent({...editingStudent, last_name: e.target.value})} />
              </div>
              <select className="form-input" value={editingStudent.grade} onChange={e => setEditingStudent({...editingStudent, grade: e.target.value})}>
                <option value="Grade 7">Grade 7</option><option value="Grade 8">Grade 8</option><option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option><option value="Grade 11">Grade 11</option><option value="Grade 12">Grade 12</option>
              </select>
              <input required type="tel" placeholder="Parent Phone Number" className="form-input" value={editingStudent.parent_phone} onChange={e => setEditingStudent({...editingStudent, parent_phone: e.target.value})} />
              <button type="submit" className="btn-primary w-full mt-2">Update Student</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
