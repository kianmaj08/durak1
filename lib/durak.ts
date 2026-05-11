import { Card, GameState, Player, Rank, Suit, TablePair } from "./types";

const SUITS: Suit[] = ["H", "D", "C", "S"];
const RANKS: Rank[] = [6, 7, 8, 9, 10, 11, 12, 13, 14];
export const TURN_SECONDS = 30;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardKey(c: Card): string { return `${c.suit}${c.rank}`; }

export function rankLabel(r: Rank): string {
  if (r === 11) return "B";
  if (r === 12) return "D";
  if (r === 13) return "K";
  if (r === 14) return "A";
  return String(r);
}

export function suitSymbol(s: Suit): string {
  return s === "H" ? "\u2665" : s === "D" ? "\u2666" : s === "C" ? "\u2663" : "\u2660";
}

export function isRed(s: Suit): boolean { return s === "H" || s === "D"; }

export function beats(attack: Card, defense: Card, trump: Suit): boolean {
  if (defense.suit === attack.suit && defense.rank > attack.rank) return true;
  if (defense.suit === trump && attack.suit !== trump) return true;
  return false;
}

export function sortHand(hand: Card[], trump: Suit): Card[] {
  return [...hand].sort((a, b) => {
    const at = a.suit === trump ? 1 : 0;
    const bt = b.suit === trump ? 1 : 0;
    if (at !== bt) return at - bt;
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.rank - b.rank;
  });
}

export function startGame(players: Player[], hostId: string, code: string): GameState {
  if (players.length < 2 || players.length > 4) throw new Error("2 bis 4 Spieler");
  let deck = shuffle(createDeck());
  const hands: Card[][] = players.map(() => []);
  for (let r = 0; r < 6; r++)
    for (let p = 0; p < players.length; p++) {
      const c = deck.shift();
      if (c) hands[p].push(c);
    }
  const trumpCard = deck[deck.length - 1] ?? null;
  const trump: Suit | null = trumpCard ? trumpCard.suit : null;

  const newPlayers: Player[] = players.map((p, i) => ({
    ...p,
    hand: sortHand(hands[i], trump!),
    passed: false,
  }));

  let attackerIdx = 0;
  let lowest: { idx: number; rank: number } | null = null;
  newPlayers.forEach((p, i) => {
    p.hand.forEach((c) => {
      if (c.suit === trump && (lowest === null || c.rank < lowest.rank))
        lowest = { idx: i, rank: c.rank };
    });
  });
  if (lowest) attackerIdx = (lowest as { idx: number }).idx;

  return {
    code, hostId,
    phase: "playing",
    players: newPlayers,
    deck, discard: [], trump, trumpCard, table: [],
    attackerIdx,
    defenderIdx: (attackerIdx + 1) % newPlayers.length,
    loserId: null, takeRequested: false,
    lastAction: "Spiel gestartet",
    turnStartedAt: Date.now(),
    createdAt: Date.now(),
  };
}

export function ranksOnTable(state: GameState): Set<number> {
  const set = new Set<number>();
  for (const pair of state.table) {
    set.add(pair.attack.rank);
    if (pair.defense) set.add(pair.defense.rank);
  }
  return set;
}

export function canAttack(state: GameState, playerId: string, card: Card): { ok: boolean; reason?: string } {
  if (state.phase !== "playing") return { ok: false, reason: "Nicht in Spielphase" };
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return { ok: false, reason: "Spieler nicht gefunden" };
  if (playerIdx === state.defenderIdx) return { ok: false, reason: "Verteidiger kann nicht angreifen" };
  const defender = state.players[state.defenderIdx];
  const maxAttacks = Math.min(6, defender.hand.length + state.table.filter((t) => t.defense).length);
  if (state.table.length >= maxAttacks) return { ok: false, reason: "Maximum erreicht" };
  if (state.table.length === 0) {
    if (playerIdx !== state.attackerIdx) return { ok: false, reason: "Nicht dein Zug" };
    return { ok: true };
  }
  const set = ranksOnTable(state);
  if (!set.has(card.rank)) return { ok: false, reason: "Dieser Wert liegt nicht auf dem Tisch" };
  return { ok: true };
}

export function canDefend(state: GameState, playerId: string, card: Card, pairIdx: number): { ok: boolean; reason?: string } {
  if (state.phase !== "playing") return { ok: false, reason: "Nicht in Spielphase" };
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx !== state.defenderIdx) return { ok: false, reason: "Nur Verteidiger kann schlagen" };
  if (state.takeRequested) return { ok: false, reason: "Du hast bereits aufgenommen" };
  const pair = state.table[pairIdx];
  if (!pair) return { ok: false, reason: "Paar nicht gefunden" };
  if (pair.defense) return { ok: false, reason: "Bereits geschlagen" };
  if (!state.trump) return { ok: false, reason: "Kein Trumpf" };
  if (!beats(pair.attack, card, state.trump)) return { ok: false, reason: "Schlägt nicht" };
  return { ok: true };
}

