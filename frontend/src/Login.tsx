import { useState, type FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { loginAsStudent, loginAsAdmin, logout } from './store/authSlice';
import { ControlBoard } from './ControlBoard';

const StudentLoginForm = ({ onBack }: { onBack: () => void }) =>
{
  const dispatch = useAppDispatch();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) =>
  {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get('code') as string;
    dispatch(loginAsStudent(code));
  };

  return (
    <div>
      <h2>Student Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Code: </label>
          <input type="text" name="code" required />
        </div>
        <button type="submit">Login</button>
      </form>
      <button onClick={onBack} style={{ marginTop: '10px' }}>Back</button>
    </div>
  );
};

const AdminLoginForm = ({ onBack }: { onBack: () => void }) =>
{
  const dispatch = useAppDispatch();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) =>
  {
    e.preventDefault();
    dispatch(loginAsAdmin());
  };

  return (
    <div>
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Admin Username: </label>
          <input type="text" name="username" required />
        </div>
        <div>
          <label>Password: </label>
          <input type="password" name="password" required />
        </div>
        <button type="submit">Login</button>
      </form>
      <button onClick={onBack} style={{ marginTop: '10px' }}>Back</button>
    </div>
  );
};

const Login = () =>
{
  const [view, setView] = useState<'selection' | 'student' | 'admin'>('selection');
  const isLoggedIn = useAppSelector(state => state.auth.isLoggedIn);
  const dispatch = useAppDispatch();

  if (isLoggedIn)
  {
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <ControlBoard onLogout={() => dispatch(logout())} />
      </div>
    );
  }

  const renderContent = () =>
  {
    switch (view)
    {
      case 'student':
        return <StudentLoginForm onBack={() => setView('selection')} />;
      case 'admin':
        return <AdminLoginForm onBack={() => setView('selection')} />;
      default:
        return (
          <div>
            <h1>Login</h1>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setView('student')}>Student</button>
              <button onClick={() => setView('admin')}>Admin</button>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ paddingTop: '50px' }}>
      {renderContent()}
    </div>
  );
};

export default Login;
