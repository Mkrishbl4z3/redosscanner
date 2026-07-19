// app/layout.js
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "redos-check — catastrophic backtracking scanner",
  description:
    "Static analysis tool that detects ReDoS-vulnerable regular expressions using automata theory.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${plexMono.variable} ${plexSans.variable}`}>
        {children}
      </body>
    </html>
  );
}