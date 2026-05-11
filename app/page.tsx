"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durak_pid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("durak_pid", id); }
  return id;
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");

  useEffect(() => {
    const saved = localStorage.getItem("durak_name");
    if (saved) setName(saved);
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
    if (!code.trim()) return setError("Code eingeben");
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
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 1 }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 className="font-display" style={{ fontSize: "72px", fontWeight: 900, letterSpacing: "-2px", color: "var(--cream)", lineHeight: 1, marginBottom: "4px" }}>
            Durak
          </h1>
          <p style={{ color: "var(--gold)", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 600 }}>
            Kartenmafija &mdash; 2 bis 4 Spieler
          </p>
        </div>

        <div className="panel" style={{ padding: "32px" }}>

          {/* Name immer sichtbar */}
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "8px" }}>
            Dein Name
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (tab === "create" ? create() : join())}
            placeholder="Spitzname eingeben"
            maxLength={20}
            style={{ marginBottom: "24px" }}
          />

          {/* Tab Switch */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "3px", marginBottom: "24px" }}>
            {(["create", "join"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  transition: "all 0.15s",
                  background: tab === t ? "rgba(201,164,85,0.15)" : "transparent",
                  color: tab === t ? "var(--gold)" : "var(--text-dim)",
                  fontFamily: "'Mulish', sans-serif",
                }}
              >
                {t === "create" ? "Neue Lobby" : "Beitreten"}
              </button>
            ))}
          </div>

          {tab === "join" && (
            <>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "8px" }}>
                Lobby Code
              </label>
              <input
                className="input font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="ABCDE"
                maxLength={5}
                style={{ marginBottom: "24px", textAlign: "center", fontSize: "20px", letterSpacing: "0.3em" }}
              />
            </>
          )}

          <button
            className="btn btn-gold"
            onClick={tab === "create" ? create : join}
            disabled={loading}
            style={{ width: "100%", padding: "14px", fontSize: "12px" }}
          >
            {loading ? "Einen Moment..." : tab === "create" ? "Lobby erstellen" : "Beitreten"}
          </button>

          {error && (
            <p style={{ marginTop: "16px", color: "#f87171", fontSize: "13px", textAlign: "center" }}>
              {error}
            </p>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "11px", color: "var(--text-dim)" }}>
          Russisches Kartenspiel &bull; 36 Karten &bull; Echtzeit Multiplayer
        </p>
      </div>
    </main>
  );
}
