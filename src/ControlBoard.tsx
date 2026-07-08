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
  assignSpace,
  unassignSpace,
} from './store/parkingSlice';

const LOT_CONFIGS: Record<string, { sections: number; sides: number; spaces: number; orientation: 'horizontal' | 'vertical' }> = {
  'Lot 1':  { sections: 4, sides: 2, spaces: 20, orientation: 'horizontal' },
  'Lot 2':  { sections: 4, sides: 2, spaces: 25, orientation: 'horizontal' },
  'Lot 3':  { sections: 4, sides: 1, spaces: 15, orientation: 'horizontal' },
  'Lot 4':  { sections: 3, sides: 2, spaces: 20, orientation: 'vertical'   },
  'Lot 5':  { sections: 1, sides: 2, spaces: 40, orientation: 'horizontal' },
  'Lot 6':  { sections: 5, sides: 2, spaces: 12, orientation: 'horizontal' },
  'Lot 7':  { sections: 2, sides: 2, spaces: 20, orientation: 'vertical'   },
  'Lot 8':  { sections: 2, sides: 1, spaces: 30, orientation: 'horizontal' },
  'Lot 9':  { sections: 4, sides: 2, spaces: 18, orientation: 'horizontal' },
  'Lot 10': { sections: 3, sides: 2, spaces: 10, orientation: 'vertical'   },
  'Lot 11': { sections: 1, sides: 1, spaces: 50, orientation: 'horizontal' },
  'Lot 12': { sections: 6, sides: 2, spaces: 8,  orientation: 'horizontal' },
  'Lot 13': { sections: 2, sides: 2, spaces: 30, orientation: 'vertical'   },
  'Lot 14': { sections: 3, sides: 1, spaces: 20, orientation: 'horizontal' },
  'Lot 15': { sections: 4, sides: 2, spaces: 22, orientation: 'horizontal' },
  'Lot 16': { sections: 2, sides: 2, spaces: 16, orientation: 'vertical'   },
  'Lot 17': { sections: 5, sides: 1, spaces: 18, orientation: 'horizontal' },
};

// Crops of the campus site map, tightly framed around each lot's real-world location.
// Lots 8 and 16 have no label anywhere on the source map, so they're intentionally omitted here.
// Lots 1, 2, 6, 9, 12 are curved/radial in reality and use LOT_FAN_CONFIGS below instead, where
// each row gets its own rotation rather than being forced into one rigid rotated rectangle.
const LOT_MAP_CONFIGS: Record<string, {
  image: string;
  naturalWidth: number;
  naturalHeight: number;
  box: { x: number; y: number; w: number; h: number };
  rotate: number;
}> = {
  'Lot 4':  { image: '/lots/lot4.jpg',  naturalWidth: 550,  naturalHeight: 950,  box: { x: 0,   y: 140, w: 340,  h: 430 }, rotate: 0 },
  'Lot 5':  { image: '/lots/lot5.jpg',  naturalWidth: 750,  naturalHeight: 850,  box: { x: 200, y: 165, w: 135,  h: 395 }, rotate: 0 },
  'Lot 11': { image: '/lots/lot11.jpg', naturalWidth: 1700, naturalHeight: 800,  box: { x: 900, y: 270, w: 350,  h: 110 }, rotate: -12 },
  'Lot 13': { image: '/lots/lot13.jpg', naturalWidth: 1000, naturalHeight: 800,  box: { x: 140, y: 380, w: 340,  h: 300 }, rotate: -10 },
  'Lot 14': { image: '/lots/lot14.jpg', naturalWidth: 1200, naturalHeight: 1000, box: { x: 320, y: 120, w: 300,  h: 420 }, rotate: -35 },
  'Lot 15': { image: '/lots/lot15.jpg', naturalWidth: 1050, naturalHeight: 900,  box: { x: 150, y: 280, w: 450,  h: 230 }, rotate: 0 },
  'Lot 17': { image: '/lots/lot17.jpg', naturalWidth: 1600, naturalHeight: 850,  box: { x: 100, y: 80,  w: 1050, h: 570 }, rotate: -8 },
};

