import { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from './store';
import {
  setSelectedLot,
  setIsEditMode,
  setEditAction,
  toggleEditMode,
  toggleSpaceSelection,
  enableSelectedSpaces,
  disableSelectedSpaces,
} from './store/parkingSlice';

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
  const { selectedLot, isEditMode, editAction, selectedSpaces, disabledSpaces } = useAppSelector(state => state.parking);
  const isControlPanelActive = isEditMode;

  const [mapScale, setMapScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startOX: 0, startOY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Mirror of mapScale/mapOffset in a ref so the native wheel handler never reads stale state
  const mapStateRef = useRef({ scale: 1, x: 0, y: 0 });
  const fitScaleRef = useRef(1);

  const initMapTransform = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth) return;
    const scale = Math.min(canvas.clientWidth / img.naturalWidth, canvas.clientHeight / img.naturalHeight);
    const x = (canvas.clientWidth  - img.naturalWidth  * scale) / 2;
    const y = (canvas.clientHeight - img.naturalHeight * scale) / 2;
    fitScaleRef.current = scale;
    mapStateRef.current = { scale, x, y };
    setMapScale(scale);
    setMapOffset({ x, y });
  };

  useEffect(() => {
    if (selectedLot === 'Home') {
      initMapTransform();
    } else {
      mapStateRef.current = { scale: 1, x: 0, y: 0 };
      setMapScale(1);
      setMapOffset({ x: 0, y: 0 });
    }
  }, [selectedLot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedLot !== 'Home') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const { scale: prev, x: px, y: py } = mapStateRef.current;
      const newScale = Math.min(Math.max(prev * factor, 0.05), 8);
      const newX = mouseX - (mouseX - px) * (newScale / prev);
      const newY = mouseY - (mouseY - py) * (newScale / prev);
      mapStateRef.current = { scale: newScale, x: newX, y: newY };
      setMapScale(newScale);
      setMapOffset({ x: newX, y: newY });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [selectedLot]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOX: mapOffset.x, startOY: mapOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = dragRef.current.startOX + (e.clientX - dragRef.current.startX);
    const newY = dragRef.current.startOY + (e.clientY - dragRef.current.startY);
    mapStateRef.current = { ...mapStateRef.current, x: newX, y: newY };
    setMapOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => setIsDragging(false);

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
    border: isEditMode ? '4px solid #f09' : 'none',
    overflow: 'hidden' as const,
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

  const isSelecting = editAction === 'single';

  const spaceColor = (id: string) => {
    if (selectedSpaces.includes(id)) return '#f5c542';
    if (disabledSpaces.includes(id)) return '#aaa';
    return 'white';
  };

  const renderParkingLot = () => {
    const columns = [1, 2, 3];
    const spacesPerColumn = 20;
    return (
      <div style={{ display: 'flex', gap: '40px' }}>
        {columns.map(col => (
          <div key={col} style={{ display: 'flex', gap: '4px' }}>
            {[0, 1].map(side => (
              <div key={side} style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                {Array.from({ length: spacesPerColumn }).map((_, i) => {
                  const id = `${col}-${side}-${i}`;
                  return (
                    <div
                      key={i}
                      onClick={() => isSelecting && dispatch(toggleSpaceSelection(id))}
                      style={{
                        width: '30px',
                        height: '12px',
                        backgroundColor: spaceColor(id),
                        border: selectedSpaces.includes(id) ? '1px solid #c8a000' : '1px solid #aaa',
                        cursor: isSelecting ? 'pointer' : 'default',
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const noneSelected = selectedSpaces.length === 0;
  const multiSelected = selectedSpaces.length > 1;

  const enableDisableDisabled = !isControlPanelActive || noneSelected;
  const manualDisabled = !isControlPanelActive || noneSelected || multiSelected;


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
              style={sideButtonStyle(editAction === 'disable', enableDisableDisabled)}
              onClick={() => dispatch(setEditAction('disable'))}
              disabled={enableDisableDisabled}
            >
              Disable
            </button>
            <button
              style={sideButtonStyle(editAction === 'enable', enableDisableDisabled)}
              onClick={() => {
                dispatch(enableSelectedSpaces());
                dispatch(setEditAction('single'));
              }}
              disabled={enableDisableDisabled}
            >
              Enable
            </button>
            <button
              style={sideButtonStyle(editAction === 'manual', manualDisabled)}
              onClick={() => dispatch(setEditAction('manual'))}
              disabled={manualDisabled}
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
          <div
            ref={canvasRef}
            style={innerCanvasStyle}
            onMouseDown={selectedLot === 'Home' ? handleMouseDown : undefined}
            onMouseMove={selectedLot === 'Home' ? handleMouseMove : undefined}
            onMouseUp={selectedLot === 'Home' ? handleMouseUp : undefined}
            onMouseLeave={selectedLot === 'Home' ? handleMouseUp : undefined}
          >
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
                }} onClick={() => {
                  if (editAction === 'disable') {
                    dispatch(disableSelectedSpaces());
                  } else {
                    dispatch(setIsEditMode(false));
                  }
                }}>
                  Done <span style={{ border: '1px solid white', borderRadius: '2px', padding: '0 2px', fontSize: '0.7rem' }}>✓</span>
                </button>
              </div>
            )}

            {selectedLot === 'Home' && (
              <button
                onClick={initMapTransform}
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 10,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Reset View
              </button>
            )}

            {selectedLot === 'Home' && (
              <img
                ref={imgRef}
                src="/Lake%20Travis%20Parking%20Blank%20(1).jpg"
                alt="Campus Map"
                draggable={false}
                onLoad={initMapTransform}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 'auto',
                  height: 'auto',
                  transformOrigin: '0 0',
                  transform: `translate(${mapOffset.x}px, ${mapOffset.y}px) scale(${mapScale})`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
            {selectedLot === 'Lot 1' && renderParkingLot()}
            {selectedLot !== 'Home' && selectedLot !== 'Lot 1' && (
              <div style={{ color: '#333' }}>Map/View for {selectedLot}</div>
            )}

            <div style={lotNavigationStyle}>
              {['Home', ...Array.from({ length: 17 }, (_, i) => `Lot ${i + 1}`)].map(lot => (
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