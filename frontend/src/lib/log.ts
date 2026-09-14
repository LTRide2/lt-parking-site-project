// Lightweight console logger for the PoC so we can watch what the app does and
// when, straight from the browser devtools. Each line is scoped and timestamped
// (ms since load). Turn everything off with `localStorage.setItem('ltride.log','off')`.
const start = performance.now();

function stamp(): string {
  return `+${Math.round(performance.now() - start)}ms`;
}

function enabled(): boolean {
  try {
    return localStorage.getItem("ltride.log") !== "off";
  } catch {
    return true;
  }
}

// scope groups lines by area (ui, api, auth, arrange…); data is any extra payload.
export function log(scope: string, message: string, ...data: unknown[]) {
  if (!enabled()) return;
  console.log(
    `%c[LTRide ${scope}]%c ${stamp()} ${message}`,
    "color:#0a7;font-weight:bold",
    "color:#888",
    ...data,
  );
}
