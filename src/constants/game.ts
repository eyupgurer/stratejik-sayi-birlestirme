export const BOARD_ROWS = 10;
export const BOARD_COLUMNS = 8;
export const INITIAL_FILLED_ROWS = 3;
export const MIN_SELECTION_LENGTH = 2;
export const MAX_SELECTION_LENGTH = 4;
export const PENALTY_WRONG_COUNT = 3;

export const FALL_STEP_INTERVAL_MS = 160;

export const SCORE_BY_VALUE: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 7,
  6: 9,
  7: 12,
  8: 15,
  9: 20,
};

export const BLOCK_COLORS: Record<number, string> = {
  1: "#f7b267",
  2: "#f4845f",
  3: "#f25c54",
  4: "#d95d39",
  5: "#9a031e",
  6: "#5f0f40",
  7: "#0f4c5c",
  8: "#335c67",
  9: "#2d6a4f",
};

export const APP_COLORS = {
  background: "#08121d",
  panel: "#0f1f2e",
  panelSoft: "#173044",
  panelAlt: "#13293d",
  text: "#f3f7fb",
  textMuted: "#9fb2c5",
  accent: "#ffb703",
  accentSoft: "#ffd166",
  danger: "#ef476f",
  success: "#7bd389",
  selection: "#f4f1de",
  emptyCell: "#112536",
  border: "#274357",
};
