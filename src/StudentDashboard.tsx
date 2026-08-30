import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { logout } from './store/authSlice';
import { fetchLots, fetchSpaces, type Space } from './store/parkingSlice';
import { fetchMyInterest, registerInterest, withdrawInterest } from './store/interestSlice';
import { log } from './lib/log';

const CAMPUS_MAP = '/Lake%20Travis%20Parking%20Blank%20(1).jpg';
const DEFAULT_SPOT_W = 0.05;
const DEFAULT_SPOT_H = 0.03;

// The student's map view — the same campus/lot browsing the admin sees, minus the
// admin sidebar. Students click available (yellow) spots to select them, then submit
// a request for the chosen spots. Reuses the admin view's pan/zoom techniques.
export default function StudentDashboard() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const lots = useAppSelector((state) => state.parking.lots);
  const spacesByLot = useAppSelector((state) => state.parking.spacesByLot);
  const { mine, status, error } = useAppSelector((state) => state.interest);

  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null); // the one available spot chosen in the current lot
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null); // hover tooltip

  // --- campus (Home) pan/zoom ---
  const [mapScale, setMapScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startOX: 0, startOY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const mapStateRef = useRef({ scale: 1, x: 0, y: 0 });

  // --- lot-view pan/zoom ---
  const [lotZoom, setLotZoom] = useState(1);
  const [lotOffset, setLotOffset] = useState({ x: 0, y: 0 });
  const lotScrollRef = useRef<HTMLDivElement>(null);
  const lotMapWrapRef = useRef<HTMLDivElement>(null);
  const lotPanRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, panning: false, moved: false });
  const lotViewRef = useRef({ zoom: 1, x: 0, y: 0 });

  const spaces = selectedLotId != null ? (spacesByLot[selectedLotId] ?? []) : [];
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null;
  const hasAuthoredLayout = spaces.some((space) => space.x != null && space.y != null);
  const pickedLabel = spaces.find((space) => space.id === picked)?.label ?? '';
  // An active (submitted) request locks selection; the student must withdraw to change it.
  const hasActiveRequest = mine != null && mine.status !== 'cancelled';
  const canPick = !hasActiveRequest;
  const statusLabel = (value?: string) => {
    if (value === 'fulfilled') return 'Approved — spot assigned';
    if (value === 'pending') return 'Pending approval';
    if (value === 'cancelled') return 'Withdrawn';
    return value ?? '';
  };

  useEffect(() => { dispatch(fetchLots()); dispatch(fetchMyInterest()); }, [dispatch]);
  useEffect(() => { if (selectedLotId != null) dispatch(fetchSpaces(selectedLotId)); }, [selectedLotId, dispatch]);

  // Enter/leave a lot: reset the selection and this lot's zoom/pan. If the student
  // already has a request in this lot, pre-load its picks so they can adjust them.
  const enterLot = (lotId: number | null) => {
    log('ui', `student nav → ${lotId ?? 'Home'}`);
    setSelectedLotId(lotId);
    setPicked(lotId != null && mine?.lot_id === lotId ? (mine.space_ids?.[0] ?? null) : null);
    setLotZoom(1);
    setLotOffset({ x: 0, y: 0 });
  };

  // Only one spot may be requested — picking a new one replaces the previous;
  // clicking the already-picked spot clears it.
  const togglePick = (space: Space) => {
    if (!canPick || lotPanRef.current.moved || space.status !== 'available') return;
    log('ui', `student pick spot ${space.id} (${space.label})`);
setPicked((prev) => prev === space.id ? null : space.id);
  };

  const submit = () => {
    if (selectedLotId == null || picked == null) return;
    log('ui', `student submit request lot ${selectedLotId} spot ${picked}`);
    dispatch(registerInterest({ lotId: selectedLotId, spaceIds: [picked] }))
      .then(() => { dispatch(fetchMyInterest()); dispatch(fetchSpaces(selectedLotId)); });
  };
  const withdraw = () => {
    if (!window.confirm('Withdraw your request? This rescinds your current spot so you can pick a different one.')) return;
    log('ui', 'student withdraw request');
    dispatch(withdrawInterest()).then(() => setPicked(null));
  };

  // --- campus map: fit to the canvas, drag to pan, wheel to zoom (cursor-anchored) ---
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
  useEffect(() => { if (selectedLotId === null) initMapTransform(); }, [selectedLotId]);
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
  const onCampusDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = { startX: event.clientX, startY: event.clientY, startOX: mapOffset.x, startOY: mapOffset.y };
  };
  const onCampusMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    const nextX = dragRef.current.startOX + (event.clientX - dragRef.current.startX);
    const nextY = dragRef.current.startOY + (event.clientY - dragRef.current.startY);
    mapStateRef.current = { ...mapStateRef.current, x: nextX, y: nextY };
    setMapOffset({ x: nextX, y: nextY });
  };
  const endCampusDrag = () => setIsDragging(false);

  // --- lot map: drag to pan (a translate layer), wheel to zoom at the cursor ---
  const onLotMouseDown = (event: React.MouseEvent) => {
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
  useEffect(() => { lotViewRef.current = { zoom: lotZoom, x: lotOffset.x, y: lotOffset.y }; }, [lotZoom, lotOffset]);
  useEffect(() => {
    const el = lotScrollRef.current;
    if (!el || selectedLotId === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { zoom, x, y } = lotViewRef.current;
      const next = Math.min(4, Math.max(0.4, +(zoom * (event.deltaY < 0 ? 1.1 : 0.9)).toFixed(2)));
      const ratio = next / zoom;
      const wrap = lotMapWrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        setLotOffset({ x: x + (event.clientX - rect.left) * (1 - ratio), y: y + (event.clientY - rect.top) * (1 - ratio) });
      }
      setLotZoom(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [selectedLotId]);
  const zoomBy = (factor: number) => setLotZoom((z) => Math.min(4, Math.max(0.4, +(z * factor).toFixed(2))));

  // Tooltip text: lot number + spot + availability, shown while hovering a spot.
  const spaceAvailability = (space: Space) => {
    if (picked === space.id) return 'Selected by you';
    if (space.status === 'available') return 'Available';
    if (space.status === 'assigned') return 'Taken';
    return 'Unavailable';
  };
  const hoverProps = (space: Space) => {
    const text = `Lot ${selectedLot?.number ?? selectedLot?.name} · Spot ${space.label} — ${spaceAvailability(space)}`;
    return {
      onMouseEnter: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, text }),
      onMouseMove: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, text }),
      onMouseLeave: () => setTip(null),
    };
  };

  const spaceColor = (space: Space) => {
    if (picked === space.id) return '#38c172';                // green = chosen by me
    if (space.status === 'disabled') return '#aaa';           // grey
    if (space.status === 'assigned') return '#7aa7ff';        // blue = taken
    return '#ffeb3b';                                         // available (yellow)
  };
  const spotBoxStyle = (space: Space): React.CSSProperties => ({
    position: 'absolute', left: `${(space.x ?? 0) * 100}%`, top: `${(space.y ?? 0) * 100}%`,
    width: `${(space.w ?? DEFAULT_SPOT_W) * 100}%`, height: `${(space.h ?? DEFAULT_SPOT_H) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${space.rotation ?? 0}deg)`,
    backgroundColor: spaceColor(space), border: picked === space.id ? '2px solid #157347' : '1px solid #1a3d7a',
    boxSizing: 'border-box', cursor: canPick && space.status === 'available' ? 'pointer' : 'default',
  });

  const renderLotBody = () => {
    if (status === 'loading' && spaces.length === 0) return <div style={{ color: '#333' }}>Loading…</div>;
    const mapImg = (widthPx: number) =>
      selectedLot?.map_image_url
        ? <img src={selectedLot.map_image_url} alt={selectedLot.name} draggable={false} style={{ display: 'block', width: `${widthPx}px`, height: 'auto', maxWidth: 'none', userSelect: 'none' }} />
        : null;

    if (spaces.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {mapImg(Math.round(620 * lotZoom))}
          <div style={{ color: '#333' }}>No spaces in this lot yet.</div>
        </div>
      );
    }
    if (hasAuthoredLayout) {
      const mapW = Math.round(620 * lotZoom);
      return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {selectedLot?.map_image_url
            ? <img src={selectedLot.map_image_url} alt={selectedLot.name} draggable={false} style={{ display: 'block', width: `${mapW}px`, height: 'auto', maxWidth: 'none', userSelect: 'none' }} />
            : <div style={{ width: `${Math.round(520 * lotZoom)}px`, height: `${Math.round(360 * lotZoom)}px`, background: '#eee' }} />}
          {spaces.filter((space) => space.x != null).map((space) => (
            <div key={space.id} {...hoverProps(space)} onClick={() => togglePick(space)} style={spotBoxStyle(space)} />
          ))}
        </div>
      );
    }
    // Fallback grid for positionless spaces.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        {mapImg(Math.round(620 * lotZoom))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: `${Math.round(420 * lotZoom)}px`, justifyContent: 'center' }}>
          {spaces.map((space) => (
            <div
              key={space.id}
              {...hoverProps(space)}
              onClick={() => togglePick(space)}
              style={{
                width: `${Math.round(30 * lotZoom)}px`, height: `${Math.round(14 * lotZoom)}px`, backgroundColor: spaceColor(space),
                border: picked === space.id ? '2px solid #157347' : '1px solid #1a3d7a',
                cursor: canPick && space.status === 'available' ? 'pointer' : 'default', boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const containerStyle = { height: '100vh', display: 'flex', flexDirection: 'column' as const, backgroundColor: '#7a5', color: 'white' };
  const headerStyle = { backgroundColor: '#b33', padding: '10px 20px', display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' as const, height: '50px' };
  const mainStyle = { flex: 1, minWidth: 0, padding: '24px', position: 'relative' as const };
  const innerCanvasStyle = { backgroundColor: '#d0d0d0', width: '100%', height: '100%', borderRadius: '4px', position: 'relative' as const, overflow: 'hidden' as const, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' };
  const lotNavigationStyle = { display: 'flex', gap: '5px', flexWrap: 'wrap' as const, position: 'absolute' as const, bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(200,100,100,0.6)', padding: '5px', borderRadius: '2px', zIndex: 20, maxWidth: '80%' };
  const lotButtonStyle = (active: boolean) => ({ backgroundColor: active ? '#a55' : '#e99', border: '1px solid #844', padding: '5px 10px', color: 'black', cursor: 'pointer', fontSize: '0.85rem' });
  const zoomButtonStyle: React.CSSProperties = { backgroundColor: '#e99', border: '1px solid #844', borderRadius: '4px', color: '#333', cursor: 'pointer', padding: '2px 8px', fontSize: '0.85rem' };

  // A one-line summary of the student's current request.
  const requestBanner = () => {
    if (!hasActiveRequest) return 'No parking request yet — open a lot below and pick a spot.';
    const where = mine?.space_labels?.length ? `${mine.lot_name} · ${mine.space_labels.join(', ')}` : (mine?.lot_name ?? `lot #${mine?.lot_id}`);
    return `Your request: ${where} — ${statusLabel(mine?.status)}`;
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>LTRide</div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '0.9rem' }}>
          <span>Logged in as {user?.name}</span>
          <button onClick={() => dispatch(logout())} style={{ padding: '4px 12px', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
        <span style={{ color: mine?.status === 'fulfilled' ? '#bfffbf' : '#fff' }}>{requestBanner()}</span>
        {mine?.status === 'pending' && (
          <button onClick={withdraw} style={{ padding: '4px 12px', cursor: 'pointer', background: '#933', color: '#fff', border: 'none', borderRadius: '4px' }}>Withdraw request</button>
        )}
      </div>
      {error && <div style={{ background: '#922', padding: '6px 20px', fontSize: '0.85rem' }}>{error}</div>}

      <main style={mainStyle}>
        <div
          ref={canvasRef}
          style={innerCanvasStyle}
          onMouseDown={selectedLotId === null ? onCampusDown : undefined}
          onMouseMove={selectedLotId === null ? onCampusMove : undefined}
          onMouseUp={selectedLotId === null ? endCampusDrag : undefined}
          onMouseLeave={selectedLotId === null ? endCampusDrag : undefined}
        >
          {selectedLotId === null && (
            <>
              <button onClick={initMapTransform} style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>Reset View</button>
              <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem' }}>Pick a lot below to choose your spots</div>
              <img
                ref={imgRef}
                src={CAMPUS_MAP}
                alt="Campus Map"
                draggable={false}
                onLoad={initMapTransform}
                style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${mapOffset.x}px, ${mapOffset.y}px) scale(${mapScale})`, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', pointerEvents: 'none' }}
              />
            </>
          )}

          {selectedLotId !== null && (
            <div ref={lotScrollRef} style={{ width: '100%', height: '100%', overflow: 'hidden', padding: '10px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', color: '#333', fontSize: '0.8rem' }}>
                <b style={{ color: '#111' }}>{selectedLot?.name}</b>
                <span>· Zoom</span>
                <button style={zoomButtonStyle} onClick={() => zoomBy(1 / 1.2)}>−</button>
                <span style={{ minWidth: '46px', textAlign: 'center', fontWeight: 'bold' }}>{Math.round(lotZoom * 100)}%</span>
                <button style={zoomButtonStyle} onClick={() => zoomBy(1.2)}>＋</button>
                <button style={zoomButtonStyle} onClick={() => { setLotZoom(1); setLotOffset({ x: 0, y: 0 }); }}>Reset</button>
                <span style={{ color: '#555' }}>· drag to move · scroll to zoom{canPick ? ' · click one yellow spot to pick' : ' · selection locked (withdraw to change)'}</span>
              </div>
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

          {selectedLotId !== null && (
            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 20, background: 'white', color: '#222', borderRadius: '10px', padding: '12px', width: '210px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              {hasActiveRequest ? (
                <>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Your request</div>
                  <div style={{ fontSize: '0.85rem', color: '#444', marginBottom: '8px' }}>
                    Spot {mine?.space_labels?.join(', ') || '—'} in {mine?.lot_name ?? `lot #${mine?.lot_id}`}.<br />
                    Status: <b>{statusLabel(mine?.status)}</b>
                  </div>
                  {mine?.status === 'pending' ? (
                    <>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>Selection is locked. Withdraw to pick a different spot.</div>
                      <button onClick={withdraw} disabled={status === 'loading'} style={{ width: '100%', padding: '8px', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', background: '#933' }}>Withdraw request</button>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Your spot is approved. Contact an admin to change it.</div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Your selection</div>
                  <div style={{ fontSize: '0.85rem', color: '#444', marginBottom: '8px' }}>
                    {picked == null ? 'Click one available (yellow) spot to request it.' : `Spot ${pickedLabel} chosen in ${selectedLot?.name}.`}
                  </div>
                  <button
                    onClick={submit}
                    disabled={picked == null || status === 'loading'}
                    style={{ width: '100%', padding: '8px', border: 'none', borderRadius: '6px', color: 'white', cursor: picked == null ? 'not-allowed' : 'pointer', background: picked == null ? '#aaa' : '#2e7d32' }}
                  >
                    Submit request
                  </button>
                  {picked != null && (
                    <button onClick={() => setPicked(null)} style={{ width: '100%', marginTop: '6px', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', background: '#f3f3f3', cursor: 'pointer' }}>Clear selection</button>
                  )}
                </>
              )}
            </div>
          )}

          <div style={lotNavigationStyle}>
            <button style={lotButtonStyle(selectedLotId === null)} onClick={() => enterLot(null)}>Home</button>
            {lots.map((lot) => (
              <button key={lot.id} style={lotButtonStyle(selectedLotId === lot.id)} onClick={() => enterLot(lot.id)}>
                {lot.name} ({lot.available_count})
              </button>
            ))}
          </div>
        </div>
      </main>

      {tip && (
        <div
          style={{
            position: 'fixed', left: tip.x + 14, top: tip.y + 14, zIndex: 200, pointerEvents: 'none',
            background: 'rgba(0,0,0,0.88)', color: 'white', padding: '6px 9px', borderRadius: '6px',
            fontSize: '0.75rem', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
