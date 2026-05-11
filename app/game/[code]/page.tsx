"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { GameState, Card as CardT } from "@/lib/types";
import { cardKey, suitSymbol, beats, TURN_SECONDS } from "@/lib/durak";
import Card from "@/components/Card";

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durak_pid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("durak_pid", id); }
  return id;
}

// ---- Rules Modal ----
function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ maxWidth: "500px", width: "100%", padding: "32px", maxHeight: "80vh", overflowY: "auto", position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>✕</button>
        <h2 className="font-display" style={{ fontSize: "32px", fontWeight: 900, color: "var(--cream)", marginBottom: "20px" }}>Regeln</h2>

        {[
          { title: "Ziel", text: "Wer am Ende noch Karten auf der Hand hat, ist der Durak (Dummkopf) und verliert." },
          { title: "Deck & Trumpf", text: "36 Karten (6 bis Ass). Die unterste Karte im Deck bestimmt die Trumpffarbe und bleibt sichtbar, bis das Deck leer ist. Trumpfkarten schlagen alle anderen Farben." },
          { title: "Spielbeginn", text: "Jeder erhält 6 Karten. Wer den niedrigsten Trumpf hat, greift als erstes an." },
          { title: "Angriff", text: "Der Angreifer legt eine Karte offen auf den Tisch. Mitspieler dürfen Karten gleichen Wertes dazulegen (podkidat). Maximal 6 Karten pro Runde bzw. so viele wie der Verteidiger Karten hat." },
          { title: "Verteidigung", text: "Der Verteidiger muss jede Karte schlagen: entweder mit einer höheren Karte derselben Farbe oder mit einem Trumpf. Kann oder will er nicht schlagen, nimmt er alle Karten auf." },
          { title: "Aufnehmen", text: "Der Verteidiger drückt 'Aufnehmen'. Angreifer können danach noch weitere Karten dazulegen. Sobald alle gepasst haben, nimmt der Verteidiger alles auf und ist wieder dran." },
          { title: "Nachziehen", text: "Nach jeder Runde ziehen alle Spieler auf 6 Karten nach: zuerst der Angreifer, dann die Mitspieler, zuletzt der Verteidiger." },
          { title: "Timer", text: `Jeder Zug hat ${TURN_SECONDS} Sekunden. Bei Ablauf wird automatisch gepasst oder aufgenommen.` },
          { title: "Spielende", text: "Wenn das Deck leer ist und ein Spieler seine letzten Karten loswird, scheidet er aus. Wer als letzter Karten hat, ist der Durak." },
        ].map(({ title, text }) => (
          <div key={title} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)", marginBottom: "4px" }}>{title}</div>
            <div style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.6 }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Shuffle Animation ----
function ShuffleOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  const cards = [
    { rot: -35, x: -80, delay: 0 },
    { rot: -22, x: -50, delay: 50 },
    { rot: -10, x: -20, delay: 100 },
    { rot: 0,   x: 0,   delay: 150 },
    { rot: 10,  x: 20,  delay: 200 },
    { rot: 22,  x: 50,  delay: 250 },
    { rot: 35,  x: 80,  delay: 300 },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,21,10,0.95)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px" }}>
      <style>{`
        @keyframes dealOut {
          0%   { opacity: 0; transform: translateX(var(--tx)) rotate(var(--rot)) translateY(40px) scale(0.8); }
          40%  { opacity: 1; transform: translateX(var(--tx)) rotate(var(--rot)) translateY(0) scale(1); }
          80%  { opacity: 1; transform: translateX(var(--tx)) rotate(var(--rot)) translateY(0) scale(1); }
          100% { opacity: 0; transform: translateX(var(--tx)) rotate(var(--rot)) translateY(-20px) scale(0.9); }
        }
        @keyframes shuffleText {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
      `}</style>
      <div style={{ position: "relative", height: "110px", width: "220px" }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            position: "absolute",
            left: "50%",
            top: "10px",
            marginLeft: "-27px",
            animation: `dealOut 1.6s ${c.delay}ms ease both`,
            "--tx": `${c.x}px`,
            "--rot": `${c.rot}deg`,
          } as React.CSSProperties}>
            <div className="playing-card card-back" style={{ width: "54px", height: "78px" }} />
          </div>
        ))}
      </div>
      <div className="font-display" style={{ fontSize: "28px", color: "var(--cream)", animation: "shuffleText 0.8s ease infinite" }}>
        Karten werden gemischt...
      </div>
    </div>
  );
}

