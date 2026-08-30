import { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from './store';
import {
  setSelectedLot,
  setIsEditMode,
  setEditAction,
  toggleEditMode,
  toggleSpaceSelection,
  updateSpaces,
  saveLayout,
  createLot,
  deleteLot,
  uploadLotMap,
  fetchLots,
  fetchSpaces,
  clearError,
  type Space,
} from './store/parkingSlice';
import { fetchInterest, createAssignment, unassignSpace, moveAssignment, type Interest } from './store/interestSlice';
import { StudentManagement } from './StudentManagement';
import { log } from './lib/log';

interface ControlBoardProps {
  onLogout: () => void;
}

// Default slot size as a fraction of the map, for spots with no saved size.
const DEFAULT_SPOT_W = 0.05;
const DEFAULT_SPOT_H = 0.03;

// A spot being edited in the arrange canvas. A negative id marks a not-yet-saved spot.
// x/y/w/h are all fractions of the map (0..1), so the slot keeps its ratio at any size.
interface DraftSpot {
  id: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export const ControlBoard = ({ onLogout }: ControlBoardProps) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const {
    lots, selectedLotId, spacesByLot, isEditMode, editAction, selectedSpaces, status, error,
  } = useAppSelector((state) => state.parking);
  const interestList = useAppSelector((state) => state.interest.all);
  const isAdmin = user?.role === 'admin';
  // Selecting a lot activates the control panel — the lot-action buttons no longer
  // require the separate Edit Mode toggle (that toggle now just shows/hides the
  // editing chrome: the pink border + Cancel).
  const isControlPanelActive = selectedLotId != null;
  const isSelecting = editAction === 'single';

  const spaces = selectedLotId != null ? (spacesByLot[selectedLotId] ?? []) : [];
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null;
  const hasAuthoredLayout = spaces.some((space) => space.x != null && space.y != null);

  // --- manual assign (pick a pending request, then click a space) ---
  const [pickedInterest, setPickedInterest] = useState<Interest | null>(null);
  // --- assigned-spot actions (unassign, or move the request to another lot) ---
  const [assignedPick, setAssignedPick] = useState<Space | null>(null);
  const [moveLotId, setMoveLotId] = useState<number | null>(null);

  // --- student management pane (swaps out the map view when open) ---
  const [managingStudents, setManagingStudents] = useState(false);

  // --- add lot modal ---
  const [showAddLot, setShowAddLot] = useState(false);
  const [lotName, setLotName] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [lotCapacity, setLotCapacity] = useState('');

  // --- arrange mode (drag-and-drop layout editor) ---
  const [draft, setDraft] = useState<DraftSpot[]>([]);
  const [pickedDraftId, setPickedDraftId] = useState<number | null>(null);
  const [rotateStep, setRotateStep] = useState('15'); // degrees per rotate click; kept as string so the field can be edited/blanked
  const tempIdRef = useRef(-1);
  const draggingRef = useRef<number | null>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isArranging = editAction === 'arrange';

  // --- lot-view zoom (expand/shrink the selected lot's map + its spots) ---
  const [lotZoom, setLotZoom] = useState(1);
  // --- lot-view pan: a free 2D translate of the map (like the campus view), so it
  // drags in any direction regardless of size — not scroll, which only moves where
  // the content overflows. Container is overflow:hidden, so there are no scrollbars. ---
  const [lotOffset, setLotOffset] = useState({ x: 0, y: 0 });
  // --- hover tooltip (slot summary: label + who's assigned / availability) ---
  const [tip, setTip] = useState<{ x: number; y: number; label: string; summary: string } | null>(null);
  const lotScrollRef = useRef<HTMLDivElement>(null);
  const lotMapWrapRef = useRef<HTMLDivElement>(null); // the translate layer holding the map
  const lotPanRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, panning: false, moved: false });
  // fresh mirror of zoom/offset for the wheel handler (its listener closure is stale otherwise)
  const lotViewRef = useRef({ zoom: 1, x: 0, y: 0 });

  // --- campus map pan/zoom (the "Home" view) ---
  const [mapScale, setMapScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startOX: 0, startOY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const mapStateRef = useRef({ scale: 1, x: 0, y: 0 });

  // Load lots, this admin's pending requests, and the selected lot's spaces.
  useEffect(() => { dispatch(fetchLots()); if (isAdmin) dispatch(fetchInterest('pending')); }, [dispatch, isAdmin]);
  useEffect(() => { if (selectedLotId != null) dispatch(fetchSpaces(selectedLotId)); }, [selectedLotId, dispatch]);

  // Reset zoom + pan + tooltip when switching lots (called from the nav handlers).
  const resetLotView = () => { setLotZoom(1); setLotOffset({ x: 0, y: 0 }); setTip(null); };

  const zoomBy = (factor: number) => setLotZoom((z) => Math.min(4, Math.max(0.4, +(z * factor).toFixed(2))));

  // Lot view: drag the map to pan it freely in any direction (a translate, so it
  // moves regardless of whether the map overflows the canvas), and the wheel zooms.
  // Disabled while arranging — there, drag moves spots. A drag past a small threshold
  // is a pan, not a spot click (see handleSpaceClick).
  const onLotMouseDown = (event: React.MouseEvent) => {
    // In arrange mode a spot's pointerdown fires first and sets draggingRef; if one is
    // grabbed we're moving a spot, not panning. Dragging the empty map still pans.
    if (draggingRef.current != null) return;
    lotPanRef.current = { startX: event.clientX, startY: event.clientY, ox: lotOffset.x, oy: lotOffset.y, panning: true, moved: false };
  };
  const onLotMouseMove = (event: React.MouseEvent) => {
    const pan = lotPanRef.current;
    if (!pan.panning) return;
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) pan.moved = true;
    setLotOffset({ x: pan.ox + dx, y: pan.oy + dy });
  };
  const endLotPan = () => { lotPanRef.current.panning = false; };

  // keep the wheel handler's view mirror fresh
  useEffect(() => { lotViewRef.current = { zoom: lotZoom, x: lotOffset.x, y: lotOffset.y }; }, [lotZoom, lotOffset]);

  // Wheel-zoom the lot map, anchored at the cursor — same feel as the campus view.
  // Attached imperatively so we can preventDefault the page scroll (React onWheel is passive).
  useEffect(() => {
    const el = lotScrollRef.current;
    if (!el || selectedLotId === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { zoom, x, y } = lotViewRef.current;
      const next = Math.min(4, Math.max(0.4, +(zoom * (event.deltaY < 0 ? 1.1 : 0.9)).toFixed(2)));
      const ratio = next / zoom;
      const wrap = lotMapWrapRef.current;
      // shift the offset so the map point under the cursor stays put (origin is top-left)
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;
        setLotOffset({ x: x + cursorX * (1 - ratio), y: y + cursorY * (1 - ratio) });
      }
      setLotZoom(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [selectedLotId]);

  // One-line summary shown on hover: who has the spot, or that it's open.
  const spaceSummary = (space: Space) =>
    space.status === 'assigned'
      ? `Assigned to ${space.assigned_user_name ?? `user #${space.assigned_user_id ?? '?'}`}`
      : space.status === 'disabled' ? 'Disabled (out of service)' : 'Available';

  // Hover handlers that pop the slot-summary tooltip near the cursor.
  const hoverProps = (space: Space) => ({
    onMouseEnter: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, label: space.label, summary: spaceSummary(space) }),
    onMouseMove: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, label: space.label, summary: spaceSummary(space) }),
    onMouseLeave: () => setTip(null),
  });

  // Same tooltip while arranging: an existing spot shows its status/assignee; an
  // unsaved spot shows its size relative to the map.
  const draftSummary = (spot: DraftSpot) => {
    const existing = spaces.find((space) => space.id === spot.id);
    if (existing) return spaceSummary(existing);
    return `New spot · ${Math.round(spot.w * 100)}%×${Math.round(spot.h * 100)}% of map`;
  };
  const draftHoverProps = (spot: DraftSpot) => ({
    onMouseEnter: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, label: spot.label, summary: draftSummary(spot) }),
    onMouseMove: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, label: spot.label, summary: draftSummary(spot) }),
    onMouseLeave: () => setTip(null),
  });

  // Running trace of the control state so the flow is visible in devtools.
  useEffect(() => {
    log('ui', `state → lot=${selectedLotId ?? 'Home'} editMode=${isEditMode} action=${editAction ?? 'none'} selectedSpaces=[${selectedSpaces.join(',')}] panelActive=${isControlPanelActive}`);
  }, [selectedLotId, isEditMode, editAction, selectedSpaces, isControlPanelActive]);

  const initMapTransform = () => {
    const canvas = canvasRef.current;
    const image = imgRef.current;
    if (!canvas || !image || !image.naturalWidth) return;
    const scale = Math.min(canvas.clientWidth / image.naturalWidth, canvas.clientHeight / image.naturalHeight);
    const x = (canvas.clientWidth - image.naturalWidth * scale) / 2;
    const y = (canvas.clientHeight - image.naturalHeight * scale) / 2;
    mapStateRef.current = { scale, x, y };
    setMapScale(scale);
    setMapOffset({ x, y });
  };

  useEffect(() => {
    if (selectedLotId === null) initMapTransform();
  }, [selectedLotId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedLotId !== null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      const { scale: previous, x: px, y: py } = mapStateRef.current;
      const newScale = Math.min(Math.max(previous * factor, 0.05), 8);
      const newX = mouseX - (mouseX - px) * (newScale / previous);
      const newY = mouseY - (mouseY - py) * (newScale / previous);
      mapStateRef.current = { scale: newScale, x: newX, y: newY };
      setMapScale(newScale);
      setMapOffset({ x: newX, y: newY });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [selectedLotId]);

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = { startX: event.clientX, startY: event.clientY, startOX: mapOffset.x, startOY: mapOffset.y };
  };
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = dragRef.current.startOX + (event.clientX - dragRef.current.startX);
    const newY = dragRef.current.startOY + (event.clientY - dragRef.current.startY);
    mapStateRef.current = { ...mapStateRef.current, x: newX, y: newY };
    setMapOffset({ x: newX, y: newY });
  };
  const handleMouseUp = () => setIsDragging(false);

  // --- shared click behaviour on a space (select in edit mode, or assign) ---
  const handleSpaceClick = (space: Space) => {
    if (lotPanRef.current.moved) return; // that was a pan-drag, not a click
    if (isSelecting && (space.status === 'available' || space.status === 'disabled')) {
      log('ui', `toggle-select space ${space.id} (${space.label})`);
      dispatch(toggleSpaceSelection(space.id));
      return;
    }
    // "Assign to Spot" mode does both: click an assigned (blue) spot to unassign,
    // or pick a pending request then click an available spot to assign.
    if (editAction === 'manual' && selectedLotId != null) {
      if (space.status === 'assigned') {
        // Select the spot; the sub-panel then offers Unassign or Move to another lot.
        log('assign', `select assigned space ${space.id} for action`);
        setAssignedPick(space);
        setMoveLotId(null);
        return;
      }
      if (pickedInterest && pickedInterest.lot_id === selectedLotId && space.status === 'available') {
        log('assign', `space ${space.id} → user ${pickedInterest.user_id} (interest ${pickedInterest.id})`);
        dispatch(createAssignment({
          spaceId: space.id, userId: pickedInterest.user_id, interestId: pickedInterest.id, lotId: selectedLotId,
        })).then(() => { setPickedInterest(null); dispatch(fetchSpaces(selectedLotId)); });
      }
    }
  };

  const spaceColor = (space: Space) => {
    if (selectedSpaces.includes(space.id)) return '#f5c542';   // selected (yellow)
    if (space.status === 'disabled') return '#aaa';            // grey
    if (space.status === 'assigned') return '#7aa7ff';         // blue = taken
    return '#ffeb3b';                                          // available (yellow)
  };

  // The spot the currently-picked request asked for — outlined on the map so the
  // admin can find and approve the exact spot the student chose.
  const isRequestedSpot = (space: Space) =>
    editAction === 'manual' && !!pickedInterest?.space_ids?.includes(space.id);

  // --- arrange helpers ---
  const startArrange = () => {
    log('arrange', `start on lot ${selectedLotId} (${spaces.length} existing spaces)`);
    let fallbackIndex = 0;
    const seeded = spaces.map((space) => {
      const hasPosition = space.x != null && space.y != null;
      // spread positionless spots on a light grid so they can be dragged
      const column = fallbackIndex % 5, row = Math.floor(fallbackIndex / 5);
      if (!hasPosition) fallbackIndex += 1;
      return {
        id: space.id, label: space.label, rotation: space.rotation ?? 0,
        x: hasPosition ? (space.x as number) : 0.2 + column * 0.15,
        y: hasPosition ? (space.y as number) : 0.2 + row * 0.15,
        w: space.w ?? DEFAULT_SPOT_W,
        h: space.h ?? DEFAULT_SPOT_H,
      };
    });
    setDraft(seeded);
    setPickedDraftId(null);
    setLotOffset({ x: 0, y: 0 }); // start arrange from an un-panned map
    dispatch(setEditAction('arrange'));
  };

  const pointToNorm = (event: React.PointerEvent | React.MouseEvent) => {
    const box = mapBoxRef.current;
    if (!box) return { x: 0.5, y: 0.5 };
    const rect = box.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return { x, y };
  };

  // Add a spot to the draft at normalized (x, y). The map-click handler and the
  // explicit "Add Spot" button both funnel through here.
  const addSpotToDraft = (x: number, y: number) => {
    log('arrange', `add spot at (${x.toFixed(2)}, ${y.toFixed(2)})`);
    const id = tempIdRef.current--;
    // new spots are labelled with the lot's number as a prefix, e.g. 7-1, 7-2…
    const prefix = selectedLot?.number ?? selectedLotId ?? 'S';
    setDraft((current) => [...current, { id, label: `${prefix}-${current.length + 1}`, x, y, w: DEFAULT_SPOT_W, h: DEFAULT_SPOT_H, rotation: 0 }]);
    setPickedDraftId(id);
  };

  // Drag is handled on the map CONTAINER (not the tiny spot): pointer-down on a
  // spot records which one, and the container tracks the move — so dragging works
  // across the whole map even when the cursor leaves the little box.
  const onSpotPointerDown = (event: React.PointerEvent, id: number) => {
    event.stopPropagation();
    draggingRef.current = id;
    setPickedDraftId(id);
    mapBoxRef.current?.setPointerCapture(event.pointerId);
  };
  const onMapPointerMove = (event: React.PointerEvent) => {
    const id = draggingRef.current;
    if (id == null) return;
    const { x, y } = pointToNorm(event);
    setDraft((current) => current.map((spot) => (spot.id === id ? { ...spot, x, y } : spot)));
  };
  const onMapPointerUp = () => { draggingRef.current = null; };

  // Rotate the picked spot by the current step. direction +1 = clockwise, -1 = counter-clockwise.
  const rotatePicked = (direction: 1 | -1) => {
    if (pickedDraftId == null) return;
    const step = Number(rotateStep);
    const delta = (Number.isFinite(step) ? step : 15) * direction;
    log('arrange', `rotate spot ${pickedDraftId} by ${delta}°`);
    setDraft((current) => current.map((spot) => (spot.id === pickedDraftId ? { ...spot, rotation: ((spot.rotation + delta) % 360 + 360) % 360 } : spot)));
  };
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  // Resize the picked slot so it fits the space painted on the map. w/h are
  // fractions of the map, so the fit holds at any display size. dw/dh add a step;
  // scale multiplies both (uniform bigger/smaller).
  const resizePicked = (dw: number, dh: number) => {
    if (pickedDraftId == null) return;
    log('arrange', `resize spot ${pickedDraftId} by (${dw}, ${dh})`);
    setDraft((current) => current.map((spot) => (spot.id === pickedDraftId
      ? { ...spot, w: clamp(+(spot.w + dw).toFixed(3), 0.01, 0.6), h: clamp(+(spot.h + dh).toFixed(3), 0.01, 0.6) }
      : spot)));
  };
  const scalePicked = (factor: number) => {
    if (pickedDraftId == null) return;
    log('arrange', `scale spot ${pickedDraftId} ×${factor}`);
    setDraft((current) => current.map((spot) => (spot.id === pickedDraftId
      ? { ...spot, w: clamp(+(spot.w * factor).toFixed(3), 0.01, 0.6), h: clamp(+(spot.h * factor).toFixed(3), 0.01, 0.6) }
      : spot)));
  };
  // The label is the spot's identity/info. New spots get an auto-suggested label
  // (S1, S2…) that the admin can rename here before saving.
  const renamePicked = (label: string) => {
    if (pickedDraftId == null) return;
    setDraft((current) => current.map((spot) => (spot.id === pickedDraftId ? { ...spot, label } : spot)));
  };
  // Removing is only allowed for a spot that isn't currently assigned to someone —
  // deleting an assigned space would orphan that person's spot.
  const isSpaceAssigned = (id: number) => spaces.some((space) => space.id === id && space.status === 'assigned');
  const deletePicked = () => {
    if (pickedDraftId == null) return;
    if (isSpaceAssigned(pickedDraftId)) {
      log('arrange', `refuse delete: spot ${pickedDraftId} is assigned`);
      return;
    }
    setDraft((current) => current.filter((spot) => spot.id !== pickedDraftId));
    setPickedDraftId(null);
  };
  const saveDraft = () => {
    if (selectedLotId == null) return;
    log('arrange', `save layout on lot ${selectedLotId}: ${draft.length} spots`);
    const payload = draft.map((spot) => ({
      // omit the id for new (negative) spots so the server creates them
      ...(spot.id > 0 ? { id: spot.id } : {}),
      label: spot.label, x: spot.x, y: spot.y, w: spot.w, h: spot.h, rotation: spot.rotation,
    }));
    dispatch(saveLayout({ lotId: selectedLotId, spaces: payload as never }))
      .then((result) => { if (saveLayout.fulfilled.match(result)) dispatch(setEditAction(null)); });
  };

  const submitCreateLot = () => {
    const name = lotName.trim();
    if (!name) return;
    const number = lotNumber.trim() ? Number(lotNumber) : undefined;
    const capacity = lotCapacity.trim() ? Number(lotCapacity) : undefined;
    dispatch(createLot({ name, number, capacity })).then((result) => {
      if (createLot.fulfilled.match(result)) { setShowAddLot(false); setLotName(''); setLotNumber(''); setLotCapacity(''); }
    });
  };

  const removeSelectedLot = () => {
    if (selectedLotId == null || selectedLot == null) return;
    if (spaces.some((space) => space.status === 'assigned')) return; // guarded in UI too
    if (!window.confirm(`Remove "${selectedLot.name}" and all its spaces? This can't be undone.`)) return;
    log('ui', `remove lot ${selectedLotId} (${selectedLot.name})`);
    dispatch(deleteLot(selectedLotId));
  };

  const onMapFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedLotId != null) {
      log('map', `upload "${file.name}" (${Math.round(file.size / 1024)}KB) to lot ${selectedLotId}`);
      dispatch(uploadLotMap({ lotId: selectedLotId, file }));
    }
    event.target.value = '';
  };

  // ===== styles =====
  const containerStyle = { display: 'flex', height: '100vh', flexDirection: 'column' as const, backgroundColor: '#666', color: 'white', fontFamily: 'Arial, sans-serif' };
  const headerStyle = { backgroundColor: '#b33', padding: '10px 20px', display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' as const, height: '50px' };
  const contentWrapperStyle = { display: 'flex', flex: 1, position: 'relative' as const, overflow: 'hidden' };
  const sidebarStyle = { width: '190px', flexShrink: 0, padding: '20px', display: 'flex', flexDirection: 'column' as const, gap: '16px', zIndex: 10, overflowY: 'auto' as const };
  const controlPanelStyle = { backgroundColor: isControlPanelActive ? 'rgba(255,255,255,0.2)' : 'rgba(180,180,180,0.2)', borderRadius: '15px', padding: '10px', display: 'flex', flexDirection: 'column' as const, gap: '5px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.3)' };
  const controlHeaderStyle = { backgroundColor: 'white', color: 'black', borderRadius: '10px', padding: '5px 10px', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' as const, marginBottom: '5px' };
  const sideButtonStyle = (active: boolean, disabled: boolean) => ({ backgroundColor: disabled ? '#b4b4b4' : active ? '#d99' : '#e99', border: '1px solid #844', padding: '8px', borderRadius: '2px', color: '#333', fontSize: '0.9rem', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'center' as const, opacity: disabled ? 0.65 : 1 });
  const accountSectionStyle = { backgroundColor: '#e0e0e0', borderRadius: '15px', padding: '10px', color: '#333', display: 'flex', alignItems: 'center' as const, gap: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', cursor: 'pointer' };
  const mainContentStyle = { flex: 1, minWidth: 0, padding: '40px', position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' as const };
  const innerCanvasStyle = { backgroundColor: '#d0d0d0', width: '100%', height: '100%', borderRadius: '4px', position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' as const, justifyContent: 'center' as const, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)', border: isEditMode ? '4px solid #f09' : 'none', overflow: 'hidden' as const };
  const lotNavigationStyle = { display: 'flex', gap: '5px', flexWrap: 'wrap' as const, position: 'absolute' as const, bottom: '20px', backgroundColor: 'rgba(200,100,100,0.6)', padding: '5px', borderRadius: '2px', zIndex: 20, maxWidth: '80%' };
  const lotButtonStyle = (active: boolean) => ({ backgroundColor: active ? '#a55' : '#e99', border: '1px solid #844', padding: '5px 10px', color: 'black', cursor: 'pointer', fontSize: '0.85rem' });
  const editControlsStyle = { position: 'absolute' as const, top: '10px', right: '10px', display: 'flex', gap: '10px', zIndex: 20 };
  const zoomButtonStyle: React.CSSProperties = { backgroundColor: '#e99', border: '1px solid #844', borderRadius: '4px', color: '#333', cursor: 'pointer', padding: '2px 8px', fontSize: '0.85rem', lineHeight: 1.2 };

  const spotBoxStyle = (space: Space): React.CSSProperties => ({
    // size is a fraction of the map, so the slot-to-map ratio holds at any zoom
    position: 'absolute', left: `${(space.x ?? 0) * 100}%`, top: `${(space.y ?? 0) * 100}%`,
    width: `${(space.w ?? DEFAULT_SPOT_W) * 100}%`, height: `${(space.h ?? DEFAULT_SPOT_H) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${space.rotation ?? 0}deg)`,
    backgroundColor: spaceColor(space),
    border: isRequestedSpot(space) ? '3px dashed #2e7d32' : selectedSpaces.includes(space.id) ? '2px solid #c8a000' : '1px solid #1a3d7a',
    boxShadow: isRequestedSpot(space) ? '0 0 0 2px rgba(46,125,50,0.4)' : undefined,
    boxSizing: 'border-box', cursor: (isSelecting || editAction === 'manual') ? 'pointer' : 'default',
  });

  const renderLotBody = () => {
    if (status === 'loading' && spaces.length === 0) return <div style={{ color: '#333' }}>Loading…</div>;
    if (error && spaces.length === 0) return <div style={{ color: '#900' }}>{error}</div>;

    // The uploaded lot map. Rendered in every view that has one (not just the
    // authored-layout / arrange views) so "Update School Map" is visible even
    // for a lot with no spaces or positionless spaces.
    const mapImg = (widthPx: number) =>
      selectedLot?.map_image_url
        ? <img src={selectedLot.map_image_url} alt={selectedLot.name} draggable={false} style={{ display: 'block', width: `${widthPx}px`, height: 'auto', maxWidth: 'none', userSelect: 'none' }} />
        : null;

    // Arrange editor
    if (isArranging) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            ref={mapBoxRef}
            onPointerMove={onMapPointerMove}
            onPointerUp={onMapPointerUp}
            style={{ position: 'relative', display: 'inline-block', cursor: 'default', background: '#eee', touchAction: 'none' }}
          >
            {selectedLot?.map_image_url
              ? <img src={selectedLot.map_image_url} alt={selectedLot.name} draggable={false} style={{ display: 'block', width: `${Math.round(620 * lotZoom)}px`, height: 'auto', maxWidth: 'none', userSelect: 'none' }} />
              : <div style={{ width: `${Math.round(520 * lotZoom)}px`, height: `${Math.round(360 * lotZoom)}px` }} />}
            {draft.map((spot) => (
              <div
                key={spot.id}
                {...draftHoverProps(spot)}
                onPointerDown={(event) => onSpotPointerDown(event, spot.id)}
                style={{
                  position: 'absolute', left: `${spot.x * 100}%`, top: `${spot.y * 100}%`,
                  width: `${spot.w * 100}%`, height: `${spot.h * 100}%`, transform: `translate(-50%, -50%) rotate(${spot.rotation}deg)`,
                  // match the lot view: assigned = blue, available (incl. new/unsaved) = yellow
                  backgroundColor: isSpaceAssigned(spot.id) ? 'rgba(122,167,255,0.85)' : 'rgba(255,235,59,0.8)', border: pickedDraftId === spot.id ? '2px solid #f5c542' : '1px solid #1a3d7a',
                  boxSizing: 'border-box', cursor: 'grab', touchAction: 'none',
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#333' }}>
            Press <b>➕ Add Spot</b> to add a spot · drag a spot to move it · drag the empty map to pan (scroll to zoom) · pick one, then resize it (Bigger/Wider/Taller…) to fit the space on the map · rotate CW/CCW by your chosen angle · delete.
          </div>
        </div>
      );
    }

    if (spaces.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {mapImg(Math.round(620 * lotZoom))}
          <div style={{ color: '#333' }}>No spaces in this lot yet.</div>
        </div>
      );
    }

    // Authored layout — spots positioned on the lot map by normalized coords.
    if (hasAuthoredLayout) {
      const mapW = Math.round(620 * lotZoom);
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {selectedLot?.map_image_url
            ? <img src={selectedLot.map_image_url} alt={selectedLot.name} draggable={false} style={{ display: 'block', width: `${mapW}px`, height: 'auto', maxWidth: 'none', userSelect: 'none' }} />
            : <div style={{ width: `${Math.round(520 * lotZoom)}px`, height: `${Math.round(360 * lotZoom)}px`, background: '#eee' }} />}
          {spaces.filter((space) => space.x != null).map((space) => (
            <div key={space.id} {...hoverProps(space)} onClick={() => handleSpaceClick(space)} style={spotBoxStyle(space)} />
          ))}
        </div>
      );
    }

    // Fallback grid — positionless spaces coloured by status. Show the uploaded
    // map above the grid so the admin can see it before arranging spots on it.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        {mapImg(Math.round(620 * lotZoom))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: `${Math.round(420 * lotZoom)}px`, justifyContent: 'center' }}>
        {spaces.map((space) => (
          <div
            key={space.id}
            {...hoverProps(space)}
            onClick={() => handleSpaceClick(space)}
            style={{
              width: `${Math.round(30 * lotZoom)}px`, height: `${Math.round(14 * lotZoom)}px`, backgroundColor: spaceColor(space),
              border: isRequestedSpot(space) ? '3px dashed #2e7d32' : selectedSpaces.includes(space.id) ? '2px solid #c8a000' : '1px solid #1a3d7a',
              cursor: (isSelecting || editAction === 'manual') ? 'pointer' : 'default', boxSizing: 'border-box',
            }}
          />
        ))}
      </div>
      </div>
    );
  };

  const noneSelected = selectedSpaces.length === 0;
  // Pending requests for the lot being assigned (earliest first = first-come order),
  // kept apart from requests for other lots so the admin sees who wants THIS lot.
  const pendingForLot = selectedLotId == null
    ? []
    : interestList.filter((request) => request.lot_id === selectedLotId).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  const pendingOther = interestList.filter((request) => request.lot_id !== selectedLotId);
  const requestLabel = (request: Interest) => request.user_name ?? `Student #${request.user_id}`;
  // The specific spot(s) the student picked, or a hint when they only expressed lot interest.
  const requestedSpotText = (request: Interest) =>
    request.space_labels?.length ? request.space_labels.join(', ') : 'no specific spot';
  const lotHasAssigned = spaces.some((space) => space.status === 'assigned'); // can't remove such a lot

  // --- assigned-spot actions (used by the "Assign to Spot" sub-panel) ---
  const clearAssignedPick = () => { setAssignedPick(null); setMoveLotId(null); };
  const doUnassign = () => {
    if (!assignedPick || selectedLotId == null) return;
    const who = assignedPick.assigned_user_name ?? `user #${assignedPick.assigned_user_id ?? '?'}`;
    if (!window.confirm(`Unassign ${who} from ${assignedPick.label}? Their request goes back to the pending queue.`)) return;
    log('assign', `unassign space ${assignedPick.id} (${who})`);
    dispatch(unassignSpace({ spaceId: assignedPick.id, lotId: selectedLotId })).then(() => dispatch(fetchSpaces(selectedLotId)));
    clearAssignedPick();
  };
  const doMove = () => {
    if (!assignedPick || moveLotId == null || selectedLotId == null) return;
    const fromLotId = selectedLotId;
    log('assign', `move space ${assignedPick.id} request → lot ${moveLotId}`);
    dispatch(moveAssignment({ fromSpaceId: assignedPick.id, toLotId: moveLotId })).then(() => {
      dispatch(fetchSpaces(fromLotId)); // freed spot becomes available here
      clearAssignedPick();
    });
  };
  const pickedDraft = draft.find((spot) => spot.id === pickedDraftId) ?? null;
  const pickedAssigned = pickedDraft != null && isSpaceAssigned(pickedDraft.id);

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>LTRide</div>
        <div style={{ fontSize: '0.9rem' }}>Logged in as {user?.name}</div>
      </header>

      {showAddLot && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'white', color: '#333', borderRadius: '10px', padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Create Parking Lot</div>
            <label style={{ fontSize: '0.85rem' }}>Name
              <input autoFocus value={lotName} onChange={(event) => setLotName(event.target.value)} style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: '0.85rem' }}>Lot number (optional — prefixes spot labels, e.g. 7-1)
              <input type="number" min={0} value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: '0.85rem' }}>Capacity (optional)
              <input type="number" min={0} value={lotCapacity} onChange={(event) => setLotCapacity(event.target.value)} style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box' }} />
            </label>
            {error && <p style={{ color: 'red', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddLot(false); dispatch(clearError()); }} style={{ padding: '6px 16px' }}>Cancel</button>
              <button onClick={submitCreateLot} disabled={!lotName.trim()} style={{ padding: '6px 16px', backgroundColor: lotName.trim() ? '#b33' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: lotName.trim() ? 'pointer' : 'not-allowed' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      <div style={contentWrapperStyle}>
        <aside style={sidebarStyle}>
          {isAdmin && (
            <>
              <div style={controlPanelStyle}>
                <div style={controlHeaderStyle}>Admin Control Board</div>
                <button style={sideButtonStyle(false, false)} title="Create a new parking lot (name + optional lot number)." onClick={() => { log('ui', 'open Add Lot modal'); setShowAddLot(true); }}>➕ Add Lot</button>
                <button style={sideButtonStyle(managingStudents, false)} title="Manage the student roster: search, add/edit/delete, upload a CSV, and assign or move students to lots." onClick={() => { log('ui', `student management → ${!managingStudents}`); setManagingStudents((current) => !current); }}>👥 Student Management</button>
                <button style={sideButtonStyle(editAction === 'single', selectedLotId == null)} title="Take spots in/out of service. Select spots on the map, then Disable or Enable them." onClick={() => { log('ui', 'action → slot enable/disable'); dispatch(setEditAction('single')); }} disabled={selectedLotId == null}>Slot Enable/Disable</button>
                <button style={sideButtonStyle(editAction === 'manual', selectedLotId == null)} title="Assign a student's request to a spot, unassign, or move an assigned spot to another lot." onClick={() => { log('ui', 'action → assign to spot'); clearAssignedPick(); dispatch(setEditAction('manual')); }} disabled={selectedLotId == null}>Assign to Spot</button>
                <button style={sideButtonStyle(isArranging, selectedLotId == null)} title="Place, move, resize, and rotate spots on the lot map, then Save Layout." onClick={startArrange} disabled={selectedLotId == null}>Arrange Spots</button>
                <button style={sideButtonStyle(editAction === 'update', selectedLotId == null)} title="Upload a new map image (PNG/JPG) for this lot." onClick={() => { log('ui', 'action → update school map (opening file picker)'); dispatch(setEditAction('update')); fileInputRef.current?.click(); }} disabled={selectedLotId == null}>Update School Map</button>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={onMapFileChosen} />
                <button
                  style={sideButtonStyle(false, selectedLotId == null || lotHasAssigned)}
                  onClick={removeSelectedLot}
                  disabled={selectedLotId == null || lotHasAssigned}
                  title={lotHasAssigned ? 'This lot has assigned spaces — unassign them first' : 'Delete this lot and all its spots. Only allowed when no spot is assigned.'}
                >🗑 Remove Lot</button>
                {selectedLotId != null && lotHasAssigned && (
                  <span style={{ fontSize: '0.7rem', color: '#fdd' }}>Lot has assigned spaces — can’t remove.</span>
                )}
              </div>

              {editAction === 'single' && (
                <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.8rem' }}>
                  <b>Slot Enable/Disable</b>
                  <div style={{ color: '#555' }}>Click spots on the map to select them ({selectedSpaces.length} selected), then:</div>
                  <button style={sideButtonStyle(false, selectedLotId == null || noneSelected)} onClick={() => { if (selectedLotId != null) { log('ui', `disable spaces [${selectedSpaces.join(',')}]`); dispatch(updateSpaces({ lotId: selectedLotId, ids: selectedSpaces, status: 'disabled' })); } }} disabled={selectedLotId == null || noneSelected} title="Take the selected spots out of service (grey).">Disable selected</button>
                  <button style={sideButtonStyle(false, selectedLotId == null || noneSelected)} onClick={() => { if (selectedLotId != null) { log('ui', `enable spaces [${selectedSpaces.join(',')}]`); dispatch(updateSpaces({ lotId: selectedLotId, ids: selectedSpaces, status: 'available' })); } }} disabled={selectedLotId == null || noneSelected} title="Put the selected spots back into service (available/yellow).">Enable selected</button>
                </div>
              )}

              {editAction === 'manual' && (
                <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', fontSize: '0.8rem' }}>
                  <b>Assign to Spot</b>
                  <div style={{ color: '#555', margin: '2px 0 6px' }}>Pick a request below, then click an available (yellow) spot to assign · or click an assigned (blue) spot to unassign or move it.</div>

                  {assignedPick && (
                    <div style={{ border: '1px solid #7aa7ff', borderRadius: '6px', padding: '6px', margin: '2px 0 8px', background: '#f2f6ff' }}>
                      <div style={{ marginBottom: '4px' }}>Selected: <b>{assignedPick.assigned_user_name ?? `user #${assignedPick.assigned_user_id ?? '?'}`}</b> @ {assignedPick.label}</div>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                        <button style={{ ...sideButtonStyle(false, false), flex: 1 }} onClick={doUnassign}>Unassign</button>
                        <button style={{ ...sideButtonStyle(false, false), flex: 1 }} onClick={clearAssignedPick}>Cancel</button>
                      </div>
                      <div style={{ color: '#1a3d7a', marginBottom: '2px' }}>…or move their request to another lot:</div>
                      <select style={{ width: '100%', padding: '3px', boxSizing: 'border-box' }} value={moveLotId ?? ''} onChange={(event) => setMoveLotId(Number(event.target.value))}>
                        <option value="" disabled>Choose lot…</option>
                        {lots.filter((lot) => lot.id !== selectedLotId).map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
                      </select>
                      <div style={{ color: '#777', fontSize: '0.7rem', margin: '3px 0' }}>Frees this spot and queues them as pending in that lot — open it to assign a spot.</div>
                      <button style={sideButtonStyle(true, moveLotId == null)} disabled={moveLotId == null} onClick={doMove}>Move request</button>
                    </div>
                  )}

                  <b>Requests for this lot ({pendingForLot.length})</b>
                  {pendingForLot.length === 0 && <div style={{ color: '#666' }}>No student has requested this lot.</div>}
                  {pendingForLot.map((request, index) => (
                    <div key={request.id} onClick={() => setPickedInterest(request)} style={{ padding: '5px 6px', cursor: 'pointer', borderRadius: '4px', background: pickedInterest?.id === request.id ? '#f5c542' : '#f2f2f2', marginTop: '4px', display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                      <span><b>{requestLabel(request)}</b> <span style={{ color: '#1a3d7a' }}>· wants spot {requestedSpotText(request)}</span></span>
                      <span style={{ color: '#888' }}>#{index + 1}</span>
                    </div>
                  ))}
                  {pickedInterest?.lot_id === selectedLotId && <div style={{ marginTop: '6px', color: '#1a3d7a' }}>Approving <b>{requestLabel(pickedInterest)}</b> (wants spot {requestedSpotText(pickedInterest)}) — now click an available space →</div>}

                  {pendingOther.length > 0 && (
                    <div style={{ marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '6px' }}>
                      <div style={{ color: '#666', marginBottom: '2px' }}>Requests for other lots — select that lot to assign:</div>
                      {pendingOther.map((request) => (
                        <div key={request.id} style={{ padding: '3px 6px', color: '#666' }}>
                          {requestLabel(request)} → {request.lot_name ?? `lot ${request.lot_id}`} · spot {requestedSpotText(request)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isArranging && (
                <div style={{ background: '#fff', color: '#000', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.85rem' }}>
                  <b>Arrange</b>
                  <button style={sideButtonStyle(false, false)} onClick={() => addSpotToDraft(0.5, 0.5)}>➕ Add Spot</button>
                  <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    Spot label{pickedDraft ? (pickedAssigned ? ' · assigned' : '') : ' · pick a spot first'}
                    <input
                      value={pickedDraft?.label ?? ''}
                      disabled={pickedDraftId == null}
                      onChange={(event) => renamePicked(event.target.value)}
                      placeholder={pickedDraftId == null ? 'pick a spot to name it' : 'e.g. A1'}
                      style={{ padding: '4px', boxSizing: 'border-box' }}
                    />
                  </label>
                  <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '2px' }}>Fit the picked spot to the map:</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1 }} onClick={() => scalePicked(1.15)} disabled={pickedDraftId == null}>Bigger ⤢</button>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1 }} onClick={() => scalePicked(0.87)} disabled={pickedDraftId == null}>Smaller ⤡</button>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1 }} onClick={() => resizePicked(0.006, 0)} disabled={pickedDraftId == null}>Wider</button>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1 }} onClick={() => resizePicked(-0.006, 0)} disabled={pickedDraftId == null}>Narrower</button>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1 }} onClick={() => resizePicked(0, 0.006)} disabled={pickedDraftId == null}>Taller</button>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1 }} onClick={() => resizePicked(0, -0.006)} disabled={pickedDraftId == null}>Shorter</button>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1, fontSize: '1.6rem', lineHeight: 1, padding: '4px 0' }} onClick={() => rotatePicked(-1)} disabled={pickedDraftId == null} title="Rotate counter-clockwise">↺</button>
                    <button style={{ ...sideButtonStyle(false, pickedDraftId == null), flex: 1, fontSize: '1.6rem', lineHeight: 1, padding: '4px 0' }} onClick={() => rotatePicked(1)} disabled={pickedDraftId == null} title="Rotate clockwise">↻</button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#555' }}>
                    Angle
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={rotateStep}
                      onChange={(event) => setRotateStep(event.target.value)}
                      style={{ width: '56px', padding: '4px', boxSizing: 'border-box' }}
                    />
                    ° per click
                  </label>
                  <button style={sideButtonStyle(false, pickedDraftId == null || pickedAssigned)} onClick={deletePicked} disabled={pickedDraftId == null || pickedAssigned} title={pickedAssigned ? 'Assigned spots can’t be removed — reassign first' : undefined}>Delete</button>
                  {pickedAssigned && <span style={{ fontSize: '0.7rem', color: '#a55' }}>This spot is assigned — reassign before removing.</span>}
                  <button style={sideButtonStyle(true, false)} onClick={saveDraft}>Save Layout</button>
                  {error && <span style={{ color: 'red' }}>{error}</span>}
                </div>
              )}
            </>
          )}

          <div style={accountSectionStyle} onClick={onLogout}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
            <span style={{ fontWeight: 'bold' }}>Logout</span>
          </div>
        </aside>

        <main style={mainContentStyle}>
          {managingStudents && isAdmin && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
              <StudentManagement onClose={() => setManagingStudents(false)} />
            </div>
          )}
          <div
            ref={canvasRef}
            style={innerCanvasStyle}
            onMouseDown={selectedLotId === null ? handleMouseDown : undefined}
            onMouseMove={selectedLotId === null ? handleMouseMove : undefined}
            onMouseUp={selectedLotId === null ? handleMouseUp : undefined}
            onMouseLeave={selectedLotId === null ? handleMouseUp : undefined}
          >
            {isEditMode && (
              <div style={editControlsStyle}>
                <button style={{ backgroundColor: '#e77', border: '1px solid #000', borderRadius: '10px', padding: '5px 15px', color: 'white', cursor: 'pointer' }} onClick={() => dispatch(setIsEditMode(false))}>Cancel ✕</button>
              </div>
            )}

            {selectedLotId === null && (
              <>
                <button onClick={initMapTransform} style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>Reset View</button>
                <img
                  ref={imgRef}
                  src="/Lake%20Travis%20Parking%20Blank%20(1).jpg"
                  alt="Campus Map"
                  draggable={false}
                  onLoad={initMapTransform}
                  style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${mapOffset.x}px, ${mapOffset.y}px) scale(${mapScale})`, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', pointerEvents: 'none', zIndex: 1 }}
                />
              </>
            )}

            {selectedLotId !== null && (
              <div
                ref={lotScrollRef}
                style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', overflow: 'hidden', padding: '10px', boxSizing: 'border-box' }}
              >
                {selectedLot && selectedLot.capacity === 0 && (
                  <div style={{ color: '#333', marginBottom: '8px', fontSize: '0.85rem' }}>
                    This lot has no spaces yet. Use <b>Update School Map</b> then <b>Arrange Spots</b> to set it up.
                  </div>
                )}
                {(spaces.length > 0 || isArranging) && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', color: '#333', fontSize: '0.8rem' }}>
                    <span>Zoom</span>
                    <button style={zoomButtonStyle} onClick={() => zoomBy(1 / 1.2)} title="Shrink">−</button>
                    <span style={{ minWidth: '46px', textAlign: 'center', fontWeight: 'bold' }}>{Math.round(lotZoom * 100)}%</span>
                    <button style={zoomButtonStyle} onClick={() => zoomBy(1.2)} title="Expand">＋</button>
                    <button style={zoomButtonStyle} onClick={() => { setLotZoom(1); setLotOffset({ x: 0, y: 0 }); }} title="Reset view">Reset</button>
                    <span style={{ color: '#666' }}>· drag {isArranging ? 'the empty map' : 'the map'} to move · scroll to zoom</span>
                  </div>
                )}
                {/* the map lives in a translate layer so it pans freely in any direction */}
                <div
                  ref={lotMapWrapRef}
                  onMouseDown={onLotMouseDown}
                  onMouseMove={onLotMouseMove}
                  onMouseUp={endLotPan}
                  onMouseLeave={endLotPan}
                  style={{ display: 'inline-block', transform: `translate(${lotOffset.x}px, ${lotOffset.y}px)`, transformOrigin: '0 0', cursor: 'grab', touchAction: 'none' }}
                >
                  {renderLotBody()}
                </div>
              </div>
            )}

            <div style={lotNavigationStyle}>
              <button style={lotButtonStyle(selectedLotId === null)} onClick={() => { log('ui', 'nav → Home'); resetLotView(); clearAssignedPick(); dispatch(setSelectedLot(null)); }}>Home</button>
              {lots.map((lot) => (
                <button key={lot.id} style={lotButtonStyle(selectedLotId === lot.id)} onClick={() => { log('ui', `nav → lot ${lot.id} (${lot.name})`); resetLotView(); clearAssignedPick(); dispatch(setSelectedLot(lot.id)); }}>{lot.name}</button>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
              <span>Edit Mode</span>
              <div style={{ width: '40px', height: '20px', backgroundColor: isEditMode ? '#fff' : '#444', borderRadius: '10px', position: 'relative', cursor: 'pointer' }} onClick={() => { log('ui', `toggle edit chrome → ${!isEditMode}`); dispatch(toggleEditMode()); }}>
                <div style={{ width: '16px', height: '16px', backgroundColor: isEditMode ? '#444' : '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: isEditMode ? '22px' : '2px', transition: 'left 0.2s' }} />
              </div>
            </div>
          )}
        </main>
      </div>

      {tip && (
        <div
          style={{
            position: 'fixed', left: tip.x + 14, top: tip.y + 14, zIndex: 200, pointerEvents: 'none',
            background: 'rgba(0,0,0,0.88)', color: 'white', padding: '6px 9px', borderRadius: '6px',
            fontSize: '0.75rem', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <b>Spot {tip.label}</b> — {tip.summary}
        </div>
      )}
    </div>
  );
};
