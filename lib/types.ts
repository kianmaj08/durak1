export type Suit = "H" | "D" | "C" | "S"; // Herz, Karo, Kreuz, Pik
export type Rank = 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=B, 12=D, 13=K, 14=A

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface TablePair {
  attack: Card;
  defense?: Card;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  passed?: boolean; // hat in aktueller Phase gepasst
}

export type Phase = "lobby" | "playing" | "finished";

export interface GameState {
  code: string;
  hostId: string;
  phase: Phase;
  players: Player[];
  deck: Card[];
  discard: Card[];
  trump: Suit | null;
  trumpCard: Card | null;
  table: TablePair[];
  attackerIdx: number;
  defenderIdx: number;
  loserId: string | null;
  takeRequested: boolean;
  lastAction: string;
  createdAt: number;
}
