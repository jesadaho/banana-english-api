/** Legacy → successor node IDs for Ch14–16 revamp. Unmapped legacy IDs stay recorded but do not auto-complete new siblings. */
export const FOUNDATION_V7_NODE_MIGRATION: Record<string, string | null> = {
  // Old Ch14 combined question chapter
  v7_u14n07: 'v7_u14n07', // What&Who (pool slimmed)
  v7_u14n01: 'v7_u14n01', // What Is This (closest to What or Who?)
  v7_u14n02: null, // empty describe_it removed
  v7_u14n08: 'v7_u14n08', // Where/Here/There (was Question Clues 2)
  v7_u14n03: 'v7_u14tn01', // When or What Time only — NOT price/quantity siblings
  v7_u14n04: 'v7_u14n04',
  v7_u14n05: null, // empty describe_it removed
  v7_u14n06: 'v7_u14tn08f', // You Ask First / Plan My Class → Find My Class

  // Plan My Class conversation node → Find My Class mini-game
  v7_u14tn08: 'v7_u14tn08f',

  // Old Ch15 Things & Places → displayed Ch16 (same chapter id v7_u15)
  v7_u15n10: 'v7_u15n10',
  v7_u15n01: 'v7_u15n01',
  v7_u15n02: null, // old emoji around-room dropped from path order
  v7_u15n11: 'v7_u15n11',
  v7_u15n12: 'v7_u15n12',
  v7_u15n03: 'v7_u15n03',
  v7_u15n04: 'v7_u15n04',
  v7_u15n05: 'v7_u15n05',
  v7_u15n06: 'v7_u15n06',
  v7_u15n09: 'v7_u15n09',
  v7_u15n07: 'v7_u15n07',
  v7_u15n08: 'v7_u15n08',

  // Around Town removed from A1 — keep completions recorded, no A1 successor
  v7_u16n01: null,
  v7_u16n02: null,
  v7_u16n03: null,
  v7_u16n04: null,
  v7_u16n05: null,
  v7_u16n06: null,
  v7_u16n07: null,
  v7_u16n08: null,
  v7_u16n09: null,
  v7_u16n10: null,
};

/** Legacy simulation completions that credit a live A1 node after mechanic changes. */
export const FOUNDATION_V7_SIMULATION_MIGRATION: Record<string, string> = {
  foundation_v7_u14n06: 'v7_u14tn08f', // Plan My Class → Find My Class
};

export function migrateFoundationV7NodeId(nodeId: string): string | null | undefined {
  if (nodeId in FOUNDATION_V7_NODE_MIGRATION) {
    return FOUNDATION_V7_NODE_MIGRATION[nodeId];
  }
  return undefined;
}
