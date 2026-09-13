// src/Login.tsx
import { useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "./store";
import { loginStudent, loginAdmin, logout } from "./store/authSlice";
import { ControlBoard } from "./ControlBoard";

const StudentLoginForm = ({ onBack }: { onBack: () => void }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const loading = useAppSelector((s) => s.auth.status === "loading");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();                                                // stop the browser's old-style page reload
    const code = new FormData(e.currentTarget).get("code") as string;  // read the typed code by its name="code"
    dispatch(loginStudent(code));   // fire the thunk; on success the slice flips isLoggedIn
  };

  return (
    <div>
      <h2>Student Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Code: </label>
          <input type="text" name="code" required />
        </div>
        <button type="submit" disabled={loading}>{loading ? "…" : "Login"}</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={onBack} style={{ marginTop: "10px" }}>Back</button>
    </div>
  );
};

const AdminLoginForm = ({ onBack }: { onBack: () => void }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const loading = useAppSelector((s) => s.auth.status === "loading");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();                            // stop the old-style page reload
    const form = new FormData(e.currentTarget);    // grab all the typed fields at once
    dispatch(loginAdmin({
      username: form.get("username") as string,
      password: form.get("password") as string,   // now actually sent!
    }));
  };

  return (
    <div>
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <div><label>Admin Username: </label><input type="text" name="username" required /></div>
        <div><label>Password: </label><input type="password" name="password" required /></div>
        <button type="submit" disabled={loading}>{loading ? "…" : "Login"}</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={onBack} style={{ marginTop: "10px" }}>Back</button>
    </div>
  );
};

const Login = () => {
  const [view, setView] = useState<"selection" | "student" | "admin">("selection");
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const dispatch = useAppDispatch();

  if (isLoggedIn) {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <ControlBoard onLogout={() => dispatch(logout())} />
      </div>
    );
  }

  const content =
    view === "student" ? <StudentLoginForm onBack={() => setView("selection")} /> :
    view === "admin"   ? <AdminLoginForm onBack={() => setView("selection")} /> : (
      <div>
        <h1>Login</h1>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={() => setView("student")}>Student</button>
          <button onClick={() => setView("admin")}>Admin</button>
        </div>
      </div>
    );

  return <div style={{ paddingTop: "50px" }}>{content}</div>;
};

export default Login;