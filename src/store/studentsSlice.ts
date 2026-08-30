import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, uploadFile } from "../api/client";

export type ParkingStatus = "unassigned" | "valid" | "expired" | "suspended";

export interface Student {
  id: number;
  first: string;
  last: string;
  student_id: string;
  email: string;
  grade: string;
  assigned_slot: string | null;
  parking_status: ParkingStatus;
}

// The editable fields the admin can send when creating or updating a student.
export interface StudentDraft {
  first: string;
  last: string;
  student_id: string;
  email: string;
  grade: string;
  parking_status?: ParkingStatus;
}

export interface ImportSummary {
  added: number;
  updated: number;
  errors: string[];
}

interface StudentsState {
  list: Student[];
  query: string;
  status: "idle" | "loading" | "error";
  error: string | null;
  lastImport: ImportSummary | null;
}

const initialState: StudentsState = { list: [], query: "", status: "idle", error: null, lastImport: null };

// GET /api/students?q=... -> Student[]
export const fetchStudents = createAsyncThunk(
  "students/fetch",
  (query: string = "") => api.get(`/api/students?q=${encodeURIComponent(query)}`) as Promise<Student[]>,
);

// POST /api/students -> Student
export const createStudent = createAsyncThunk(
  "students/create",
  async (draft: StudentDraft, { getState, dispatch }) => {
    await api.post("/api/students", draft);
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  },
);

// PATCH /api/students/:id -> Student
export const updateStudent = createAsyncThunk(
  "students/update",
  async (args: { id: number; changes: Partial<StudentDraft> }, { getState, dispatch }) => {
    await api.patch(`/api/students/${args.id}`, args.changes);
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  },
);

// DELETE /api/students/:id
export const deleteStudent = createAsyncThunk(
  "students/delete",
  async (id: number, { getState, dispatch }) => {
    await api.del(`/api/students/${id}`);
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  },
);

// POST /api/students/:id/assign { spaceId } -> Space  (place/move a student into a lot spot)
export const assignStudent = createAsyncThunk(
  "students/assign",
  async (args: { id: number; spaceId: number }, { getState, dispatch }) => {
    await api.post(`/api/students/${args.id}/assign`, { spaceId: args.spaceId });
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
  },
);

// POST /api/students/import (multipart CSV) -> { added, updated, errors }
export const importStudents = createAsyncThunk(
  "students/import",
  async (file: File, { getState, dispatch }) => {
    const summary = (await uploadFile("/api/students/import", file)) as ImportSummary;
    const query = (getState() as { students: StudentsState }).students.query;
    await dispatch(fetchStudents(query));
    return summary;
  },
);

const studentsSlice = createSlice({
  name: "students",
  initialState,
  reducers: {
    setQuery(state, action: { payload: string }) {
      state.query = action.payload;
    },
    clearImportSummary(state) {
      state.lastImport = null;
    },
    clearStudentsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const fail = (state: StudentsState, action: { error: { message?: string } }) => {
      state.status = "error";
      state.error = action.error.message ?? "Something went wrong";
    };
    builder
      .addCase(fetchStudents.pending, (state) => { state.status = "loading"; state.error = null; })
      .addCase(fetchStudents.fulfilled, (state, action) => { state.status = "idle"; state.list = action.payload; })
      .addCase(fetchStudents.rejected, fail)
      .addCase(createStudent.rejected, fail)
      .addCase(updateStudent.rejected, fail)
      .addCase(deleteStudent.rejected, fail)
      .addCase(assignStudent.rejected, fail)
      .addCase(importStudents.fulfilled, (state, action) => { state.lastImport = action.payload; })
      .addCase(importStudents.rejected, fail);
  },
});

export const { setQuery, clearImportSummary, clearStudentsError } = studentsSlice.actions;
export default studentsSlice.reducer;
