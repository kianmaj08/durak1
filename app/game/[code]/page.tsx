"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { GameState, Card as CardT } from "@/lib/types";
import { cardKey, suitSymbol, beats } from "@/lib/durak";
import Card from "@/components/Card";

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durak_pid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("durak_pid", id); }
  return id;
}

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const [state, setState] = useState<GameState | null>(null);
  const [pid, setPid] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { setPid(getPlayerId()); }, []);

  useEffect(() => {
    if (!code) return;
    const sb = getSupabase();
    sb.from("games").select("state").eq("code", code).maybeSingle().then(({ data }) => {
      if (data?.state) setState(data.state as GameState);
    });
    const channel = sb
      .channel(`game-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.new && (payload.new as { state: GameState }).state)
            setState((payload.new as { state: GameState }).state);
        })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [code]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setError("");
    const res = await fetch("/api/game", {
      method: "POST", headers: { "Content-Type": "application/json" },
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
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: "40px", color: "var(--gold)", marginBottom: "8px" }}>Durak</div>
          <div style={{ color: "var(--text-dim)", fontSize: "13px" }}>Spiel wird geladen...</div>
        </div>
      </main>
    );
  }

  /* ---- LOBBY ---- */
  if (state.phase === "lobby") {
    const link = typeof window !== "undefined" ? window.location.href : "";
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 className="font-display" style={{ fontSize: "52px", fontWeight: 900, color: "var(--cream)", lineHeight: 1 }}>Durak</h1>
            <p style={{ color: "var(--text-dim)", fontSize: "12px", marginTop: "4px" }}>Warte auf Mitspieler</p>
          </div>

          <div className="panel" style={{ padding: "32px" }}>
            {/* Code */}
            <div
              style={{ textAlign: "center", cursor: "pointer", marginBottom: "28px", padding: "20px", background: "rgba(0,0,0,0.3)", borderRadius: "10px", border: "1px solid rgba(201,164,85,0.25)" }}
              onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            >
              <div style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "8px" }}>Einladungscode</div>
              <div className="font-mono" style={{ fontSize: "44px", fontWeight: 700, color: "var(--gold)", letterSpacing: "0.15em" }}>{code}</div>
              <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "8px" }}>{copied ? "Link kopiert" : "Klicken zum Kopieren"}</div>
            </div>

            {/* Spielerliste */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "12px" }}>
                Spieler {state.players.length} / 4
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {state.players.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontWeight: 600, color: "var(--cream)" }}>{p.name}</span>
                    {p.id === state.hostId && (
                      <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: "4px", background: "rgba(201,164,85,0.15)", color: "var(--gold)", border: "1px solid rgba(201,164,85,0.3)" }}>Host</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: 4 - state.players.length }).map((_, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: "rgba(0,0,0,0.1)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.08)", color: "var(--text-dim)", fontSize: "12px" }}>
                    Wartet auf Spieler...
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button
                className="btn btn-gold"
                onClick={() => act("start")}
                disabled={state.players.length < 2}
                style={{ width: "100%", padding: "14px", fontSize: "12px" }}
              >
                {state.players.length < 2 ? "Mindestens 2 Spieler nötig" : "Spiel starten"}
              </button>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "13px", padding: "12px" }}>Warte auf Host...</div>
            )}

            {error && <p style={{ marginTop: "12px", color: "#f87171", fontSize: "13px", textAlign: "center" }}>{error}</p>}
          </div>
        </div>
      </main>
    );
  }

  /* ---- FINISHED ---- */
  if (state.phase === "finished") {
    const loser = state.players.find((p) => p.id === state.loserId);
    const isLoser = state.loserId === pid;
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <div className="panel" style={{ padding: "48px 32px", textAlign: "center" }}>
            <div className="font-display" style={{ fontSize: "80px", lineHeight: 1, marginBottom: "16px" }}>
              {isLoser ? "☻" : "♠"}
            </div>
            <h2 className="font-display" style={{ fontSize: "40px", fontWeight: 900, color: "var(--cream)", marginBottom: "8px" }}>
              {loser ? "Durak" : "Unentschieden"}
            </h2>
            {loser && (
              <p style={{ color: "var(--text-dim)", marginBottom: "32px" }}>
                <span style={{ color: isLoser ? "#f87171" : "var(--gold)", fontWeight: 700 }}>{loser.name}</span>
                {" "}hat verloren
              </p>
            )}
            {isHost && (
              <button className="btn btn-gold" onClick={() => act("restart")} style={{ width: "100%", padding: "14px" }}>
                Neue Runde
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  /* ---- GAME ---- */
  const trump = state.trump;
  const opponents = state.players.filter((p) => p.id !== pid);
  const undefendedIdx = state.table.findIndex((t) => !t.defense);
  const allDefended = state.table.length > 0 && state.table.every((t) => t.defense);

  function canPlayAttack(c: CardT): boolean {
    if (!state || isDefender) return false;
    if (state.table.length === 0) return isAttacker;
    const ranks = new Set<number>();
    state.table.forEach((p) => { ranks.add(p.attack.rank); if (p.defense) ranks.add(p.defense.rank); });
    return ranks.has(c.rank);
  }

  function canPlayDefense(c: CardT): boolean {
    if (!state || !isDefender || undefendedIdx === -1 || !trump) return false;
    if (state.takeRequested) return false;
    return beats(state.table[undefendedIdx].attack, c, trump);
  }

  function onCardClick(c: CardT) {
    setError("");
    if (isDefender && canPlayDefense(c)) { act("defend", { card: c, pairIdx: undefendedIdx }); return; }
    if (!isDefender && canPlayAttack(c)) { act("attack", { card: c }); return; }
  }

  const myRole = isAttacker ? "atk" : isDefender ? "def" : null;

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "12px", position: "relative", zIndex: 1, gap: "10px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="font-display" style={{ fontSize: "22px", fontWeight: 900, color: "var(--cream)" }}>Durak</span>
          <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-dim)", marginLeft: "10px" }}>{code}</span>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {trump && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
              <span style={{ color: "var(--text-dim)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Trumpf</span>
              <span style={{ fontSize: "20px", color: trump === "H" || trump === "D" ? "var(--red)" : "var(--cream)" }}>
                {suitSymbol(trump)}
              </span>
            </div>
          )}
          <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            <span style={{ color: "var(--gold)" }}>{state.deck.length}</span> im Deck
          </div>
        </div>
      </div>

      {/* Gegner */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {opponents.map((p) => {
          const isAtt = state.players[state.attackerIdx].id === p.id;
          const isDef = state.players[state.defenderIdx].id === p.id;
          return (
            <div key={p.id} className={`player-badge ${isAtt ? "attacker" : isDef ? "defender" : ""}`} style={{ flex: 1, minWidth: "120px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--cream)" }}>{p.name}</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {isAtt && <span className="role-tag atk">Angriff</span>}
                  {isDef && <span className="role-tag def">Abwehr</span>}
                  {p.passed && <span className="role-tag pass">passt</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                {p.hand.map((_, i) => <Card key={i} faceDown small animDelay={i * 20} />)}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "6px" }}>{p.hand.length} Karten</div>
            </div>
          );
        })}
      </div>

      {/* Tisch */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="table-surface" style={{ flex: 1, minHeight: "130px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "10px", padding: "16px" }}>
          {state.table.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", textAlign: "center" }}>
              {isAttacker ? "Lege eine Karte an" : "Warte auf Angriff"}
            </div>
          ) : (
            state.table.map((pair, i) => (
              <div key={i} style={{ position: "relative", width: "62px", height: "90px" }}>
                <Card card={pair.attack} animDelay={i * 60} />
                {pair.defense && (
                  <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                    <Card card={pair.defense} animDelay={i * 60 + 100} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Letzter Zug + Aktions-Status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic" }}>{state.lastAction}</span>
          {state.trumpCard && state.deck.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>Trumpfkarte</span>
              <Card card={state.trumpCard} small />
            </div>
          )}
        </div>

        {/* Aktionsbuttons */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          {isDefender && state.table.length > 0 && !allDefended && !state.takeRequested && (
            <button className="btn btn-danger" onClick={() => act("take")}>
              Aufnehmen
            </button>
          )}
          {!isDefender && state.table.length > 0 && !me?.passed && (
            <button className="btn btn-ghost" onClick={() => act("pass")}>
              Passen / Fertig
            </button>
          )}
          {state.takeRequested && isDefender && (
            <div style={{ fontSize: "12px", color: "#f87171", padding: "10px" }}>Du nimmst auf...</div>
          )}
        </div>
      </div>

      {/* Eigene Hand */}
      <div className="panel" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 700, color: "var(--cream)", fontSize: "14px" }}>{me?.name}</span>
            {myRole && <span className={`role-tag ${myRole}`}>{myRole === "atk" ? "Angreifer" : "Verteidiger"}</span>}
            {me?.passed && <span className="role-tag pass">passt</span>}
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>{me?.hand.length ?? 0} Karten</span>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
          {me?.hand.map((c, i) => {
            const playable = isDefender ? canPlayDefense(c) : canPlayAttack(c);
            return (
              <Card
                key={cardKey(c)}
                card={c}
                disabled={!playable}
                onClick={() => onCardClick(c)}
                animDelay={i * 30}
              />
            );
          })}
        </div>

        {error && <p style={{ marginTop: "10px", color: "#f87171", fontSize: "12px", textAlign: "center" }}>{error}</p>}
      </div>
    </main>
  );
}
