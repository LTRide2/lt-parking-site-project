// src/store/authSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, setToken } from "../api/client";

// A "User" always has these fields. role can ONLY be one of these two words,
// so a typo like "studnet" is caught before the app even runs.
export interface User {
  id: number;
  role: "student" | "admin";
  name: string;
  email?: string;                          // the "?" means this field is optional
}

// The shape of the "auth" slice — the app's memory of who's logged in.
interface AuthState {
  isLoggedIn: boolean;
  user: User | null;                       // null until someone logs in
  status: "idle" | "loading" | "error";    // used to show a spinner / disable the button
  error: string | null;                    // the red message shown on a failed login
}

const initialState: AuthState = {
  // Start logged-out. If a token is already saved, we confirm it via fetchMe() on app start.
  isLoggedIn: false,
  user: null,
  status: "idle",
  error: null,
};

// --- Async thunks: each wraps ONE backend call (endpoints built in CR B3) ---
// loginStudent(code) sends the code to the server; RTK auto-fires pending → fulfilled/rejected.
export const loginStudent = createAsyncThunk(
  "auth/loginStudent",                                   // a unique name for this action
  (code: string) => api.post("/api/auth/student", { code }) as Promise<{ token: string; user: User }>
);

// Same idea for admins, but it sends a username + password instead of a code.
export const loginAdmin = createAsyncThunk(
  "auth/loginAdmin",
  (creds: { username: string; password: string }) =>
    api.post("/api/auth/admin", creds) as Promise<{ token: string; user: User }>
);

// Called on page load to restore the session: "here's my saved token — who am I?"
export const fetchMe = createAsyncThunk("auth/me", () => api.get("/api/auth/me") as Promise<User>);

const authSlice = createSlice({
  name: "auth",                 // this slice's key inside the store
  initialState,
  reducers: {
    // logout is a plain (non-async) action, so it lives here in `reducers`.
    logout(state) {
      setToken(null);            // clears localStorage + the in-memory token
      state.isLoggedIn = false;
      state.user = null;
      state.status = "idle";
      state.error = null;
    },
  },
  // extraReducers reacts to the thunks above (defined OUTSIDE this reducers block).
  extraReducers: (builder) => {
    // Shared handler for a successful login (student OR admin).
    const loginOk = (state: AuthState, action: { payload: { token: string; user: User } }) => {
      setToken(action.payload.token);      // save the token so a refresh keeps you logged in
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.status = "idle";
      state.error = null;
    };
    const loginPending = (state: AuthState) => { state.status = "loading"; state.error = null; }; // request started
    const loginFail = (state: AuthState, action: { error: { message?: string } }) => {           // request failed
      state.status = "error";
      state.error = action.error.message ?? "Login failed";   // show the server's message, or a fallback
    };

    // Wire each thunk's 3 stages to the handlers above.
    builder
      .addCase(loginStudent.pending, loginPending)
      .addCase(loginStudent.fulfilled, loginOk)
      .addCase(loginStudent.rejected, loginFail)
      .addCase(loginAdmin.pending, loginPending)
      .addCase(loginAdmin.fulfilled, loginOk)
      .addCase(loginAdmin.rejected, loginFail)
      // fetchMe restores the session; if the token is bad, fall back to logged-out.
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.user = action.payload;
      })
      .addCase(fetchMe.rejected, (state) => {
        setToken(null);                    // saved token was invalid/expired — throw it away
        state.isLoggedIn = false;
        state.user = null;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;    // this reducer gets plugged into the store