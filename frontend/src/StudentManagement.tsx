import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import {
  fetchStudents, setQuery, createStudent, updateStudent, deleteStudent,
  importStudents, clearImportSummary, assignStudent,
  type Student, type StudentDraft, type ParkingStatus,
} from './store/studentsSlice';
import { fetchSpaces } from './store/parkingSlice';
import { log } from './lib/log';

const GRADES = ['9', '10', '11', '12'];
const STATUSES: ParkingStatus[] = ['unassigned', 'valid', 'expired', 'suspended'];
const EMPTY_DRAFT: StudentDraft = { first: '', last: '', student_id: '', email: '', grade: '9' };

const statusColor: Record<ParkingStatus, string> = {
  unassigned: '#888', valid: '#2e7d32', expired: '#e08600', suspended: '#c62828',
};

// Admin pane: search / list / add / edit / delete the student roster, plus CSV import.
export function StudentManagement({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { list, query, status, error, lastImport } = useAppSelector((state) => state.students);
  const lots = useAppSelector((state) => state.parking.lots);
  const spacesByLot = useAppSelector((state) => state.parking.spacesByLot);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<StudentDraft>(EMPTY_DRAFT);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<StudentDraft>(EMPTY_DRAFT);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Per-row "assign / move to lot" picker: which student, which lot, which spot.
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignLotId, setAssignLotId] = useState<number | null>(null);
  const [assignSpaceId, setAssignSpaceId] = useState<number | null>(null);

  useEffect(() => { dispatch(fetchStudents('')); }, [dispatch]);

  const onSearch = (term: string) => { dispatch(setQuery(term)); dispatch(fetchStudents(term)); };

  const startEdit = (student: Student) => {
    setEditingId(student.id);
    setEditDraft({
      first: student.first, last: student.last, student_id: student.student_id,
      email: student.email, grade: student.grade, parking_status: student.parking_status,
    });
  };
  const saveEdit = () => {
    if (editingId == null) return;
    log('students', `save edit ${editingId}`);
    dispatch(updateStudent({ id: editingId, changes: editDraft })).then(() => setEditingId(null));
  };
  const removeStudent = (student: Student) => {
    if (!window.confirm(`Delete ${student.first} ${student.last} (${student.student_id})?`)) return;
    log('students', `delete ${student.id} (${student.student_id})`);
    dispatch(deleteStudent(student.id));
  };
  const submitAdd = () => {
    log('students', `add ${addDraft.student_id}`);
    dispatch(createStudent(addDraft)).then(() => { setAddDraft(EMPTY_DRAFT); setShowAdd(false); });
  };
  const onCsvChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { log('students', `import CSV "${file.name}"`); dispatch(importStudents(file)); }
    event.target.value = '';
  };
  const openAssign = (student: Student) => {
    setAssigningId((current) => (current === student.id ? null : student.id));
    setAssignLotId(null);
    setAssignSpaceId(null);
  };
  const pickAssignLot = (lotId: number) => {
    setAssignLotId(lotId);
    setAssignSpaceId(null);
    dispatch(fetchSpaces(lotId)); // load this lot's spaces so we can list the available ones
  };
  const confirmAssign = (student: Student) => {
    if (assignSpaceId == null) return;
    const lotId = assignLotId;
    log('students', `assign ${student.student_id} → space ${assignSpaceId}`);
    dispatch(assignStudent({ id: student.id, spaceId: assignSpaceId })).then(() => {
      setAssigningId(null);
      if (lotId != null) dispatch(fetchSpaces(lotId)); // keep the lot's map view in sync
    });
  };
  const availableSpaces = assignLotId != null ? (spacesByLot[assignLotId] ?? []).filter((space) => space.status === 'available') : [];

  // Export the currently listed students as a CSV matching the import columns,
  // so the admin can edit in a spreadsheet and re-upload. Quote-escape each cell.
  const downloadCsv = () => {
    const escape = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const header = 'First,Last,studentId,email,grade';
    const rows = list.map((student) => [student.first, student.last, student.student_id, student.email, student.grade].map(escape).join(','));
    const csv = [header, ...rows].join('\n');
    log('students', `download CSV (${list.length} students)`);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'students.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = { padding: '4px 6px', boxSizing: 'border-box' as const, width: '100%' };
  const cellStyle = { padding: '6px 8px', borderBottom: '1px solid #eee', textAlign: 'left' as const, verticalAlign: 'middle' as const };
  const smallButton = (bg: string) => ({ padding: '4px 8px', border: 'none', borderRadius: '4px', background: bg, color: '#fff', cursor: 'pointer', fontSize: '0.75rem' });

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', color: '#222', overflow: 'auto', padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Student Management</h2>
        <input
          value={query}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by name or student id…"
          style={{ padding: '7px 10px', flex: 1, minWidth: '220px', border: '1px solid #ccc', borderRadius: '6px' }}
        />
        <button style={{ ...smallButton('#2e6bd6'), padding: '7px 12px', fontSize: '0.85rem' }} onClick={() => setShowAdd((current) => !current)}>➕ Add Student</button>
        <button style={{ ...smallButton('#555'), padding: '7px 12px', fontSize: '0.85rem' }} onClick={() => fileInputRef.current?.click()}>⬆ Upload CSV</button>
        <button style={{ ...smallButton('#555'), padding: '7px 12px', fontSize: '0.85rem' }} title="Download the listed students as a CSV you can edit and re-upload." disabled={list.length === 0} onClick={downloadCsv}>⬇ Download CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onCsvChosen} />
        <button style={{ ...smallButton('#333'), padding: '7px 12px', fontSize: '0.85rem' }} onClick={onClose}>✕ Close</button>
      </div>
      <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '4px' }}>
        CSV columns: <code>First,Last,studentId,email,grade</code> — existing student ids are updated, new ones added.
      </div>

      {lastImport && (
        <div style={{ marginTop: '10px', padding: '8px 10px', background: '#eef6ee', border: '1px solid #bcd', borderRadius: '6px', fontSize: '0.85rem' }}>
          Import complete — <b>{lastImport.added} added</b>, <b>{lastImport.updated} updated</b>
          {lastImport.errors.length > 0 && <span style={{ color: '#c62828' }}> · {lastImport.errors.length} skipped: {lastImport.errors.join('; ')}</span>}
          <button style={{ ...smallButton('#999'), marginLeft: '10px' }} onClick={() => dispatch(clearImportSummary())}>Dismiss</button>
        </div>
      )}
      {error && <div style={{ marginTop: '10px', color: '#c62828' }}>{error}</div>}

      {showAdd && (
        <div style={{ marginTop: '12px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: '0.75rem' }}>First<input style={inputStyle} value={addDraft.first} onChange={(event) => setAddDraft({ ...addDraft, first: event.target.value })} /></label>
          <label style={{ fontSize: '0.75rem' }}>Last<input style={inputStyle} value={addDraft.last} onChange={(event) => setAddDraft({ ...addDraft, last: event.target.value })} /></label>
          <label style={{ fontSize: '0.75rem' }}>Student id<input style={inputStyle} value={addDraft.student_id} placeholder="e.g. S123" onChange={(event) => setAddDraft({ ...addDraft, student_id: event.target.value })} /></label>
          <label style={{ fontSize: '0.75rem' }}>Email<input style={inputStyle} value={addDraft.email} onChange={(event) => setAddDraft({ ...addDraft, email: event.target.value })} /></label>
          <label style={{ fontSize: '0.75rem' }}>Grade
            <select style={inputStyle} value={addDraft.grade} onChange={(event) => setAddDraft({ ...addDraft, grade: event.target.value })}>
              {GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
          </label>
          <button style={smallButton('#2e7d32')} disabled={!addDraft.first.trim() || !addDraft.last.trim() || !addDraft.student_id.trim()} onClick={submitAdd}>Save</button>
          <button style={smallButton('#999')} onClick={() => { setShowAdd(false); setAddDraft(EMPTY_DRAFT); }}>Cancel</button>
        </div>
      )}

      <table style={{ marginTop: '14px', width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={cellStyle}>Name</th>
            <th style={cellStyle}>Student id</th>
            <th style={cellStyle}>Email</th>
            <th style={cellStyle}>Grade</th>
            <th style={cellStyle}>Assigned slot</th>
            <th style={cellStyle}>Parking</th>
            <th style={cellStyle}></th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td style={cellStyle} colSpan={7}>{status === 'loading' ? 'Loading…' : 'No students match.'}</td></tr>
          )}
          {list.map((student) => (
            editingId === student.id ? (
              <tr key={student.id} style={{ background: '#fffef2' }}>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input style={inputStyle} value={editDraft.first} onChange={(event) => setEditDraft({ ...editDraft, first: event.target.value })} />
                    <input style={inputStyle} value={editDraft.last} onChange={(event) => setEditDraft({ ...editDraft, last: event.target.value })} />
                  </div>
                </td>
                <td style={cellStyle}><input style={inputStyle} value={editDraft.student_id} onChange={(event) => setEditDraft({ ...editDraft, student_id: event.target.value })} /></td>
                <td style={cellStyle}><input style={inputStyle} value={editDraft.email} onChange={(event) => setEditDraft({ ...editDraft, email: event.target.value })} /></td>
                <td style={cellStyle}>
                  <select style={inputStyle} value={editDraft.grade} onChange={(event) => setEditDraft({ ...editDraft, grade: event.target.value })}>
                    {GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                </td>
                <td style={cellStyle}>{student.assigned_slot ?? '—'}</td>
                <td style={cellStyle}>
                  <select style={inputStyle} value={editDraft.parking_status ?? student.parking_status} onChange={(event) => setEditDraft({ ...editDraft, parking_status: event.target.value as ParkingStatus })}>
                    {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </td>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={smallButton('#2e7d32')} onClick={saveEdit}>Save</button>
                    <button style={smallButton('#999')} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={student.id}>
                <td style={cellStyle}>{student.first} {student.last}</td>
                <td style={cellStyle}>{student.student_id}</td>
                <td style={cellStyle}>{student.email}</td>
                <td style={cellStyle}>{student.grade}</td>
                <td style={cellStyle}>{student.assigned_slot ?? '—'}</td>
                <td style={cellStyle}><span style={{ color: statusColor[student.parking_status], fontWeight: 'bold' }}>{student.parking_status}</span></td>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={smallButton('#2e7d32')} title="Assign this student to a lot spot, or move them to another lot." onClick={() => openAssign(student)}>{student.assigned_slot ? 'Move' : 'Assign'}</button>
                    <button style={smallButton('#2e6bd6')} onClick={() => startEdit(student)}>Edit</button>
                    <button style={smallButton('#c62828')} onClick={() => removeStudent(student)}>Delete</button>
                  </div>
                </td>
              </tr>
            )
          )).flatMap((row, index) => {
            const student = list[index];
            if (assigningId !== student.id || editingId === student.id) return [row];
            return [row, (
              <tr key={`assign-${student.id}`} style={{ background: '#f2f9f2' }}>
                <td style={cellStyle} colSpan={7}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{student.assigned_slot ? `Move ${student.first} (currently ${student.assigned_slot})` : `Assign ${student.first}`} to:</b>
                    <select style={{ padding: '4px' }} value={assignLotId ?? ''} onChange={(event) => pickAssignLot(Number(event.target.value))}>
                      <option value="" disabled>Choose lot…</option>
                      {lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
                    </select>
                    <select style={{ padding: '4px' }} value={assignSpaceId ?? ''} disabled={assignLotId == null} onChange={(event) => setAssignSpaceId(Number(event.target.value))}>
                      <option value="" disabled>{assignLotId == null ? 'pick a lot first' : availableSpaces.length ? 'Choose spot…' : 'no available spots'}</option>
                      {availableSpaces.map((space) => <option key={space.id} value={space.id}>{space.label}</option>)}
                    </select>
                    <button style={smallButton('#2e7d32')} disabled={assignSpaceId == null} onClick={() => confirmAssign(student)}>Confirm</button>
                    <button style={smallButton('#999')} onClick={() => setAssigningId(null)}>Cancel</button>
                  </div>
                </td>
              </tr>
            )];
          })}
        </tbody>
      </table>
    </div>
  );
}
