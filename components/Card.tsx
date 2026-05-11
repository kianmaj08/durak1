"use client";
import { Card as CardType } from "@/lib/types";
import { isRed, rankLabel, suitSymbol } from "@/lib/durak";

interface Props {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export default function Card({ card, faceDown, small, disabled, onClick }: Props) {
  if (faceDown || !card) {
    return <div className={`card back ${small ? "card-sm" : ""}`} />;
  }
  const red = isRed(card.suit);
  return (
    <div
      className={`card ${small ? "card-sm" : ""} ${red ? "red" : ""} ${disabled ? "disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
    >
      <div>
        {rankLabel(card.rank)}
        {suitSymbol(card.suit)}
      </div>
      <div className="self-end">
        {suitSymbol(card.suit)}
        {rankLabel(card.rank)}
      </div>
    </div>
  );
}
