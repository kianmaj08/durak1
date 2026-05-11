"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { GameState, Card as CardT } from "@/lib/types";
import { cardKey, suitSymbol, rankLabel, beats } from "@/lib/durak";
import Card from "@/components/Card";

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durak_pid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("durak_pid", id);
  }
  return id;
}

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const [state, setState] = useState<GameState | null>(null);
  const [pid, setPid] = useState("");
  const [selected, setSelected] = useState<CardT | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPid(getPlayerId());
  }, []);

  useEffect(() => {
    if (!code) return;
    const sb = getSupabase();

    // initial load
    sb.from("games")
      .select("state")
      .eq("code", code)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.state) setState(data.state as GameState);
      });

    // realtime
    const channel = sb
      .channel(`game-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.new && (payload.new as { state: GameState }).state) {
            setState((payload.new as { state: GameState }).state);
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [code]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setError("");
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code, playerId: pid, ...extra }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    if (data.state) setState(data.state);
  }

  const me = useMemo(() => state?.players.find((p) => p.id === pid), [state, pid]);
  const isHost = state?.hostId === pid;
  const isAttacker = state && me ? state.players[state.attackerIdx]?.id === pid : false;
  const isDefender = state && me ? state.players[state.defenderIdx]?.id === pid : false;

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-white/70">Laedt Spiel...</div>
      </main>
    );
  }

  // Lobby Ansicht
  if (state.phase === "lobby") {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-black/40 rounded-2xl p-8 border border-white/10">
          <h1 className="text-3xl font-black mb-2 text-center">Lobby</h1>
          <p className="text-center text-white/60 mb-6">Teile den Code mit deinen Freunden</p>

          <div
            className="bg-white/10 rounded p-6 mb-6 text-center cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <div className="text-5xl font-mono tracking-widest font-bold">{code}</div>
            <div className="text-xs text-white/50 mt-2">{copied ? "Kopiert" : "Klicken zum Kopieren"}</div>
          </div>

          <div className="mb-6">
            <h2 className="font-bold mb-2">Spieler ({state.players.length}/4)</h2>
            <ul className="space-y-2">
              {state.players.map((p) => (
                <li
                  key={p.id}
                  className="px-4 py-2 bg-white/5 rounded flex justify-between items-center"
                >
                  <span>{p.name}</span>
                  {p.id === state.hostId && (
                    <span className="text-xs bg-yellow-500/30 px-2 py-1 rounded">Host</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <button
              onClick={() => act("start")}
              disabled={state.players.length < 2}
              className="w-full py-3 rounded bg-emerald-500 hover:bg-emerald-400 font-bold disabled:opacity-50"
            >
              Spiel starten
            </button>
          ) : (
            <p className="text-center text-white/60">Warte auf Host...</p>
          )}
          {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
        </div>
      </main>
    );
  }

  // Spielende
  if (state.phase === "finished") {
    const loser = state.players.find((p) => p.id === state.loserId);
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-black/40 rounded-2xl p-8 border border-white/10 text-center">
          <h1 className="text-4xl font-black mb-4">Spiel vorbei</h1>
          <p className="text-2xl mb-6">
            {loser ? (
              <>
                <span className="text-red-400">{loser.name}</span> ist der Durak
              </>
            ) : (
              "Unentschieden"
            )}
          </p>
          {isHost && (
            <button
              onClick={() => act("restart")}
              className="w-full py-3 rounded bg-emerald-500 font-bold"
            >
              Neue Runde
            </button>
          )}
        </div>
      </main>
    );
  }

  // Spielansicht
  const trump = state.trump;
  const defender = state.players[state.defenderIdx];
  const attacker = state.players[state.attackerIdx];
  const opponents = state.players.filter((p) => p.id !== pid);

  // Welche Paare sind ungeschlagen (fuer Defender)
  const undefendedIdx = state.table.findIndex((t) => !t.defense);

  function canPlayAttack(c: CardT): boolean {
    if (!state) return false;
    if (isDefender) return false;
    if (state.table.length === 0) {
      return isAttacker;
    }
    const ranks = new Set<number>();
    state.table.forEach((p) => {
      ranks.add(p.attack.rank);
      if (p.defense) ranks.add(p.defense.rank);
    });
    return ranks.has(c.rank);
  }

  function canPlayDefense(c: CardT): boolean {
    if (!state || !isDefender || undefendedIdx === -1 || !trump) return false;
    if (state.takeRequested) return false;
    return beats(state.table[undefendedIdx].attack, c, trump);
  }

  function onCardClick(c: CardT) {
    setError("");
    if (isDefender && canPlayDefense(c)) {
      act("defend", { card: c, pairIdx: undefendedIdx });
      setSelected(null);
      return;
    }
    if (!isDefender && canPlayAttack(c)) {
      act("attack", { card: c });
      setSelected(null);
      return;
    }
    setSelected(c);
  }

  const allDefended = state.table.length > 0 && state.table.every((t) => t.defense);

  return (
    <main className="min-h-screen p-3 sm:p-6 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm">
          <div className="font-mono text-white/60">Code: {code}</div>
          <div className="text-xs text-white/50">{state.lastAction}</div>
        </div>
        <div className="text-right text-sm">
          <div>
            Trumpf:{" "}
            {trump && (
              <span className={trump === "H" || trump === "D" ? "text-red-400" : ""}>
                {suitSymbol(trump)}
              </span>
            )}
          </div>
          <div className="text-xs text-white/50">Deck: {state.deck.length}</div>
        </div>
      </div>

      {/* Gegner */}
      <div className="flex flex-wrap gap-3 justify-around mb-6">
        {opponents.map((p) => {
          const isAtt = state.players[state.attackerIdx].id === p.id;
          const isDef = state.players[state.defenderIdx].id === p.id;
          return (
            <div
              key={p.id}
              className={`bg-black/30 rounded-lg p-3 border ${
                isAtt ? "border-orange-400" : isDef ? "border-blue-400" : "border-white/10"
              }`}
            >
              <div className="text-sm font-bold mb-2">
                {p.name}
                {isAtt && <span className="ml-2 text-xs text-orange-400">Angriff</span>}
                {isDef && <span className="ml-2 text-xs text-blue-400">Verteidigung</span>}
                {p.passed && <span className="ml-2 text-xs text-white/40">passt</span>}
              </div>
              <div className="flex gap-1">
                {p.hand.map((_, i) => (
                  <Card key={i} faceDown small />
                ))}
              </div>
              <div className="text-xs text-white/50 mt-1">{p.hand.length} Karten</div>
            </div>
          );
        })}
      </div>

      {/* Tisch */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 my-4">
        <div className="bg-emerald-800/40 rounded-2xl p-6 min-h-[120px] min-w-[280px] border border-emerald-500/30 flex flex-wrap gap-3 items-center justify-center">
          {state.table.length === 0 ? (
            <div className="text-white/50 text-sm">Kein Angriff</div>
          ) : (
            state.table.map((pair, i) => (
              <div key={i} className="relative">
                <Card card={pair.attack} />
                {pair.defense && (
                  <div className="absolute top-3 left-3">
                    <Card card={pair.defense} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Trumpfanzeige */}
        {state.trumpCard && state.deck.length > 0 && (
          <div className="text-xs text-white/60 flex items-center gap-2">
            <span>Trumpfkarte:</span>
            <Card card={state.trumpCard} small />
          </div>
        )}

        {/* Aktionen */}
        <div className="flex gap-3 flex-wrap justify-center">
          {isDefender && state.table.length > 0 && !allDefended && !state.takeRequested && (
            <button
              onClick={() => act("take")}
              className="px-5 py-2 rounded bg-red-500 hover:bg-red-400 font-bold"
            >
              Aufnehmen
            </button>
          )}
          {!isDefender && state.table.length > 0 && !me?.passed && (
            <button
              onClick={() => act("pass")}
              className="px-5 py-2 rounded bg-slate-600 hover:bg-slate-500 font-bold"
            >
              Passen / Fertig
            </button>
          )}
        </div>
      </div>

      {/* Eigene Hand */}
      <div className="bg-black/40 rounded-xl p-3 border border-white/10">
        <div className="text-sm mb-2 flex justify-between">
          <span>
            Du: <span className="font-bold">{me?.name}</span>
            {isAttacker && <span className="ml-2 text-orange-400">(Angreifer)</span>}
            {isDefender && <span className="ml-2 text-blue-400">(Verteidiger)</span>}
          </span>
          <span className="text-white/50">{me?.hand.length ?? 0} Karten</span>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {me?.hand.map((c) => {
            const playable = isDefender ? canPlayDefense(c) : canPlayAttack(c);
            return (
              <div
                key={cardKey(c)}
                className={selected && cardKey(selected) === cardKey(c) ? "ring-2 ring-yellow-400 rounded" : ""}
              >
                <Card card={c} disabled={!playable} onClick={() => onCardClick(c)} />
              </div>
            );
          })}
        </div>
        {error && <p className="mt-2 text-red-400 text-sm text-center">{error}</p>}
      </div>
    </main>
  );
}
