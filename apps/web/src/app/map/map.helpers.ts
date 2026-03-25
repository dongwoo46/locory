export function slotToTime(slot: number): string {
  const totalMinutes = 6 * 60 + slot * 30;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
