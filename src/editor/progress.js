/** Missing progress means an active operation with no known percentage. */
export function updateProgress(element, value) {
  if (Number.isFinite(value)) element.value = Math.max(0, Math.min(1, value));
  else element.removeAttribute('value');
}
