"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durak_pid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("durak_pid", id); }
  return id;
}

// Floating card decoration
function FloatingCard({ suit, rank, style }: { suit: string; rank: string; style: React.CSSProperties }) {
  const red = suit === "♥" || suit === "♦";
  return (
    <div style={{
      position: "absolute",
      width: "54px",
      height: "78px",
      borderRadius: "7px",
      background: "rgba(250,246,238,0.06)",
      border: "1px solid rgba(250,246,238,0.12)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "5px 6px",
      fontFamily: "'Bodoni Moda', serif",
      fontWeight: 700,
      fontSize: "12px",
      color: red ? "rgba(192,40,26,0.5)" : "rgba(250,246,238,0.3)",
      pointerEvents: "none",
      backdropFilter: "blur(2px)",
      ...style,
    }}>
      <div>{rank}<br /><span style={{ fontSize: "10px" }}>{suit}</span></div>
      <div style={{ alignSelf: "flex-end", transform: "rotate(180deg)" }}>{rank}<br /><span style={{ fontSize: "10px" }}>{suit}</span></div>
    </div>
  );
}

const FLOATING_CARDS = [
  { suit: "♠", rank: "A",  style: { top: "8%",  left: "6%",  transform: "rotate(-18deg)", animationDelay: "0s" } },
  { suit: "♥", rank: "K",  style: { top: "12%", right: "8%", transform: "rotate(14deg)",  animationDelay: "0.6s" } },
  { suit: "♦", rank: "10", style: { bottom: "18%", left: "4%",  transform: "rotate(10deg)",  animationDelay: "1.2s" } },
  { suit: "♣", rank: "D",  style: { bottom: "22%", right: "5%", transform: "rotate(-12deg)", animationDelay: "0.3s" } },
  { suit: "♥", rank: "6",  style: { top: "38%", left: "2%",  transform: "rotate(6deg)",   animationDelay: "0.9s" } },
  { suit: "♠", rank: "B",  style: { top: "42%", right: "3%", transform: "rotate(-8deg)",  animationDelay: "1.5s" } },
];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("durak_name");
    if (saved) setName(saved);
    setTimeout(() => nameRef.current?.focus(), 300);
  }, []);

  async function create() {
    if (!name.trim()) return setError("Name eingeben");
    setLoading(true); setError("");
    localStorage.setItem("durak_name", name);
    const playerId = getPlayerId();
    const res = await fetch("/api/game", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name, playerId }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) return setError(data.error);
    router.push(`/game/${data.code}`);
  }

  async function join() {
    if (!name.trim()) return setError("Name eingeben");
    if (code.trim().length < 5) return setError("5-stelligen Code eingeben");
    setLoading(true); setError("");
    localStorage.setItem("durak_name", name);
    const playerId = getPlayerId();
    const res = await fetch("/api/game", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", name, playerId, code: code.toUpperCase() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) return setError(data.error);
    router.push(`/game/${code.toUpperCase()}`);
  }

  return (
    <>
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: var(--rot) translateY(0px); }
          50%       { transform: var(--rot) translateY(-14px); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes suitSpin {
          from { transform: rotate(0deg) scale(1); opacity: 0.06; }
          to   { transform: rotate(360deg) scale(1); opacity: 0.06; }
        }
        .float-card {
          animation: floatY 5s ease-in-out infinite;
        }
        .slide-up { animation: slideUp 0.5s ease forwards; }
        .slide-up-2 { animation: slideUp 0.5s 0.1s ease both; }
        .slide-up-3 { animation: slideUp 0.5s 0.2s ease both; }
        .slide-up-4 { animation: slideUp 0.5s 0.3s ease both; }

        .tab-btn {
          flex: 1;
          padding: 10px;
          border-radius: 7px;
          border: none;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: all 0.2s;
          font-family: 'Mulish', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .tab-btn.active {
          background: rgba(201,164,85,0.18);
          color: var(--gold);
        }
        .tab-btn.inactive {
          background: transparent;
          color: var(--text-dim);
        }
        .tab-btn.inactive:hover {
          color: var(--text);
          background: rgba(255,255,255,0.04);
        }

        .name-input-wrap {
          position: relative;
        }
        .name-input-wrap::before {
          content: '✦';
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gold-dim);
          font-size: 12px;
          pointer-events: none;
        }
        .name-input-wrap .input {
          padding-left: 36px;
        }

        .code-input {
          width: 100%;
          background: rgba(0,0,0,0.4);
          border: 2px solid rgba(201,164,85,0.25);
          border-radius: 10px;
          color: var(--gold);
          padding: 16px;
          font-family: 'Courier Prime', monospace;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0.35em;
          text-align: center;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          text-transform: uppercase;
        }
        .code-input:focus {
          border-color: rgba(201,164,85,0.6);
          box-shadow: 0 0 0 3px rgba(201,164,85,0.1), 0 0 20px rgba(201,164,85,0.05);
        }
        .code-input::placeholder {
          color: rgba(201,164,85,0.2);
          letter-spacing: 0.35em;
        }

        .main-btn {
          width: 100%;
          padding: 15px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-family: 'Mulish', sans-serif;
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .main-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%);
          pointer-events: none;
        }
        .main-btn.create {
          background: linear-gradient(135deg, #c9a455 0%, #9a7228 100%);
          color: #1a0f00;
          box-shadow: 0 6px 24px rgba(201,164,85,0.35), 0 2px 0 rgba(255,255,255,0.15) inset;
        }
        .main-btn.create:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 32px rgba(201,164,85,0.45);
        }
        .main-btn.join {
          background: linear-gradient(135deg, #2a5a2a 0%, #1a3d1a 100%);
          color: var(--cream);
          border: 1px solid rgba(201,164,85,0.3);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        }
        .main-btn.join:hover:not(:disabled) {
          transform: translateY(-2px);
          border-color: rgba(201,164,85,0.6);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .main-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

        .suit-bg {
          position: absolute;
          font-size: 220px;
          opacity: 0.03;
          pointer-events: none;
          user-select: none;
          line-height: 1;
        }
      `}</style>

      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 1, overflow: "hidden" }}>

        {/* Floating decorative cards */}
        {FLOATING_CARDS.map((c, i) => (
          <div key={i} className="float-card" style={{ "--rot": c.style.transform, ...c.style, position: "absolute", animationDelay: c.style.animationDelay } as React.CSSProperties}>
            <FloatingCard suit={c.suit} rank={c.rank} style={{}} />
          </div>
        ))}

        {/* Giant suit background */}
        <span className="suit-bg" style={{ bottom: "-40px", right: "-30px", color: "var(--cream)", fontSize: "280px" }}>♠</span>
        <span className="suit-bg" style={{ top: "-20px", left: "-20px", color: "var(--red)", fontSize: "200px" }}>♥</span>

        <div style={{ width: "100%", maxWidth: "400px", position: "relative" }}>

          {/* Logo block */}
          <div className="slide-up" style={{ textAlign: "center", marginBottom: "36px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
              <span style={{ fontSize: "28px", opacity: 0.5 }}>♦</span>
              <h1 className="font-display" style={{ fontSize: "80px", fontWeight: 900, color: "var(--cream)", lineHeight: 1, letterSpacing: "-2px" }}>
                Durak
              </h1>
              <span style={{ fontSize: "28px", opacity: 0.5 }}>♦</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
              <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, transparent, var(--gold-dim))" }} />
              <p style={{ color: "var(--gold)", fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700 }}>
                Russisches Kartenspiel
              </p>
              <div style={{ height: "1px", width: "40px", background: "linear-gradient(90deg, var(--gold-dim), transparent)" }} />
            </div>
          </div>

          {/* Panel */}
          <div className="panel slide-up-2" style={{ padding: "28px" }}>

            {/* Tab Switch */}
            <div style={{ display: "flex", background: "rgba(0,0,0,0.35)", borderRadius: "9px", padding: "3px", marginBottom: "22px" }}>
              <button className={`tab-btn ${tab === "create" ? "active" : "inactive"}`} onClick={() => { setTab("create"); setError(""); }}>
                Neue Lobby
              </button>
              <button className={`tab-btn ${tab === "join" ? "active" : "inactive"}`} onClick={() => { setTab("join"); setError(""); }}>
                Beitreten
              </button>
            </div>

            {/* Name */}
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "7px" }}>
              Dein Name
            </label>
            <div className="name-input-wrap" style={{ marginBottom: "20px" }}>
              <input
                ref={nameRef}
                className="input"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && (tab === "create" ? create() : join())}
                placeholder="Spitzname"
                maxLength={20}
              />
            </div>

            {/* Code Eingabe bei Join */}
            {tab === "join" && (
              <div className="slide-up" style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "7px" }}>
                  Lobby Code
                </label>
                <input
                  className="code-input"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 5)); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                  placeholder="· · · · ·"
                  maxLength={5}
                  autoFocus
                />
              </div>
            )}

            {/* CTA Button */}
            <button
              className={`main-btn ${tab}`}
              onClick={tab === "create" ? create : join}
              disabled={loading}
            >
              {loading
                ? "Einen Moment..."
                : tab === "create"
                ? "Lobby erstellen  →"
                : "Beitreten  →"}
            </button>

            {error && (
              <p style={{ marginTop: "14px", color: "#f87171", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                {error}
              </p>
            )}
          </div>

          {/* Footer info */}
          <div className="slide-up-4" style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "20px" }}>
            {[
              { icon: "♠♥♦♣", label: "36 Karten" },
              { icon: "⚡", label: "Echtzeit" },
              { icon: "👥", label: "2 bis 4 Spieler" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "14px", marginBottom: "2px" }}>{icon}</div>
                <div style={{ fontSize: "9px", color: "var(--text-dim)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