export function applyAttack(state: GameState, playerId: string, card: Card): GameState {
  const check = canAttack(state, playerId, card);
  if (!check.ok) throw new Error(check.reason);
  const next: GameState = JSON.parse(JSON.stringify(state));
  const p = next.players.find((x) => x.id === playerId)!;
  p.hand = p.hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
  next.table.push({ attack: card });
  next.lastAction = `${p.name} legt ${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
  next.players.forEach((pl) => (pl.passed = false));
  next.turnStartedAt = Date.now();
  return next;
}

export function applyDefense(state: GameState, playerId: string, card: Card, pairIdx: number): GameState {
  const check = canDefend(state, playerId, card, pairIdx);
  if (!check.ok) throw new Error(check.reason);
  const next: GameState = JSON.parse(JSON.stringify(state));
  const p = next.players.find((x) => x.id === playerId)!;
  p.hand = p.hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
  next.table[pairIdx].defense = card;
  next.lastAction = `${p.name} schlägt mit ${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
  next.turnStartedAt = Date.now();
  return next;
}

export function applyTake(state: GameState, playerId: string): GameState {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx !== state.defenderIdx) throw new Error("Nur Verteidiger");
  const next: GameState = JSON.parse(JSON.stringify(state));
  next.takeRequested = true;
  next.lastAction = `${next.players[playerIdx].name} nimmt auf`;
  next.turnStartedAt = Date.now();
  return next;
}

export function applyPass(state: GameState, playerId: string): GameState {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === state.defenderIdx) throw new Error("Verteidiger kann nicht passen");
  const next: GameState = JSON.parse(JSON.stringify(state));
  next.players[playerIdx].passed = true;
  next.lastAction = `${next.players[playerIdx].name} passt`;
  return tryEndRound(next);
}

export function applyTimeout(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const now = Date.now();
  if (!state.turnStartedAt || now - state.turnStartedAt < (TURN_SECONDS - 2) * 1000) return state;
  const next: GameState = JSON.parse(JSON.stringify(state));
  const defender = next.players[next.defenderIdx];
  const attacker = next.players[next.attackerIdx];
  if (next.table.length > 0 && next.table.some((t) => !t.defense) && !next.takeRequested) {
    next.takeRequested = true;
    next.lastAction = `${defender.name} Zeit abgelaufen – nimmt auf`;
    next.turnStartedAt = Date.now();
    return tryEndRound(next);
  }
  next.players[next.attackerIdx].passed = true;
  next.lastAction = `${attacker.name} Zeit abgelaufen – passt`;
  return tryEndRound(next);
}

function allAttackersPassed(state: GameState): boolean {
  return state.players.every((p, i) => i === state.defenderIdx || p.passed || p.hand.length === 0);
}

function allDefended(state: GameState): boolean {
  return state.table.length > 0 && state.table.every((pair) => !!pair.defense);
}

export function tryEndRound(state: GameState): GameState {
  if (state.table.length === 0) return state;
  if (state.takeRequested && allAttackersPassed(state)) return endRound(state, true);
  if (allDefended(state) && allAttackersPassed(state)) return endRound(state, false);
  return state;
}

function endRound(state: GameState, defenderTakes: boolean): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));
  const defender = next.players[next.defenderIdx];

  if (defenderTakes) {
    for (const pair of next.table) {
      defender.hand.push(pair.attack);
      if (pair.defense) defender.hand.push(pair.defense);
    }
    next.lastAction = `${defender.name} nimmt alle Karten auf`;
  } else {
    for (const pair of next.table) {
      next.discard.push(pair.attack);
      if (pair.defense) next.discard.push(pair.defense);
    }
    next.lastAction = `${defender.name} hat erfolgreich verteidigt`;
  }

  next.table = [];
  next.takeRequested = false;
  next.players.forEach((p) => (p.passed = false));

  const n = next.players.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (next.attackerIdx + i) % n;
    if (idx !== next.defenderIdx) order.push(idx);
  }
  order.push(next.defenderIdx);

  for (const idx of order) {
    const pl = next.players[idx];
    while (pl.hand.length < 6 && next.deck.length > 0) {
      const c = next.deck.shift();
      if (c) pl.hand.push(c);
    }
    if (next.trump) pl.hand = sortHand(pl.hand, next.trump);
  }

  if (defenderTakes) {
    next.attackerIdx = (next.defenderIdx + 1) % n;
  } else {
    next.attackerIdx = next.defenderIdx;
  }

  let safety = 0;
  while (next.players[next.attackerIdx].hand.length === 0 && next.deck.length === 0 && safety < n * 2) {
    next.attackerIdx = (next.attackerIdx + 1) % n;
    safety++;
  }
  next.defenderIdx = (next.attackerIdx + 1) % n;
  safety = 0;
  while (next.players[next.defenderIdx].hand.length === 0 && next.deck.length === 0 && safety < n * 2) {
    next.defenderIdx = (next.defenderIdx + 1) % n;
    safety++;
  }

  const playersWithCards = next.players.filter((p) => p.hand.length > 0);
  if (next.deck.length === 0 && playersWithCards.length <= 1) {
    next.phase = "finished";
    next.loserId = playersWithCards[0]?.id ?? null;
    next.lastAction = next.loserId
      ? `${next.players.find((p) => p.id === next.loserId)!.name} ist der Durak`
      : "Unentschieden";
    next.turnStartedAt = null;
  } else {
    next.turnStartedAt = Date.now();
  }

  return next;
}
