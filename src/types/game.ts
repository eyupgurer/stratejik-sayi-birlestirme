export type Block = {
  id: string;
  value: number;
};

export type BoardCell = Block | null;

export type Board = BoardCell[][];

export type Position = {
  row: number;
  col: number;
};

export type FallingBlock = {
  block: Block;
  row: number;
  col: number;
};