// Curved/radial lots: one entry per LOT_CONFIGS section, each independently anchored and rotated
// so a row of spaces can follow a real curved aisle or radiate out from a drop-off loop's center,
// instead of the whole lot being forced through a single rotation.
const LOT_FAN_CONFIGS: Record<string, {
  image: string;
  naturalWidth: number;
  naturalHeight: number;
  sections: Array<{ ax: number; ay: number; boxW: number; boxH: number; rotate: number }>;
}> = {
  'Lot 1': {
    image: '/lots/lot1.jpg', naturalWidth: 1180, naturalHeight: 1200,
    sections: [
      { ax: 230, ay: 50,  boxW: 110, boxH: 433, rotate: -71.2 },
      { ax: 110, ay: 175, boxW: 110, boxH: 625, rotate: -75.7 },
      { ax: 110, ay: 295, boxW: 110, boxH: 613, rotate: -74.4 },
      { ax: 110, ay: 415, boxW: 110, boxH: 530, rotate: -70.7 },
    ],
  },
  'Lot 2': {
    image: '/lots/lot2.jpg', naturalWidth: 1000, naturalHeight: 850,
    sections: [
      { ax: 100, ay: 95,  boxW: 95, boxH: 475, rotate: -73.5 },
      { ax: 70,  ay: 180, boxW: 95, boxH: 505, rotate: -73.9 },
      { ax: 60,  ay: 280, boxW: 95, boxH: 462, rotate: -72.4 },
      { ax: 60,  ay: 380, boxW: 95, boxH: 414, rotate: -70.3 },
    ],
  },
  'Lot 9': {
    image: '/lots/lot9.jpg', naturalWidth: 1050, naturalHeight: 900,
    sections: [
      { ax: 390, ay: 290, boxW: 75, boxH: 155, rotate: 80 },
      { ax: 390, ay: 290, boxW: 75, boxH: 155, rotate: 140 },
      { ax: 390, ay: 290, boxW: 75, boxH: 155, rotate: 200 },
      { ax: 390, ay: 290, boxW: 75, boxH: 155, rotate: 260 },
    ],
  },
  'Lot 12': {
    image: '/lots/lot12.jpg', naturalWidth: 750, naturalHeight: 900,
    sections: [
      { ax: 215, ay: 225, boxW: 70, boxH: 60,  rotate: -48.4 },
      { ax: 260, ay: 265, boxW: 70, boxH: 65,  rotate: -32.5 },
      { ax: 295, ay: 320, boxW: 70, boxH: 72,  rotate: -12.1 },
      { ax: 310, ay: 390, boxW: 70, boxH: 71,  rotate: 8.1 },
      { ax: 300, ay: 460, boxW: 70, boxH: 76,  rotate: 23.2 },
      { ax: 270, ay: 530, boxW: 70, boxH: 127, rotate: 18.4 },
    ],
  },
};

const MAP_DISPLAY_SCALE = 0.5;

// Lots where the interactive spot grid is hidden — the map crop is shown on its own.
const MAP_ONLY_LOTS = new Set([
  'Lot 4', 'Lot 9', 'Lot 11', 'Lot 12', 'Lot 13', 'Lot 14', 'Lot 15', 'Lot 17',
]);

// Mirrors the box-model math renderParkingLot uses below, so the overlay can be scaled to fit the real lot's footprint.
const computeGridSize = (cfg: { sections: number; sides: number; spaces: number; orientation: 'horizontal' | 'vertical' }) => {
  const { sections, sides, spaces, orientation } = cfg;
  if (orientation === 'horizontal') {
    const spaceW = 30, spaceH = 12;
    const sideH = spaces * spaceH + (spaces - 1) * 4;
    const sectionW = sides * spaceW + (sides - 1) * 12;
    return { w: sections * sectionW + (sections - 1) * 40, h: sideH };
  }
  const spaceW = 12, spaceH = 30;
  const sideW = spaces * spaceW + (spaces - 1) * 4;
  const sectionH = sides * spaceH + (sides - 1) * 12;
  return { w: sideW, h: sections * sectionH + (sections - 1) * 30 };
};

