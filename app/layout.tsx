import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Instrument_Serif,
} from "next/font/google";
import { LocaleProvider } from "@/components/LocaleProvider";
import { DEFAULT_LOCALE, LOCALE_KEY, LOCALES } from "@/lib/i18n";
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

// The <title> is rendered by LocaleProvider so it follows the chosen language.
export const metadata: Metadata = {
  description:
    "Convertir documents, tableurs, images, audio, vidéo, archives, polices, modèles 3D et code sans téléverser un seul fichier.",
  // Kept out of search engines. next.config.mjs sends the same rule as an
  // X-Robots-Tag header, which also covers the Wasm and worker files.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
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

// The server always renders French. When another language is stored, the page
// stays hidden (see globals.css) until LocaleProvider has re-rendered it, so
// the French text never flashes. The timeout is a safety net if the scripts
// fail to load.
const APPLY_STORED_LOCALE = `try{var l=localStorage.getItem(${JSON.stringify(LOCALE_KEY)});if(l!==${JSON.stringify(DEFAULT_LOCALE)}&&${JSON.stringify(LOCALES)}.indexOf(l)>-1){var r=document.documentElement;r.lang=l;r.dataset.langPending="";setTimeout(function(){delete r.dataset.langPending},3000)}}catch(e){}`;

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
        <script dangerouslySetInnerHTML={{ __html: APPLY_STORED_LOCALE }} />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
