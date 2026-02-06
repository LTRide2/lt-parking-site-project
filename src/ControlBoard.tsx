import { useState } from 'react';

/**
 * Represents the properties required by the ControlBoard component.
 *
 * @interface ControlBoardProps
 *
 * @property {'student' | 'admin'} userType - Specifies the type of user accessing the control board.
 *        This can either be a 'student' or an 'admin'.
 *
 * @property {string} [userCode] - Optional user-specific code, typically used for identification
 *        purposes. This property may not always be provided.
 *
 * @property {() => void} onLogout - A callback function to handle the user logout event.
 */
interface ControlBoardProps
{
  userType: 'student' | 'admin';
  userCode?: string;
  onLogout: () => void;
}

/**
 * A React functional component that renders a control board interface for both students and administrators.
 *
 * This component dynamically adjusts its UI based on the `userType` prop. If the user is a student,
 * it displays a simple dashboard. For administrators, it provides a more complex control panel
 * with additional functionalities such as viewing parking lots, maps, diagrams, and spreadsheets.
 *
 * Props:
 * - `userType`: Specifies the type of user. It determines whether the student dashboard or
 *   the admin control board is displayed.
 * - `userCode`: Represents the code or identifier associated with the logged-in user. It is
 *   shown on the student dashboard.
 * - `onLogout`: A callback function invoked when the logout button is clicked.
 *
 * State:
 * - `viewMode`: Indicates the current view mode on the admin control board. Possible values are:
 *   `'lot'`, `'map'`, `'diagram'`, and `'spreadsheet'`.
 *
 * Behavior:
 * - When `userType` is `'student'`, the component renders a student dashboard with basic information
 *   and parking availability status.
 * - When `userType` is not `'student'`, the component renders a full admin control board with various
 *   interactive features, including mode switching and editing options.
 * - The `viewMode` state is updated when the corresponding control button is clicked, resulting in the
 *   display of a placeholder representation of the selected mode.
 */
export const ControlBoard = ({ userType, userCode, onLogout }: ControlBoardProps) =>
{
  const [viewMode, setViewMode] = useState<'lot' | 'map' | 'diagram' | 'spreadsheet'>('lot');

  if (userType === 'student')
  {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Student Dashboard</h1>
        <p>Logged in as: {userCode}</p>
        <div style={{ border: '1px solid #ccc', padding: '10px', margin: '20px 0' }}>
          <h3>Parking Availability</h3>
          <p>No spaces available</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </div>
    );
  }

  const containerStyle =
  {
    display: 'flex',
    height: '100vh',
    flexDirection: 'column' as const
  };

  const headerStyle =
  {
    padding: '10px',
    borderBottom: '1px solid #ccc',
    display: 'flex',
    justifyContent: 'space-between' as const
  };

  const contentWrapperStyle =
  {
    display: 'flex',
    flex: 1
  };

  const sidebarStyle =
  {
    width: '250px',
    padding: '20px',
    borderRight: '1px solid #ccc'
  };

  const navigationListStyle =
  {
    listStyle: 'none' as const,
    padding: 0
  };

  const editingOptionsStyle =
  {
    marginTop: '20px'
  };

  const mainContentStyle =
  {
    flex: 1,
    padding: '20px',
    backgroundColor: '#f9f9f9',
    position: 'relative' as const
  };

  const placeholderContainerStyle =
  {
    width: '100%',
    height: '100%',
    border: '2px dashed #bbb',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  };

  const placeholderContentStyle =
  {
    textAlign: 'center' as const
  };

  const placeholderBoxStyle =
  {
    width: '300px',
    height: '200px',
    backgroundColor: '#ddd',
    margin: '10px auto',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  };

  return (
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h2>Admin Control Board</h2>
          <button onClick={onLogout}>Logout</button>
        </header>
        <div style={contentWrapperStyle}>
          <aside style={sidebarStyle}>
            <h3>Controls</h3>
            <ul style={navigationListStyle}>
              <li>
                <button onClick={() => setViewMode('lot')}>View Parking Lots</button>
              </li>
              <li>
                <button onClick={() => setViewMode('map')}>View Maps</button>
              </li>
              <li>
                <button onClick={() => setViewMode('diagram')}>View Diagrams</button>
              </li>
              <li>
                <button onClick={() => setViewMode('spreadsheet')}>View Spreadsheets</button>
              </li>
            </ul>
            <div style={editingOptionsStyle}>
              <h4>Editing Options</h4>
              <p>Single/Group Selection</p>
              <p>Enable/Disable Spaces</p>
              <p>Manage Student Access</p>
            </div>
          </aside>
          <main style={mainContentStyle}>
            <div style={placeholderContainerStyle}>
              <div style={placeholderContentStyle}>
                <h3>Interactive Image Component</h3>
                <p>Current Mode: {viewMode.toUpperCase()}</p>
                <div style={placeholderBoxStyle}>
                  Placeholder for {viewMode}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
  );
};