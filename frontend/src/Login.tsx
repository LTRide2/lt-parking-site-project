import { useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "./store";
import { loginStudent, loginAdmin } from "./store/authSlice";

const StudentLoginForm = ({ onBack }: { onBack: () => void }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((state) => state.auth.error);
  const loading = useAppSelector((state) => state.auth.status === "loading");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code") as string;
    dispatch(loginStudent(code));
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
      <p style={{ fontSize: "0.75rem", color: "#888" }}>Try code STU001, STU002, STU003, or STU004.</p>
    </div>
  );
};

const AdminLoginForm = ({ onBack }: { onBack: () => void }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((state) => state.auth.error);
  const loading = useAppSelector((state) => state.auth.status === "loading");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    dispatch(loginAdmin({
      username: form.get("username") as string,
      password: form.get("password") as string,
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
      <p style={{ fontSize: "0.75rem", color: "#888" }}>Try admin / admin123.</p>
    </div>
  );
};

const Login = () => {
  const [view, setView] = useState<"selection" | "student" | "admin">("selection");

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
