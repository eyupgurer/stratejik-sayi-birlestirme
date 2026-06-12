import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  INITIAL_FILLED_ROWS,
  MAX_SELECTION_LENGTH,
  MIN_SELECTION_LENGTH,
  SCORE_BY_VALUE,
} from "../constants/game";
import { Block, Board, FallingBlock, Position } from "../types/game";

let blockCounter = 0;

function createBlockId() {
  blockCounter += 1;
  return `block-${blockCounter}`;
}

export function createRandomBlock(): Block {
  return {
    id: createBlockId(),
    value: Math.floor(Math.random() * 9) + 1,
  };
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLUMNS }, () => null),
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function createInitialBoard(): Board {
  const board = createEmptyBoard();

  for (let row = BOARD_ROWS - INITIAL_FILLED_ROWS; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      board[row]![col] = createRandomBlock();
    }
  }

  return board;
}

export function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

export function areSamePosition(first: Position, second: Position): boolean {
  return first.row === second.row && first.col === second.col;
}

export function isInsideBoard(position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < BOARD_ROWS &&
    position.col >= 0 &&
    position.col < BOARD_COLUMNS
  );
}

export function areAdjacent(first: Position, second: Position): boolean {
  const rowDistance = Math.abs(first.row - second.row);
  const colDistance = Math.abs(first.col - second.col);

  if (rowDistance === 0 && colDistance === 0) {
    return false;
  }

  return rowDistance <= 1 && colDistance <= 1;
}

export function getBlockAt(board: Board, position: Position) {
  return board[position.row]?.[position.col] ?? null;
}

export function getSelectionSum(board: Board, selection: Position[]): number {
  return selection.reduce((sum, position) => {
    const block = getBlockAt(board, position);
    return sum + (block?.value ?? 0);
  }, 0);
}

export function getSelectionScore(board: Board, selection: Position[]): number {
  return selection.reduce((sum, position) => {
    const block = getBlockAt(board, position);
    if (!block) {
      return sum;
    }

    return sum + SCORE_BY_VALUE[block.value]!;
  }, 0);
}

export function isSelectionChainValid(selection: Position[]): boolean {
  if (
    selection.length < MIN_SELECTION_LENGTH ||
    selection.length > MAX_SELECTION_LENGTH
  ) {
    return false;
  }

  const seen = new Set<string>();

  for (let index = 0; index < selection.length; index += 1) {
    const current = selection[index]!;
    const key = positionKey(current);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);

    if (index === 0) {
      continue;
    }

    const previous = selection[index - 1]!;
    if (!areAdjacent(previous, current)) {
      return false;
    }
  }

  return true;
}

function getNeighborPositions(position: Position): Position[] {
  const neighbors: Position[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const next = {
        row: position.row + rowOffset,
        col: position.col + colOffset,
      };

      if (isInsideBoard(next)) {
        neighbors.push(next);
      }
    }
  }

  return neighbors;
}

function collectTargetCandidates(board: Board): number[] {
  const sums: number[] = [];

  function walk(path: Position[], currentSum: number) {
    if (path.length >= MIN_SELECTION_LENGTH) {
      sums.push(currentSum);
    }

    if (path.length === MAX_SELECTION_LENGTH) {
      return;
    }

    const lastPosition = path[path.length - 1];
    if (!lastPosition) {
      return;
    }

    const usedPositions = new Set(path.map(positionKey));

    for (const neighbor of getNeighborPositions(lastPosition)) {
      if (usedPositions.has(positionKey(neighbor))) {
        continue;
      }

      const block = getBlockAt(board, neighbor);
      if (!block) {
        continue;
      }

      walk([...path, neighbor], currentSum + block.value);
    }
  }

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      const start = { row, col };
      const block = getBlockAt(board, start);
      if (!block) {
        continue;
      }

      walk([start], block.value);
    }
  }

  return sums;
}

export function generateTargetNumber(board: Board): number {
  const sums = collectTargetCandidates(board);

  if (sums.length === 0) {
    return 10;
  }

  return sums[Math.floor(Math.random() * sums.length)]!;
}

export function removeSelectedBlocks(
  board: Board,
  selection: Position[],
): Board {
  const nextBoard = cloneBoard(board);

  for (const position of selection) {
    nextBoard[position.row]![position.col] = null;
  }

  return nextBoard;
}

export function collapseBoard(board: Board): Board {
  const nextBoard = createEmptyBoard();

  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    const blocksInColumn: Block[] = [];

    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      const block = board[row]?.[col] ?? null;
      if (block) {
        blocksInColumn.push(block);
      }
    }

    let writeRow = BOARD_ROWS - 1;
    for (const block of blocksInColumn) {
      nextBoard[writeRow]![col] = block;
      writeRow -= 1;
    }
  }

  return nextBoard;
}

function getInsertRowForColumn(board: Board, col: number): number | null {
  for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
    if (!board[row]?.[col]) {
      return row;
    }
  }

  return null;
}

export function refillBoardAfterClear(
  board: Board,
  newBlockCount: number,
): Board {
  const nextBoard = cloneBoard(board);

  for (let index = 0; index < newBlockCount; index += 1) {
    const availableColumns: number[] = [];

    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      if (getInsertRowForColumn(nextBoard, col) !== null) {
        availableColumns.push(col);
      }
    }

    if (availableColumns.length === 0) {
      break;
    }

    const randomColumn =
      availableColumns[Math.floor(Math.random() * availableColumns.length)]!;
    const insertRow = getInsertRowForColumn(nextBoard, randomColumn);

    if (insertRow !== null) {
      nextBoard[insertRow]![randomColumn] = createRandomBlock();
    }
  }

  return nextBoard;
}

export function getDropIntervalMs(score: number): number {
  if (score >= 400) return 1000;
  if (score >= 300) return 2000;
  if (score >= 200) return 3000;
  if (score >= 100) return 4000;
  return 5000;
}

export function isGameOver(board: Board): boolean {
  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    if (board[0]?.[col] !== null) return true;
  }
  return false;
}

export function applyPenaltyBlocks(board: Board): Board {
  const nextBoard = cloneBoard(board);
  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    const insertRow = getInsertRowForColumn(nextBoard, col);
    if (insertRow !== null) {
      nextBoard[insertRow]![col] = createRandomBlock();
    }
  }
  return nextBoard;
}

export function getAvailableSpawnColumns(board: Board): number[] {
  const columns: number[] = [];

  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    if (!board[0]?.[col]) {
      columns.push(col);
    }
  }

  return columns;
}

export function spawnFallingBlock(board: Board): FallingBlock | null {
  const availableColumns = getAvailableSpawnColumns(board);

  if (availableColumns.length === 0) {
    return null;
  }

  const col =
    availableColumns[Math.floor(Math.random() * availableColumns.length)]!;

  return {
    block: createRandomBlock(),
    row: 0,
    col,
  };
}

export function canMoveFallingBlock(
  board: Board,
  block: FallingBlock,
): boolean {
  const nextRow = block.row + 1;

  if (nextRow >= BOARD_ROWS) {
    return false;
  }

  return !board[nextRow]?.[block.col];
}

export function placeFallingBlock(
  board: Board,
  fallingBlock: FallingBlock,
): Board {
  const nextBoard = cloneBoard(board);
  nextBoard[fallingBlock.row]![fallingBlock.col] = fallingBlock.block;
  return nextBoard;
}