// ---- Timer Bar ----
function TimerBar({ turnStartedAt, isMyTurn }: { turnStartedAt: number | null; isMyTurn: boolean }) {
  const [remaining, setRemaining] = useState(TURN_SECONDS);

  useEffect(() => {
    if (!turnStartedAt) { setRemaining(TURN_SECONDS); return; }
    const update = () => {
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      setRemaining(Math.max(0, TURN_SECONDS - elapsed));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [turnStartedAt]);

  const pct = (remaining / TURN_SECONDS) * 100;
  const urgent = remaining < 8;
  const color = remaining > 15 ? "var(--gold)" : remaining > 8 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <span style={{ fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Zeit</span>
        <span style={{ fontSize: "12px", fontFamily: "'Courier Prime', monospace", fontWeight: 700, color, transition: "color 0.5s" }}>
          {Math.ceil(remaining)}s
        </span>
      </div>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "2px",
          transition: "width 0.25s linear, background 0.5s",
          boxShadow: urgent && isMyTurn ? `0 0 8px ${color}` : undefined,
        }} />
      </div>
    </div>
  );
}

// ---- Discard Pile ----
function DiscardPile({ count, topCard }: { count: number; topCard?: CardT }) {
  if (count === 0) return (
    <div style={{ width: "46px", textAlign: "center" }}>
      <div style={{ width: "46px", height: "66px", borderRadius: "6px", border: "1px dashed rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "16px", opacity: 0.2 }}>♻</span>
      </div>
      <div style={{ fontSize: "9px", color: "var(--text-dim)", marginTop: "3px" }}>Ablage</div>
    </div>
  );
  return (
    <div style={{ width: "46px", textAlign: "center" }}>
      <div style={{ position: "relative", width: "46px", height: "66px" }}>
        {count > 1 && <div style={{ position: "absolute", top: "3px", left: "3px", width: "46px", height: "66px", borderRadius: "6px", background: "rgba(250,246,238,0.06)", border: "1px solid rgba(255,255,255,0.08)" }} />}
        {topCard
          ? <Card card={topCard} small disabled />
          : <div style={{ width: "46px", height: "66px", borderRadius: "6px", background: "rgba(250,246,238,0.06)", border: "1px solid rgba(255,255,255,0.08)" }} />}
      </div>
      <div style={{ fontSize: "9px", color: "var(--text-dim)", marginTop: "3px" }}>{count} abgel.</div>
    </div>
  );
}

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const [state, setState] = useState<GameState | null>(null);
  const [prevPhase, setPrevPhase] = useState<string | null>(null);
  const [showShuffle, setShowShuffle] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [pid, setPid] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null);
  const timeoutSentRef = useRef<number | null>(null);

  useEffect(() => { setPid(getPlayerId()); }, []);

  const fetchState = useCallback(async () => {
    const sb = getSupabase();
    const { data } = await sb.from("games").select("state").eq("code", code).maybeSingle();
    if (data?.state) setState(data.state as GameState);
  }, [code]);

  const subscribe = useCallback(() => {
    const sb = getSupabase();
    if (channelRef.current) sb.removeChannel(channelRef.current);
    const channel = sb
      .channel(`game-${code}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.new && (payload.new as { state: GameState }).state)
            setState((payload.new as { state: GameState }).state);
        })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setTimeout(() => { fetchState(); subscribe(); }, 3000);
        }
      });
    channelRef.current = channel;
  }, [code, fetchState]);

  useEffect(() => {
    if (!code) return;
    fetchState();
    subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") { fetchState(); subscribe(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      const sb = getSupabase();
      if (channelRef.current) sb.removeChannel(channelRef.current);
    };
  }, [code, fetchState, subscribe]);

  // Shuffle animation bei Spielstart
  useEffect(() => {
    if (!state) return;
    if (prevPhase === "lobby" && state.phase === "playing") setShowShuffle(true);
    setPrevPhase(state.phase);
  }, [state?.phase]);

  // Timer Timeout
  useEffect(() => {
    if (!state || state.phase !== "playing" || !state.turnStartedAt) return;
    const elapsed = Date.now() - state.turnStartedAt;
    const remaining = TURN_SECONDS * 1000 - elapsed;
    if (remaining <= 0) return;
    const id = setTimeout(async () => {
      if (timeoutSentRef.current === state.turnStartedAt) return;
      timeoutSentRef.current = state.turnStartedAt;
      await fetch("/api/game", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "timeout", code }),
      });
    }, remaining + 200);
    return () => clearTimeout(id);
  }, [state?.turnStartedAt, code]);

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
  const isMyTurn = isAttacker || isDefender;

  if (!state) return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: "40px", color: "var(--gold)", marginBottom: "8px" }}>Durak</div>
        <div style={{ color: "var(--text-dim)", fontSize: "13px" }}>Wird geladen...</div>
      </div>
    </main>
  );

  /* ---- LOBBY ---- */
  if (state.phase === "lobby") {
    const lobbyUrl = typeof window !== "undefined" ? window.location.href : "";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(lobbyUrl)}&bgcolor=0e1f0e&color=c9a455&margin=10&format=png`;

    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 1 }}>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        <div style={{ width: "100%", maxWidth: "480px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h1 className="font-display" style={{ fontSize: "52px", fontWeight: 900, color: "var(--cream)", lineHeight: 1 }}>Durak</h1>
            <p style={{ color: "var(--text-dim)", fontSize: "12px", marginTop: "4px" }}>Lobby wartet auf Spieler</p>
          </div>

          <div className="panel" style={{ padding: "28px" }}>
            {/* Code + QR nebeneinander */}
            <div style={{ display: "flex", gap: "20px", alignItems: "center", marginBottom: "24px", padding: "20px", background: "rgba(0,0,0,0.3)", borderRadius: "10px", border: "1px solid rgba(201,164,85,0.2)", cursor: "pointer" }}
              onClick={() => { navigator.clipboard.writeText(lobbyUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              <div>
                <div style={{ fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "6px" }}>Einladungscode</div>
                <div className="font-mono" style={{ fontSize: "40px", fontWeight: 700, color: "var(--gold)", letterSpacing: "0.12em" }}>{code}</div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "6px" }}>{copied ? "✓ Link kopiert" : "Klicken zum Kopieren"}</div>
              </div>
              <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                <img src={qrUrl} alt="QR Code" width={80} height={80} style={{ borderRadius: "6px", display: "block" }} />
                <div style={{ fontSize: "9px", color: "var(--text-dim)", textAlign: "center", marginTop: "4px" }}>QR-Code scannen</div>
              </div>
            </div>

            {/* Spielerliste */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "10px" }}>
                Spieler {state.players.length} / 4
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {state.players.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontWeight: 600, color: "var(--cream)" }}>{p.name}</span>
                    {p.id === state.hostId && <span className="role-tag atk">Host</span>}
                  </div>
                ))}
                {Array.from({ length: 4 - state.players.length }).map((_, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: "rgba(0,0,0,0.1)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.08)", color: "var(--text-dim)", fontSize: "12px" }}>
                    Wartet auf Spieler...
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-ghost" onClick={() => setShowRules(true)} style={{ padding: "12px 16px" }}>
                Regeln
              </button>
              {isHost ? (
                <button className="btn btn-gold" onClick={() => act("start")} disabled={state.players.length < 2} style={{ flex: 1, padding: "12px" }}>
                  {state.players.length < 2 ? "Warte auf Mitspieler" : "Spiel starten"}
                </button>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "13px" }}>Warte auf Host...</div>
              )}
            </div>

            {error && <p style={{ marginTop: "12px", color: "#f87171", fontSize: "12px", textAlign: "center" }}>{error}</p>}
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
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <div className="panel" style={{ padding: "48px 32px", textAlign: "center" }}>
            <div className="font-display" style={{ fontSize: "80px", lineHeight: 1, marginBottom: "16px" }}>
              {isLoser ? "☻" : "♠"}
            </div>
            <h2 className="font-display" style={{ fontSize: "40px", fontWeight: 900, color: "var(--cream)", marginBottom: "8px" }}>
              {loser ? "Durak!" : "Unentschieden"}
            </h2>
            {loser && (
              <p style={{ color: "var(--text-dim)", marginBottom: "32px" }}>
                <span style={{ color: isLoser ? "#f87171" : "var(--gold)", fontWeight: 700 }}>{loser.name}</span> hat verloren
              </p>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-ghost" onClick={() => setShowRules(true)} style={{ padding: "12px 16px" }}>Regeln</button>
              {isHost && (
                <button className="btn btn-gold" onClick={() => act("restart")} style={{ flex: 1, padding: "12px" }}>
                  Neue Runde
                </button>
              )}
            </div>
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
  const discardTop = state.discard.length > 0 ? state.discard[state.discard.length - 1] : undefined;
  const myRole = isAttacker ? "atk" : isDefender ? "def" : null;

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

  return (
    <>
      {showShuffle && <ShuffleOverlay onDone={() => setShowShuffle(false)} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "10px", position: "relative", zIndex: 1, gap: "8px", maxHeight: "100vh", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="font-display" style={{ fontSize: "20px", fontWeight: 900, color: "var(--cream)" }}>Durak</span>
            <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-dim)", letterSpacing: "0.08em" }}>{code}</span>
            {!connected && <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(239,68,68,0.15)", padding: "2px 7px", borderRadius: "4px", border: "1px solid rgba(239,68,68,0.3)" }}>Verbindung...</span>}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {trump && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "9px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Trumpf</span>
                <span style={{ fontSize: "18px", color: trump === "H" || trump === "D" ? "var(--red)" : "var(--cream)" }}>{suitSymbol(trump)}</span>
              </div>
            )}
            <button className="btn btn-ghost" onClick={() => setShowRules(true)} style={{ padding: "5px 10px", fontSize: "10px" }}>Regeln</button>
          </div>
        </div>

        {/* Timer */}
        {state.phase === "playing" && (
          <div style={{ padding: "0 2px" }}>
            <TimerBar turnStartedAt={state.turnStartedAt} isMyTurn={isMyTurn} />
          </div>
        )}

        {/* Gegner */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {opponents.map((p) => {
            const isAtt = state.players[state.attackerIdx].id === p.id;
            const isDef = state.players[state.defenderIdx].id === p.id;
            return (
              <div key={p.id} className={`player-badge ${isAtt ? "attacker" : isDef ? "defender" : ""}`} style={{ flex: 1, minWidth: "110px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "12px", color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }}>{p.name}</span>
                  <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                    {isAtt && <span className="role-tag atk">Angriff</span>}
                    {isDef && <span className="role-tag def">Abwehr</span>}
                    {p.passed && <span className="role-tag pass">passt</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "2px", flexWrap: "wrap" }}>
                  {p.hand.map((_, i) => <Card key={i} faceDown small animDelay={i * 15} />)}
                </div>
                <div style={{ fontSize: "9px", color: "var(--text-dim)", marginTop: "4px" }}>{p.hand.length} Karten</div>
              </div>
            );
          })}
        </div>

        {/* Tisch */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minHeight: 0 }}>
          <div className="table-surface" style={{ flex: 1, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", minHeight: "120px", position: "relative" }}>

            {/* Deck + Discard links/rechts vom Spielfeld */}
            <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
              {/* Deck Stapel */}
              <div style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: "46px", height: "66px" }}>
                  {state.deck.length > 1 && <div style={{ position: "absolute", top: "-3px", left: "-2px", width: "46px", height: "66px" }} className="playing-card card-back card-sm" />}
                  {state.deck.length > 0 && state.trumpCard ? (
                    <div style={{ position: "relative" }}>
                      <Card card={state.trumpCard} small disabled />
                      <div style={{ position: "absolute", top: "-2px", left: "-2px", width: "46px", height: "66px" }} className="playing-card card-back card-sm" />
                    </div>
                  ) : state.deck.length === 0 ? (
                    <div style={{ width: "46px", height: "66px", borderRadius: "6px", border: "1px dashed rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>leer</span>
                    </div>
                  ) : (
                    <div className="playing-card card-back card-sm" />
                  )}
                </div>
                <div style={{ fontSize: "9px", color: "var(--text-dim)", marginTop: "3px" }}>{state.deck.length} Karten</div>
              </div>
              <DiscardPile count={state.discard.length} topCard={discardTop} />
            </div>

            {/* Tischkarten */}
            {state.table.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.18)", fontSize: "12px", textAlign: "center", marginLeft: "120px" }}>
                {isAttacker ? "Lege eine Karte an" : "Warte auf Angriff"}
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginLeft: state.table.length > 0 ? "80px" : "0" }}>
                {state.table.map((pair, i) => (
                  <div key={i} style={{ position: "relative", width: "62px", height: "90px" }}>
                    <Card card={pair.attack} animDelay={i * 60} />
                    {pair.defense && (
                      <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                        <Card card={pair.defense} animDelay={i * 60 + 100} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status + Aktionen */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{state.lastAction}</span>
            <div style={{ display: "flex", gap: "6px" }}>
              {isDefender && state.table.length > 0 && !allDefended && !state.takeRequested && (
                <button className="btn btn-danger" onClick={() => act("take")} style={{ padding: "8px 14px", fontSize: "10px" }}>
                  Aufnehmen
                </button>
              )}
              {!isDefender && state.table.length > 0 && !me?.passed && (
                <button className="btn btn-ghost" onClick={() => act("pass")} style={{ padding: "8px 14px", fontSize: "10px" }}>
                  Passen
                </button>
              )}
              {state.takeRequested && isDefender && (
                <span style={{ fontSize: "11px", color: "#f87171", padding: "8px" }}>Nimmst auf...</span>
              )}
            </div>
          </div>
        </div>

        {/* Eigene Hand */}
        <div className="panel" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ fontWeight: 700, color: "var(--cream)", fontSize: "13px" }}>{me?.name ?? "Du"}</span>
              {myRole && <span className={`role-tag ${myRole}`}>{myRole === "atk" ? "Angreifer" : "Verteidiger"}</span>}
              {me?.passed && !myRole && <span className="role-tag pass">passt</span>}
            </div>
            <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>{me?.hand.length ?? 0} Karten</span>
          </div>

          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", justifyContent: "center" }}>
            {me?.hand.map((c, i) => {
              const playable = isDefender ? canPlayDefense(c) : canPlayAttack(c);
              return (
                <Card key={cardKey(c)} card={c} disabled={!playable} onClick={() => onCardClick(c)} animDelay={i * 25} />
              );
            })}
          </div>

          {error && <p style={{ marginTop: "8px", color: "#f87171", fontSize: "11px", textAlign: "center" }}>{error}</p>}
        </div>
      </main>
    </>
  );
}
