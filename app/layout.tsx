import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Durak Multiplayer",
  description: "Durak Kartenspiel mit Freunden",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-slate-900 text-white">
        {children}
      </body>
    </html>
  );
}
