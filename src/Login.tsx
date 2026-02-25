import { useState, type FormEvent } from 'react';
import { ControlBoard } from './ControlBoard';

/**
 * Represents a login form component for students.
 *
 * The component allows students to input their login code and submit it,
 * or navigate back to the previous screen using the provided back button.
 *
 * @param {Object} props - The props object for the StudentLoginForm component.
 * @param {Function} props.onBack - The callback function executed when the "Back" button is clicked.
 */
const StudentLoginForm = ({ onBack, onLogin }: { onBack: () => void; onLogin: (code: string) => void }) =>
{
  const handleSubmit = (e: FormEvent<HTMLFormElement>) =>
  {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = formData.get('code') as string;
    onLogin(code);
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

/**
 * Represents a React component for an admin login form.
 *
 * This component renders a form for logging in as an admin
 * with fields for the username and password. It also includes
 * a back button that triggers an external callback when clicked.
 *
 * @param {Object} props - The component props.
 * @param {Function} props.onBack - A callback function to handle the 'Back' button click event.
 * @returns {JSX.Element} The rendered admin login form component.
 */
const AdminLoginForm = ({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) =>
{
  const handleSubmit = (e: FormEvent<HTMLFormElement>) =>
  {
    e.preventDefault();
    onLogin();
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

/**
 * Represents the login component for the application.
 * It provides a user interface for selecting and navigating between
 * different login views: 'Student' and 'Admin', or returning to the
 * base selection screen.
 *
 * The component maintains a state to determine the current active view,
 * which can be one of the following:
 * - 'selection': The default view where the user can choose between
 *   'Student' or 'Admin' login options.
 * - 'student': Displays the student login form with an option to
 *   navigate back to the selection view.
 * - 'admin': Displays the admin login form with an option to navigate
 *   back to the selection view.
 */
const Login = () =>
{
  const [view, setView] = useState<'selection' | 'student' | 'admin' | 'dashboard'>('selection');
  const [userType, setUserType] = useState<'student' | 'admin'>('student');
  const [userCode, setUserCode] = useState('');

  const handleStudentLogin = (code: string) =>
  {
    setUserType('student');
    setUserCode(code);
    setView('dashboard');
  };

  const handleAdminLogin = () =>
  {
    setUserType('admin');
    setView('dashboard');
  };

  const handleLogout = () =>
  {
    setView('selection');
    setUserCode('');
  };

  const renderContent = () =>
  {
    switch (view)
    {
      case 'student':
        return <StudentLoginForm onBack={() => setView('selection')} onLogin={handleStudentLogin} />;
      case 'admin':
        return <AdminLoginForm onBack={() => setView('selection')} onLogin={handleAdminLogin} />;
      case 'dashboard':
        return <ControlBoard userType={userType} userCode={userCode} onLogout={handleLogout} />;
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
    <div style={view === 'dashboard' ? { height: '100vh', width: '100vw' } : { paddingTop: '50px' }}>
      {renderContent()}
    </div>
  );
};

export default Login;
