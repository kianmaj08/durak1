"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("durak_pid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("durak_pid", id);
  }
  return id;
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("durak_name");
    if (saved) setName(saved);
  }, []);

  async function create() {
    if (!name.trim()) return setError("Name eingeben");
    setLoading(true);
    setError("");
    localStorage.setItem("durak_name", name);
    const playerId = getPlayerId();
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    setLoading(true);
    setError("");
    localStorage.setItem("durak_name", name);
    const playerId = getPlayerId();
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", name, playerId, code: code.toUpperCase() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) return setError(data.error);
    router.push(`/game/${code.toUpperCase()}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-black/40 backdrop-blur rounded-2xl p-8 shadow-2xl border border-white/10">
        <h1 className="text-4xl font-black mb-2 text-center">Durak</h1>
        <p className="text-center text-white/60 mb-8">Multiplayer mit Freunden</p>

        <label className="block text-sm mb-1 text-white/70">Dein Name</label>
        <input
          className="w-full px-4 py-3 rounded bg-white/10 border border-white/20 mb-4 focus:outline-none focus:border-white/50"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Kian"
          maxLength={20}
        />

        <button
          onClick={create}
          disabled={loading}
          className="w-full py-3 rounded bg-emerald-500 hover:bg-emerald-400 transition font-bold mb-6 disabled:opacity-50"
        >
          Neue Lobby erstellen
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-sm">oder</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        <label className="block text-sm mb-1 text-white/70">Lobby Code</label>
        <input
          className="w-full px-4 py-3 rounded bg-white/10 border border-white/20 mb-4 focus:outline-none focus:border-white/50 uppercase tracking-widest text-center font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCDE"
          maxLength={5}
        />

        <button
          onClick={join}
          disabled={loading}
          className="w-full py-3 rounded bg-blue-500 hover:bg-blue-400 transition font-bold disabled:opacity-50"
        >
          Lobby beitreten
        </button>

        {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
      </div>
    </main>
  );
}
