import { useState } from 'react';

/**
 *
 */
const StudentLoginForm = ({ onBack }: { onBack: () => void }) => {
  return (
    <div>
      <h2>Student Login</h2>
      <form>
        <div>
          <label>Code: </label>
          <input type="text" name="code" />
        </div>
        <button type="submit">Login</button>
      </form>
      <button onClick={onBack} style={{ marginTop: '10px' }}>Back</button>
    </div>
  );
};

/**
 *
 */
const AdminLoginForm = ({ onBack }: { onBack: () => void }) => {
  return (
    <div>
      <h2>Admin Login</h2>
      <form>
        <div>
          <label>Admin Username: </label>
          <input type="text" name="username" />
        </div>
        <div>
          <label>Password: </label>
          <input type="password" name="password" />
        </div>
        <button type="submit">Login</button>
      </form>
      <button onClick={onBack} style={{ marginTop: '10px' }}>Back</button>
    </div>
  );
};

/**
 *
 */
const Login = () => {
  const [view, setView] = useState<'selection' | 'student' | 'admin'>('selection');

  const renderContent = () => {
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
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      {renderContent()}
    </div>
  );
};

export default Login;
