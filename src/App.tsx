// src/App.tsx
import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";
import Login from "./Login";
import StudentDashboard from "./StudentDashboard";   // created in Step 5; stub for now
import { ControlBoard } from "./ControlBoard";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAppDispatch, useAppSelector } from "./store";
import { fetchMe, logout } from "./store/authSlice";

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    // Same session-restore call as U1: a saved token means "confirm who I am."
    if (localStorage.getItem("token")) dispatch(fetchMe());
  }, [dispatch]);

  // When the user becomes known, send them to their home page.
  useEffect(() => {
    if (user?.role === "admin") navigate("/admin");
    else if (user?.role === "student") navigate("/student");
  }, [user, navigate]);

  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/student" element={
          // Guarded: only a logged-in student may render StudentDashboard.
          <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          // Guarded: only a logged-in admin may render ControlBoard.
          <ProtectedRoute role="admin">
            <ControlBoard onLogout={() => { dispatch(logout()); navigate("/login"); }} />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />  {/* unknown URL: send to login */}
      </Routes>
    </div>
  );
}

export default App;