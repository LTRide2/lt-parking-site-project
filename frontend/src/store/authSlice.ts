import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, setToken } from "../api/client";

export interface User {
  id: number;
  role: "student" | "admin";
  name: string;
  email?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  status: "idle" | "loading" | "error";
  error: string | null;
}

const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  status: "idle",
  error: null,
};

// --- Async thunks: these call the backend (mock or real) ---
export const loginStudent = createAsyncThunk(
  "auth/loginStudent",
  (code: string) => api.post("/api/auth/student", { code }) as Promise<{ token: string; user: User }>,
);

export const loginAdmin = createAsyncThunk(
  "auth/loginAdmin",
  (credentials: { username: string; password: string }) =>
    api.post("/api/auth/admin", credentials) as Promise<{ token: string; user: User }>,
);

// Called on page load to restore the session from a saved token.
export const fetchMe = createAsyncThunk("auth/me", () => api.get("/api/auth/me") as Promise<User>);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      setToken(null);
      state.isLoggedIn = false;
      state.user = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const loginOk = (state: AuthState, action: { payload: { token: string; user: User } }) => {
      setToken(action.payload.token);
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.status = "idle";
      state.error = null;
    };
    const loginPending = (state: AuthState) => { state.status = "loading"; state.error = null; };
    const loginFail = (state: AuthState, action: { error: { message?: string } }) => {
      state.status = "error";
      state.error = action.error.message ?? "Login failed";
    };

    builder
      .addCase(loginStudent.pending, loginPending)
      .addCase(loginStudent.fulfilled, loginOk)
      .addCase(loginStudent.rejected, loginFail)
      .addCase(loginAdmin.pending, loginPending)
      .addCase(loginAdmin.fulfilled, loginOk)
      .addCase(loginAdmin.rejected, loginFail)
      // fetchMe restores the session; a bad token falls back to logged-out.
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.user = action.payload;
      })
      .addCase(fetchMe.rejected, (state) => {
        setToken(null);
        state.isLoggedIn = false;
        state.user = null;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