// Same math as computeGridSize, but for a single section (used by the fan/radial overlay).
const computeSectionSize = (cfg: { sides: number; spaces: number; orientation: 'horizontal' | 'vertical' }) => {
  const { sides, spaces, orientation } = cfg;
  if (orientation === 'horizontal') {
    const spaceW = 30, spaceH = 12;
    return { w: sides * spaceW + (sides - 1) * 12, h: spaces * spaceH + (spaces - 1) * 4 };
  }
  const spaceW = 12, spaceH = 30;
  return { w: spaces * spaceW + (spaces - 1) * 4, h: sides * spaceH + (sides - 1) * 12 };
};

interface ControlBoardProps
{
  onLogout: () => void;
}

/**
 * 
 * Controlboard: for different functionality for diff user type. affects: parking lot rep, acc managment, + edit mode control.
 *
 * @param {Object} props - The properties 
 * @param {string} props.userType - the type of the logged-in user 
 * @param {string} props.userCode - identifier for the logged-in user
 * @param {Function} props.onLogout - when the user chooses to log out.
 *
 * @returns {JSX.Element} basically just UI for the control board.
 */
export const ControlBoard = ({ onLogout }: ControlBoardProps) =>
{
  const dispatch = useAppDispatch();
  const { userType, userCode } = useAppSelector(state => state.auth);
  const { selectedLot, isEditMode, editAction, selectedSpaces, disabledSpaces, assignedSpaces } = useAppSelector(state => state.parking);
  const isControlPanelActive = isEditMode;

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignIdInput, setAssignIdInput] = useState('');
  const [pendingSpaceId, setPendingSpaceId] = useState<string | null>(null);

  const [mapScale, setMapScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startOX: 0, startOY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // uh the code kept breaking so lowk had to ask gemini what to do and it said something about stale states(basically making sure it reads the current state and not the old one?) not entirely sure what this means but its working now!
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

  const isAdmin = userType === 'admin';
  const studentClaimedSpot = !isAdmin
    ? (Object.keys(assignedSpaces).find(id => assignedSpaces[id] === userCode) ?? null)
    : null;

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
    borderRadius: '2px',
    zIndex: 20
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
    gap: '10px',
    zIndex: 20
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
    if (assignedSpaces[id]) return '#e55';
    return 'rgba(70,150,255,0.55)';
  };

  const renderSection = (lot: string, secIdx: number, cfg: { sides: number; spaces: number; orientation: 'horizontal' | 'vertical' }) => {
    const { sides, spaces, orientation } = cfg;
    const horiz = orientation === 'horizontal';

    return (
      <div style={{ display: 'flex', flexDirection: horiz ? 'row' : 'column', gap: '12px' }}>
        {Array.from({ length: sides }).map((_, sideIdx) => (
          <div key={sideIdx} style={{ display: 'flex', flexDirection: horiz ? 'column' : 'row', gap: '4px' }}>
            {Array.from({ length: spaces }).map((_, i) => {
              const id = `${lot}-${secIdx}-${sideIdx}-${i}`;
              const isDisabled = disabledSpaces.includes(id);
              const isTaken = !!assignedSpaces[id];
              const isMySpot = assignedSpaces[id] === userCode;
              const showId = isAdmin ? isTaken : isMySpot;

              const studentCanClaim = !isAdmin && !isDisabled && !isTaken && !studentClaimedSpot;
              const studentCanUnclaim = !isAdmin && isMySpot;
              const studentCursor = studentCanClaim || studentCanUnclaim ? 'pointer' : 'default';

              const handleClick = () => {
                if (isAdmin) {
                  if (isSelecting) dispatch(toggleSpaceSelection(id));
                } else if (studentCanUnclaim) {
                  dispatch(unassignSpace(id));
                } else if (studentCanClaim) {
                  setPendingSpaceId(id);
                }
              };

              const spaceW = horiz ? 30 : 12;
              const spaceH = horiz ? (showId ? 20 : 12) : 30;

              return (
                <div
                  key={i}
                  onClick={handleClick}
                  style={{
                    width: `${spaceW}px`,
                    height: `${spaceH}px`,
                    backgroundColor: spaceColor(id),
                    border: selectedSpaces.includes(id) ? '1px solid #c8a000' : '1px solid #1a3d7a',
                    cursor: isAdmin ? (isSelecting ? 'pointer' : 'default') : studentCursor,
                    boxSizing: 'border-box' as const,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {showId && (
                    <span style={{ fontSize: '7px', color: 'white', fontWeight: 'bold', lineHeight: 1, padding: '0 1px' }}>
                      {assignedSpaces[id]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderParkingLot = (lot: string) => {
    const cfg = LOT_CONFIGS[lot] ?? LOT_CONFIGS['Lot 1'];
    const { sections, orientation } = cfg;
    const horiz = orientation === 'horizontal';

    return (
      <div style={{ display: 'flex', flexDirection: horiz ? 'row' : 'column', gap: horiz ? '40px' : '30px' }}>
        {Array.from({ length: sections }).map((_, secIdx) => (
          <div key={secIdx}>{renderSection(lot, secIdx, cfg)}</div>
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

      {pendingSpaceId && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'white', color: '#333', borderRadius: '10px',
            padding: '24px', width: '300px', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Claim Parking Spot?</div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              You are about to claim spot <strong>{pendingSpaceId}</strong>. This will be visible to admins under your ID.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPendingSpaceId(null)}
                style={{
                  padding: '6px 16px', borderRadius: '6px', border: '1px solid #ccc',
                  backgroundColor: '#eee', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  dispatch(assignSpace({ spaceId: pendingSpaceId, studentId: userCode }));
                  setPendingSpaceId(null);
                }}
                style={{
                  padding: '6px 16px', borderRadius: '6px', border: 'none',
                  backgroundColor: '#b33', color: 'white', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'white', color: '#333', borderRadius: '10px',
            padding: '24px', width: '300px', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Manual Assign</div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              Space: <strong>{selectedSpaces[0]}</strong>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Enter student ID"
              value={assignIdInput}
              onChange={e => setAssignIdInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && assignIdInput.trim()) {
                  dispatch(assignSpace({ spaceId: selectedSpaces[0], studentId: assignIdInput.trim() }));
                  setShowAssignModal(false);
                }
                if (e.key === 'Escape') setShowAssignModal(false);
              }}
              style={{
                border: '1px solid #ccc', borderRadius: '6px', padding: '8px 10px',
                fontSize: '0.9rem', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{
                  padding: '6px 16px', borderRadius: '6px', border: '1px solid #ccc',
                  backgroundColor: '#eee', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (assignIdInput.trim()) {
                    dispatch(assignSpace({ spaceId: selectedSpaces[0], studentId: assignIdInput.trim() }));
                    setShowAssignModal(false);
                  }
                }}
                disabled={!assignIdInput.trim()}
                style={{
                  padding: '6px 16px', borderRadius: '6px', border: 'none',
                  backgroundColor: assignIdInput.trim() ? '#b33' : '#ccc',
                  color: 'white', cursor: assignIdInput.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={contentWrapperStyle}>
        <aside style={sidebarStyle}>
          {isAdmin && (
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
                onClick={() => { setAssignIdInput(''); setShowAssignModal(true); }}
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
          )}

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
                  zIndex: 1,
                }}
              />
            )}
            {selectedLot !== 'Home' && selectedLot !== 'Lot 3' && (() => {
              const fanCfg = LOT_FAN_CONFIGS[selectedLot];
              const mapCfg = LOT_MAP_CONFIGS[selectedLot];
              const cfg = LOT_CONFIGS[selectedLot] ?? LOT_CONFIGS['Lot 1'];
              const showBoxes = !MAP_ONLY_LOTS.has(selectedLot);

              if (!fanCfg && !mapCfg) {
                return renderParkingLot(selectedLot);
              }

              if (fanCfg) {
                const imgW = fanCfg.naturalWidth * MAP_DISPLAY_SCALE;
                const imgH = fanCfg.naturalHeight * MAP_DISPLAY_SCALE;
                const sectionSize = computeSectionSize(cfg);

                return (
                  <div style={{ position: 'relative', width: `${imgW}px`, height: `${imgH}px` }}>
                    <img
                      src={fanCfg.image}
                      alt={`${selectedLot} campus map crop`}
                      draggable={false}
                      style={{ width: `${imgW}px`, height: `${imgH}px`, display: 'block', userSelect: 'none' }}
                    />
                    {showBoxes && fanCfg.sections.map((sec, secIdx) => {
                      const boxW = sec.boxW * MAP_DISPLAY_SCALE;
                      const boxH = sec.boxH * MAP_DISPLAY_SCALE;
                      const scaleX = boxW / sectionSize.w;
                      const scaleY = boxH / sectionSize.h;
                      return (
                        <div
                          key={secIdx}
                          style={{
                            position: 'absolute',
                            left: `${sec.ax * MAP_DISPLAY_SCALE - boxW / 2}px`,
                            top: `${sec.ay * MAP_DISPLAY_SCALE}px`,
                            width: `${boxW}px`,
                            height: `${boxH}px`,
                            transform: `rotate(${sec.rotate}deg)`,
                            transformOrigin: '50% 0%',
                          }}
                        >
                          <div style={{ transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: 'top left' }}>
                            {renderSection(selectedLot, secIdx, cfg)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const mc = mapCfg!;
              const gridSize = computeGridSize(cfg);
              const imgW = mc.naturalWidth * MAP_DISPLAY_SCALE;
              const imgH = mc.naturalHeight * MAP_DISPLAY_SCALE;
              const boxLeft = mc.box.x * MAP_DISPLAY_SCALE;
              const boxTop = mc.box.y * MAP_DISPLAY_SCALE;
              const boxW = mc.box.w * MAP_DISPLAY_SCALE;
              const boxH = mc.box.h * MAP_DISPLAY_SCALE;
              const scaleX = boxW / gridSize.w;
              const scaleY = boxH / gridSize.h;

              return (
                <div style={{ position: 'relative', width: `${imgW}px`, height: `${imgH}px` }}>
                  <img
                    src={mc.image}
                    alt={`${selectedLot} campus map crop`}
                    draggable={false}
                    style={{ width: `${imgW}px`, height: `${imgH}px`, display: 'block', userSelect: 'none' }}
                  />
                  {showBoxes && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${boxLeft}px`,
                        top: `${boxTop}px`,
                        width: `${boxW}px`,
                        height: `${boxH}px`,
                        transform: `rotate(${mc.rotate}deg)`,
                        transformOrigin: 'center center',
                      }}
                    >
                      <div style={{ transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: 'top left' }}>
                        {renderParkingLot(selectedLot)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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

          {isAdmin && (
            <div style={editToggleContainerStyle}>
              <span>Edit Mode</span>
              <div style={toggleStyle} onClick={() => dispatch(toggleEditMode())}>
                <div style={toggleCircleStyle} />
              </div>
            </div>
          )}

          <div style={logoStyle}>LT</div>
        </main>
      </div>
    </div>
  );
};