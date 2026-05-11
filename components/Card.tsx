"use client";
import { Card as CardType } from "@/lib/types";
import { isRed, rankLabel, suitSymbol } from "@/lib/durak";

interface Props {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  animDelay?: number;
}

export default function Card({ card, faceDown, small, disabled, selected, onClick, animDelay }: Props) {
  const style: React.CSSProperties = animDelay !== undefined ? { animationDelay: `${animDelay}ms` } : {};

  if (faceDown || !card) {
    return <div className={`playing-card card-back ${small ? "card-sm" : ""} animate-deal`} style={style} />;
  }

  const red = isRed(card.suit);
  const sym = suitSymbol(card.suit);
  const rank = rankLabel(card.rank);

  return (
    <div
      className={`playing-card ${red ? "card-red" : "card-black"} ${small ? "card-sm" : ""} ${disabled ? "card-disabled" : ""} animate-deal`}
      style={{
        ...style,
        outline: selected ? "2px solid var(--gold)" : undefined,
        outlineOffset: selected ? "2px" : undefined,
      }}
      onClick={disabled ? undefined : onClick}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
        <span>{rank}</span>
        <span style={{ fontSize: small ? "9px" : "11px" }}>{sym}</span>
      </div>
      <div className="card-suit-center" aria-hidden="true">{sym}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1, transform: "rotate(180deg)" }}>
        <span>{rank}</span>
        <span style={{ fontSize: small ? "9px" : "11px" }}>{sym}</span>
      </div>
    </div>
  );
}
