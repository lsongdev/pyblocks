// SPIKE Prime blocks generate LEGO SPIKE App 3 Python. Its runtime modules
// (hub, runloop, motor, ...) only exist inside the SPIKE App; no serial
// MicroPython board provides them, so uploading such a program cannot work.
export function targetsSpikeApp(source) {
  return /^\s*(?:from\s+hub\s+import|import\s+runloop)\b/m.test(source);
}
