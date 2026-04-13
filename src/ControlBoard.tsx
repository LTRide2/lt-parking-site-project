import { useAppSelector, useAppDispatch } from './store';
import { setSelectedLot, setIsEditMode, setEditAction, toggleEditMode } from './store/parkingSlice';

interface ControlBoardProps
{
  onLogout: () => void;
}

/**
 * Represents the ControlBoard component, which serves as a dashboard for users
 * with varying functionalities based on their user type (e.g., 'student' or 'admin').
 * It provides different UI and interactive features such as parking lot representation,
 * account management, and edit mode controls.
 *
 * @param {Object} props - The properties object for the ControlBoard component.
 * @param {string} props.userType - Specifies the type of the logged-in user (e.g., 'student' or 'admin').
 *                                   This determines the layout and available actions in the UI.
 * @param {string} props.userCode - A unique identifier for the logged-in user, displayed prominently.
 * @param {Function} props.onLogout - A callback function triggered when the user chooses to log out.
 *
 * @returns {JSX.Element} The rendered UI for ControlBoard, customized per user type and based
 *                        on various internal state values such as the selected lot, edit mode status,
 *                        and user actions.
 */
export const ControlBoard = ({ onLogout }: ControlBoardProps) =>
{
  const dispatch = useAppDispatch();
  const { userType, userCode } = useAppSelector(state => state.auth);
  const { selectedLot, isEditMode, editAction } = useAppSelector(state => state.parking);
  const isControlPanelActive = isEditMode;

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
    flexDirection: 'column' as const,
    backgroundColor: '#666',
    color: 'white',
    fontFamily: 'Arial, sans-serif'
  };

  const headerStyle =
  {
    backgroundColor: '#b33',
    padding: '10px 20px',
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    height: '50px'
  };

  const contentWrapperStyle =
  {
    display: 'flex',
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden'
  };

  const sidebarStyle =
  {
    width: '180px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    zIndex: 10
  };

  const controlPanelStyle = {
    backgroundColor: isControlPanelActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(180, 180, 180, 0.2)',
    borderRadius: '15px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.3)',
    opacity: isControlPanelActive ? 1 : 0.55,
    pointerEvents: isControlPanelActive ? 'auto' as const : 'none' as const
  };

  const controlHeaderStyle = {
    backgroundColor: 'white',
    color: 'black',
    borderRadius: '10px',
    padding: '5px 10px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    marginBottom: '5px'
  };

  const sideButtonStyle = (active: boolean, disabled: boolean) => ({
    backgroundColor: disabled ? '#b4b4b4' : active ? '#d99' : '#e99',
    border: '1px solid #844',
    padding: '8px',
    borderRadius: '2px',
    color: '#333',
    fontSize: '0.9rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
    opacity: disabled ? 0.65 : 1
  });

  const accountSectionStyle = {
    backgroundColor: '#e0e0e0',
    borderRadius: '15px',
    padding: '10px',
    color: '#333',
    display: 'flex',
    alignItems: 'center' as const,
    gap: '10px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    cursor: 'pointer'
  };

  const mainContentStyle =
  {
    flex: 1,
    padding: '40px',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const
  };

  const innerCanvasStyle = {
    backgroundColor: '#d0d0d0',
    width: '100%',
    height: '100%',
    borderRadius: '4px',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
    border: isEditMode ? '4px solid #f09' : 'none'
  };

  const lotNavigationStyle = {
    display: 'flex',
    gap: '5px',
    position: 'absolute' as const,
    bottom: '20px',
    backgroundColor: 'rgba(200, 100, 100, 0.5)',
    padding: '5px',
    borderRadius: '2px'
  };

  const lotButtonStyle = (active: boolean) => ({
    backgroundColor: active ? '#a55' : '#e99',
    border: '1px solid #844',
    padding: '5px 10px',
    color: 'black',
    cursor: 'pointer',
    fontSize: '0.9rem'
  });

  const editToggleContainerStyle = {
    position: 'absolute' as const,
    bottom: '20px',
    left: '20px',
    display: 'flex',
    alignItems: 'center' as const,
    gap: '10px',
    fontSize: '0.8rem'
  };

  const toggleStyle = {
    width: '40px',
    height: '20px',
    backgroundColor: isEditMode ? '#fff' : '#444',
    borderRadius: '10px',
    position: 'relative' as const,
    cursor: 'pointer'
  };

  const toggleCircleStyle = {
    width: '16px',
    height: '16px',
    backgroundColor: isEditMode ? '#444' : '#fff',
    borderRadius: '50%',
    position: 'absolute' as const,
    top: '2px',
    left: isEditMode ? '22px' : '2px',
    transition: 'left 0.2s'
  };

  const editControlsStyle = {
    position: 'absolute' as const,
    top: '10px',
    right: '10px',
    display: 'flex',
    gap: '10px'
  };

  const logoStyle = {
    position: 'absolute' as const,
    bottom: '10px',
    right: '20px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    fontStyle: 'italic',
    opacity: 0.8
  };

  const renderParkingLot = () => {
    const columns = [1, 2, 3];
    const spacesPerColumn = 20;

    return (
      <div style={{ display: 'flex', gap: '40px' }}>
        {columns.map(col => (
          <div key={col} style={{ display: 'flex', gap: '4px' }}>
             <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
               {Array.from({ length: spacesPerColumn }).map((_, i) => (
                 <div key={i} style={{
                   width: '30px',
                   height: '12px',
                   backgroundColor: 'white',
                   border: '1px solid #aaa'
                 }} />
               ))}
             </div>
             <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
               {Array.from({ length: spacesPerColumn }).map((_, i) => (
                 <div key={i} style={{
                   width: '30px',
                   height: '12px',
                   backgroundColor: 'white',
                   border: '1px solid #aaa'
                 }} />
               ))}
             </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>LTRide</div>
        <div style={{ fontSize: '1.5rem', cursor: 'pointer' }}>☰</div>
      </header>

      <div style={contentWrapperStyle}>
        <aside style={sidebarStyle}>
          <div style={controlPanelStyle}>
            <div style={controlHeaderStyle}>Admin Control Board</div>
            <button
              style={sideButtonStyle(editAction === 'single', !isControlPanelActive)}
              onClick={() => dispatch(setEditAction('single'))}
              disabled={!isControlPanelActive}
            >
              Single Select
            </button>
            <button
              style={sideButtonStyle(editAction === 'group', !isControlPanelActive)}
              onClick={() => dispatch(setEditAction('group'))}
              disabled={!isControlPanelActive}
            >
              Group Select
            </button>
            <button
              style={sideButtonStyle(editAction === 'disable', !isControlPanelActive)}
              onClick={() => dispatch(setEditAction('disable'))}
              disabled={!isControlPanelActive}
            >
              Disable
            </button>
            <button
              style={sideButtonStyle(editAction === 'enable', !isControlPanelActive)}
              onClick={() => dispatch(setEditAction('enable'))}
              disabled={!isControlPanelActive}
            >
              Enable
            </button>
            <button
              style={sideButtonStyle(editAction === 'manual', !isControlPanelActive)}
              onClick={() => dispatch(setEditAction('manual'))}
              disabled={!isControlPanelActive}
            >
              Manual Assign
            </button>
            <button
              style={sideButtonStyle(editAction === 'update', !isControlPanelActive)}
              onClick={() => dispatch(setEditAction('update'))}
              disabled={!isControlPanelActive}
            >
              Update School Map
            </button>
          </div>

          <div style={accountSectionStyle} onClick={onLogout}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: '2px solid #333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              👤
            </div>
            <span style={{ fontWeight: 'bold' }}>My Account</span>
          </div>
        </aside>

        <main style={mainContentStyle}>
          <div style={innerCanvasStyle}>
            {isEditMode && (
              <div style={editControlsStyle}>
                <button style={{
                  backgroundColor: '#e77',
                  border: '1px solid #000',
                  borderRadius: '10px',
                  padding: '5px 15px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }} onClick={() => dispatch(setIsEditMode(false))}>
                  Cancel <span style={{ border: '1px solid white', borderRadius: '2px', padding: '0 2px', fontSize: '0.7rem' }}>X</span>
                </button>
                <button style={{
                  backgroundColor: '#7c7',
                  border: '1px solid #000',
                  borderRadius: '10px',
                  padding: '5px 15px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }} onClick={() => dispatch(setIsEditMode(false))}>
                  {editAction === 'disable' ? 'Save' : 'Done'} <span style={{ border: '1px solid white', borderRadius: '2px', padding: '0 2px', fontSize: '0.7rem' }}>✓</span>
                </button>
              </div>
            )}

            {selectedLot === 'Home' ? renderParkingLot() : (
               <div style={{ color: '#333' }}>Map/View for {selectedLot}</div>
            )}

            <div style={lotNavigationStyle}>
              {['Home', 'Lot 1', 'Lot 2', 'Lot 3', 'Lot 4', 'Lot 5', 'Lot 6'].map(lot => (
                <button
                  key={lot}
                  style={lotButtonStyle(selectedLot === lot)}
                  onClick={() => dispatch(setSelectedLot(lot))}
                >
                  {lot}
                </button>
              ))}
            </div>
          </div>

          <div style={editToggleContainerStyle}>
            <span>Edit Mode</span>
            <div style={toggleStyle} onClick={() => dispatch(toggleEditMode())}>
              <div style={toggleCircleStyle} />
            </div>
          </div>

          <div style={logoStyle}>LT</div>
        </main>
      </div>
    </div>
  );
};