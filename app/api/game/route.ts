import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";
import { GameState } from "@/lib/types";
import {
  applyAttack, applyDefense, applyPass, applyTake,
  applyTimeout, startGame, tryEndRound,
} from "@/lib/durak";

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;
  const sb = getServerSupabase();

  try {
    if (action === "create") {
      const { name, playerId } = body;
      if (!name || !playerId) return NextResponse.json({ error: "name und playerId nötig" }, { status: 400 });
      let code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const c = genCode();
        const { data: exists } = await sb.from("games").select("code").eq("code", c).maybeSingle();
        if (!exists) { code = c; break; }
      }
      if (!code) return NextResponse.json({ error: "Konnte keinen Code erzeugen" }, { status: 500 });
      const state: GameState = {
        code, hostId: playerId, phase: "lobby",
        players: [{ id: playerId, name, hand: [] }],
        deck: [], discard: [], trump: null, trumpCard: null, table: [],
        attackerIdx: 0, defenderIdx: 1, loserId: null,
        takeRequested: false, lastAction: "Lobby erstellt",
        turnStartedAt: null, createdAt: Date.now(),
      };
      const { error } = await sb.from("games").insert({ code, state });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ code, state });
    }

    if (action === "join") {
      const { code, name, playerId } = body;
      const { data, error } = await sb.from("games").select("state").eq("code", code).maybeSingle();
      if (error || !data) return NextResponse.json({ error: "Lobby nicht gefunden" }, { status: 404 });
      const state: GameState = data.state;
      if (state.phase !== "lobby") return NextResponse.json({ error: "Spiel läuft bereits" }, { status: 400 });
      if (state.players.length >= 4) return NextResponse.json({ error: "Lobby voll" }, { status: 400 });
      if (!state.players.find((p) => p.id === playerId))
        state.players.push({ id: playerId, name, hand: [] });
      state.lastAction = `${name} ist beigetreten`;
      await sb.from("games").update({ state, updated_at: new Date().toISOString() }).eq("code", code);
      return NextResponse.json({ state });
    }

    if (action === "start") {
      const { code, playerId } = body;
      const { data } = await sb.from("games").select("state").eq("code", code).maybeSingle();
      if (!data) return NextResponse.json({ error: "Lobby nicht gefunden" }, { status: 404 });
      const state: GameState = data.state;
      if (state.hostId !== playerId) return NextResponse.json({ error: "Nur Host kann starten" }, { status: 403 });
      if (state.players.length < 2) return NextResponse.json({ error: "Mindestens 2 Spieler" }, { status: 400 });
      const next = startGame(state.players, state.hostId, state.code);
      await sb.from("games").update({ state: next, updated_at: new Date().toISOString() }).eq("code", code);
      return NextResponse.json({ state: next });
    }

    if (action === "attack" || action === "defend" || action === "take" || action === "pass") {
      const { code, playerId, card, pairIdx } = body;
      const { data } = await sb.from("games").select("state").eq("code", code).maybeSingle();
      if (!data) return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });
      let state: GameState = data.state;
      if (action === "attack") state = applyAttack(state, playerId, card);
      else if (action === "defend") state = applyDefense(state, playerId, card, pairIdx);
      else if (action === "take") state = applyTake(state, playerId);
      else if (action === "pass") state = applyPass(state, playerId);
      state = tryEndRound(state);
      await sb.from("games").update({ state, updated_at: new Date().toISOString() }).eq("code", code);
      return NextResponse.json({ state });
    }

    if (action === "timeout") {
      const { code } = body;
      const { data } = await sb.from("games").select("state").eq("code", code).maybeSingle();
      if (!data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
      const prev: GameState = data.state;
      const next = applyTimeout(prev);
      // Nur updaten wenn sich was geändert hat
      if (next.lastAction !== prev.lastAction || next.phase !== prev.phase) {
        await sb.from("games").update({ state: next, updated_at: new Date().toISOString() }).eq("code", code);
      }
      return NextResponse.json({ state: next });
    }

    if (action === "restart") {
      const { code, playerId } = body;
      const { data } = await sb.from("games").select("state").eq("code", code).maybeSingle();
      if (!data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
      const state: GameState = data.state;
      if (state.hostId !== playerId) return NextResponse.json({ error: "Nur Host" }, { status: 403 });
      const reset: GameState = {
        ...state, phase: "lobby", deck: [], discard: [], trump: null,
        trumpCard: null, table: [], attackerIdx: 0, defenderIdx: 1,
        loserId: null, takeRequested: false, lastAction: "Neue Runde",
        turnStartedAt: null,
        players: state.players.map((p) => ({ ...p, hand: [], passed: false })),
      };
      await sb.from("games").update({ state: reset, updated_at: new Date().toISOString() }).eq("code", code);
      return NextResponse.json({ state: reset });
    }

    return NextResponse.json({ error: "Unbekannte Action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
