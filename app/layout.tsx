import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Convertisseur local",
  description:
    "Convertir documents, tableurs, images, audio, vidéo, archives, polices, modèles 3D et code sans téléverser un seul fichier.",
  keywords: [
    "convertisseur",
    "hors ligne",
    "webassembly",
    "ffmpeg",
    "pdf",
    "docx",
    "confidentialité",
  ],
  openGraph: {
    title: "Convertisseur local",
    description:
      "Un convertisseur de fichiers qui tourne dans votre navigateur.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
};

// Runs before the first paint so a stored choice never shows up as a flash of
// the other theme. Without a stored choice the CSS media query decides.
const APPLY_STORED_THEME = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_STORED_THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
