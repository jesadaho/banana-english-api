/** Games-tab starts always cost bananas, including replay. Path เรียนซ้ำ stays free. */
export function isGamesHubStart(from?: string | null): boolean {
  const v = (from ?? '').trim().toLowerCase();
  return v === 'hub' || v === 'world-map' || v === 'games';
}
