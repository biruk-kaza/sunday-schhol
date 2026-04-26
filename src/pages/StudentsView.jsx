import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Upload, Link as LinkIcon, X, Trash2, UserCheck, Edit, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import Papa from 'papaparse';

export default function StudentsView() {
  const { confirm, alert: showAlert } = useDialog();
  const { t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Forms
  const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', grade: 'Grade 7', parent_phone: '', program_type: 'weekend' });
  const [editingStudent, setEditingStudent] = useState(null);
  
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Batch & Import
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState(null);
  const [importTargetGrade, setImportTargetGrade] = useState('Auto');
  const [batchActionType, setBatchActionType] = useState('grade');
  const [batchActionValue, setBatchActionValue] = useState('Grade 7');

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
          program_type: newStudent.program_type,
          enrollment_status: 'Active',
          is_active: true
        }])
        .select();

      if (error) throw error;
      
      setStudents([...students, data[0]]);
      setShowAddModal(false);
      setNewStudent({ first_name: '', last_name: '', grade: 'Grade 7', parent_phone: '', program_type: 'weekend' });
    } catch (error) {
      showAlert('Error adding student: ' + error.message, { title: 'Error', variant: 'danger' });
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
          parent_phone: editingStudent.parent_phone,
          program_type: editingStudent.program_type
        })
        .eq('id', editingStudent.id);

      if (error) throw error;
      
      setStudents(students.map(s => s.id === editingStudent.id ? editingStudent : s));
      setShowEditModal(false);
      setEditingStudent(null);
    } catch (error) {
      showAlert('Update failed: ' + error.message, { title: 'Error', variant: 'danger' });
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
      showAlert('Approval failed: ' + error.message, { title: 'Error', variant: 'danger' });
    }
  }

  async function handleDelete(studentId) {
    const ok = await confirm(
      "Are you sure you want to remove this student? All their attendance records will remain but the student will be deactivated.",
      { title: 'Remove Student', confirmText: 'Remove', variant: 'danger' }
    );
    if (!ok) return;
    
    try {
      // Soft delete for safety
      const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);

      if (error) throw error;
      setStudents(students.filter(s => s.id !== studentId));
    } catch (error) {
      showAlert('Delete failed: ' + error.message, { title: 'Error', variant: 'danger' });
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: false, // assuming raw rows to support mixed CSVs
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          
          // Smart Header Skip: if first row looks like a header, skip it
          let startIndex = 0;
          if (rows.length > 0) {
            const firstRowStr = rows[0].join(' ').toLowerCase();
            if (firstRowStr.includes('name') || firstRowStr.includes('first') || firstRowStr.includes('grade')) {
              startIndex = 1;
            }
          }

          const newRecords = rows.slice(startIndex)
            .filter(row => row.length >= 1 && row[0]?.trim() !== '') // Must have a first name
            .map(row => {
              const firstName = row[0]?.trim() || 'Unknown';
              const lastName = row[1]?.trim() || '';
              const rawGrade = row[2]?.trim() || 'Grade 7';
              const phone = row[3]?.trim() || 'N/A';
              
              // Use the globally selected import target grade, or read from CSV if Auto
              let finalGrade = importTargetGrade;
              if (importTargetGrade === 'Auto') {
                const validGrades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
                finalGrade = validGrades.includes(rawGrade) ? rawGrade : 'Grade 7';
              }

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

          // --- ROBUST BATCH CHUNKING ---
          // Supabase limits payload size. Slicing into 200-record chunks ensures stability.
          const chunkSize = 200; 
          let successfulInserts = 0;
          let failedChunks = 0;

          for (let i = 0; i < newRecords.length; i += chunkSize) {
            const chunk = newRecords.slice(i, i + chunkSize);
            const { error } = await supabase.from('students').insert(chunk);
            if (error) {
              console.error(`Error inserting chunk ${i/chunkSize}:`, error);
              failedChunks++;
            } else {
              successfulInserts += chunk.length;
            }
          }

          if (failedChunks > 0 && successfulInserts === 0) {
             throw new Error("All records failed to import. Please check if columns match or unique constraints are violated.");
          }

          const message = failedChunks > 0 
            ? `Import partially successful. Added ${successfulInserts} students, but some chunks failed. Check the console for details.`
            : `Successfully imported ${successfulInserts} students into the directory.`;

          await showAlert(message, { 
            title: failedChunks > 0 ? 'Completed With Errors' : 'Import Complete', 
            variant: failedChunks > 0 ? 'warning' : 'success' 
          });
          
          fetchStudents();
        } catch (err) {
          showAlert('Bulk Import failed: ' + err.message, { title: 'Import Error', variant: 'danger' });
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        setIsUploading(false);
        showAlert('Failed to parse CSV file: ' + error.message, { title: 'File Error', variant: 'danger' });
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || s.enrollment_status === statusFilter;
    const matchesGrade = gradeFilter === 'All' || s.grade === gradeFilter;
    return matchesSearch && matchesStatus && matchesGrade;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allFilteredIds = filteredStudents.map(s => s.id);
      setSelectedIds(new Set(allFilteredIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id, index, e) => {
    const newSelected = new Set(selectedIds);
    
    // Check e is defined just in case native onChange vs React onChange
    if (e && e.nativeEvent && e.nativeEvent.shiftKey && lastSelectedIdx !== null) {
      const start = Math.min(lastSelectedIdx, index);
      const end = Math.max(lastSelectedIdx, index);
      
      for (let i = start; i <= end; i++) {
        newSelected.add(filteredStudents[i].id);
      }
    } else {
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setLastSelectedIdx(index);
    }
    
    setSelectedIds(newSelected);
  };

  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);
    try {
      setLoading(true);
      const { error } = await supabase
        .from('students')
        .update({ [batchActionType]: batchActionValue })
        .in('id', idsArray);

      if (error) throw error;
      
      setStudents(students.map(s => {
        if (selectedIds.has(s.id)) return { ...s, [batchActionType]: batchActionValue };
        return s;
      }));
      showAlert(`Successfully updated ${selectedIds.size} students.`, { title: 'Success', variant: 'success' });
      setSelectedIds(new Set());
    } catch (error) {
      showAlert('Batch update failed: ' + error.message, { title: 'Error', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm(`Are you sure you want to deactivate ${selectedIds.size} selected students?`, { title: 'Deactivate Students', confirmText: 'Deactivate', variant: 'danger' });
    if (!ok) return;

    const idsArray = Array.from(selectedIds);
    try {
      setLoading(true);
      const { error } = await supabase.from('students').update({ is_active: false }).in('id', idsArray);
      if (error) throw error;
      
      setStudents(students.filter(s => !selectedIds.has(s.id)));
      showAlert(`Successfully deactivated ${selectedIds.size} students.`, { title: 'Success', variant: 'success' });
      setSelectedIds(new Set());
    } catch (error) {
      showAlert('Batch delete failed: ' + error.message, { title: 'Error', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

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
            <div className="flex flex-col gap-2 w-full">
              <select 
                className="form-input text-sm py-2" 
                value={importTargetGrade} 
                onChange={e => setImportTargetGrade(e.target.value)}
              >
                <option value="Auto">Read from CSV (Auto)</option>
                <option value="Grade 7">Import as Grade 7</option>
                <option value="Grade 8">Import as Grade 8</option>
                <option value="Grade 9">Import as Grade 9</option>
                <option value="Grade 10">Import as Grade 10</option>
                <option value="Grade 11">Import as Grade 11</option>
                <option value="Grade 12">Import as Grade 12</option>
              </select>
              <button className="btn-primary w-full" disabled={isUploading} onClick={() => fileInputRef.current.click()}>
                {isUploading ? 'Importing...' : 'Upload CSV'}
              </button>
            </div>
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
              showAlert('Registration link copied to clipboard!', { title: 'Link Copied', variant: 'success' });
            }}>Copy Link</button>
          </div>
        </div>

        {/* Directory Controls */}
        <div className="flex gap-4 mb-6" style={{ alignItems: 'center' }}>
          <div className="search-container flex-1 bg-white" style={{ marginBottom: 0, border: '1px solid rgba(0,0,0,0.05)' }}>
            <Search size={18} className="text-muted" />
            <input type="text" placeholder={t('att.search')} className="search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-muted" />
            <select className="form-input" style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.8rem', fontWeight: 700 }} value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
              <option value="All">All Grades</option>
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
            <select className="form-input" style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.8rem', fontWeight: 700 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Active">{t('status.active')}</option>
              <option value="Pending">{t('status.pending')}</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="card table-card glass p-0 overflow-hidden">
          <div className="p-6 border-bottom border-gray-50 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="section-title m-0" style={{ fontWeight: 800 }}>Student Directory</h3>
              <span className="text-xs font-black bg-primary text-white px-3 py-1.5 rounded-full uppercase tracking-tighter">{filteredStudents.length} Students Listed</span>
            </div>
            
            {/* Batch Actions Toolbar */}
            {selectedIds.size > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary text-sm px-2">
                    {selectedIds.size} Selected
                  </span>
                  <div className="h-6 w-px bg-primary/20 mx-2"></div>
                  <select 
                    className="form-input py-1.5 text-sm w-auto" 
                    style={{ minWidth: '120px' }}
                    value={batchActionType} 
                    onChange={e => {
                      setBatchActionType(e.target.value);
                      setBatchActionValue(e.target.value === 'grade' ? 'Grade 7' : (e.target.value === 'program_type' ? 'weekend' : 'Active'));
                    }}
                  >
                    <option value="grade">Change Grade</option>
                    <option value="program_type">Change Program</option>
                    <option value="enrollment_status">Change Status</option>
                  </select>
                  
                  {batchActionType === 'grade' && (
                    <select className="form-input py-1.5 text-sm w-auto" value={batchActionValue} onChange={e => setBatchActionValue(e.target.value)}>
                      <option value="Grade 7">Grade 7</option>
                      <option value="Grade 8">Grade 8</option>
                      <option value="Grade 9">Grade 9</option>
                      <option value="Grade 10">Grade 10</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                    </select>
                  )}
                  {batchActionType === 'program_type' && (
                    <select className="form-input py-1.5 text-sm w-auto" value={batchActionValue} onChange={e => setBatchActionValue(e.target.value)}>
                      <option value="weekend">Weekend</option>
                      <option value="weekday">Weekday</option>
                    </select>
                  )}
                  {batchActionType === 'enrollment_status' && (
                    <select className="form-input py-1.5 text-sm w-auto" value={batchActionValue} onChange={e => setBatchActionValue(e.target.value)}>
                      <option value="Active">Active</option>
                      <option value="Pending">Pending</option>
                    </select>
                  )}
                  
                  <button className="btn-primary py-1.5 text-sm px-4" onClick={handleBatchUpdate}>Apply</button>
                </div>
                <button className="btn-danger py-1.5 text-sm px-4 flex items-center gap-2" onClick={handleBatchDelete}>
                  <Trash2 size={14} /> Remove Selected
                </button>
              </div>
            )}
          </div>
          
          <div className="table-responsive">
            <table className="student-table w-full">
              <thead>
                <tr>
                  <th style={{ width: '40px', paddingLeft: '1.5rem' }}>
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                      checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={{ padding: '1rem 1rem' }}>Full Name</th>
                  <th>Grade</th>
                  <th>Program</th>
                  <th>Parent Phone</th>
                  <th className="text-center">Status</th>
                  <th className="text-right" style={{ paddingRight: '1.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center text-muted py-12">Fetching records...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan="7" className="text-center text-muted py-12">No matching students found in the directory.</td></tr>
                ) : (
                  filteredStudents.map((s, index) => (
                    <tr key={s.id} className={selectedIds.has(s.id) ? 'bg-primary/5' : ''}>
                      <td style={{ paddingLeft: '1.5rem' }}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => handleSelectRow(s.id, index, e)}
                        />
                      </td>
                      <td style={{ paddingLeft: '1rem' }}>
                        <p className="font-black m-0">{s.first_name} {s.last_name}</p>
                      </td>
                      <td>
                        <span className="text-xs font-bold text-muted bg-gray-50 px-2 py-1 rounded-md uppercase">{s.grade}</span>
                      </td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${(s.program_type || 'weekend') === 'weekend' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                          {(s.program_type || 'weekend') === 'weekend' ? 'WKD' : 'WKY'}
                        </span>
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
              <select className="form-input" value={newStudent.program_type} onChange={e => setNewStudent({...newStudent, program_type: e.target.value})}>
                <option value="weekend">Weekend (Sat/Sun)</option>
                <option value="weekday">Weekday (Mon–Fri)</option>
              </select>
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
              <select className="form-input" value={editingStudent.program_type || 'weekend'} onChange={e => setEditingStudent({...editingStudent, program_type: e.target.value})}>
                <option value="weekend">Weekend (Sat/Sun)</option>
                <option value="weekday">Weekday (Mon–Fri)</option>
              </select>
              <button type="submit" className="btn-primary w-full mt-2">Update Student</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
