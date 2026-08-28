import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Convertisseur local — 100 % dans votre navigateur",
  description:
    "Convertissez documents, tableurs, images, audio, vidéo, archives, polices, modèles 3D et code sans jamais envoyer un fichier sur un serveur.",
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
      "Tout se passe dans votre navigateur : aucun fichier n'est envoyé sur un serveur.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#06060a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans antialiased">
        <div className="aurora" aria-hidden="true">
          <div
            className="aurora-blob"
            style={{
              width: "46rem",
              height: "46rem",
              top: "-16rem",
              left: "-10rem",
              background:
                "radial-gradient(circle, rgba(124,58,237,0.75), transparent 68%)",
            }}
          />
          <div
            className="aurora-blob"
            style={{
              width: "38rem",
              height: "38rem",
              top: "-8rem",
              right: "-12rem",
              background:
                "radial-gradient(circle, rgba(6,182,212,0.55), transparent 68%)",
              animationDelay: "-6s",
            }}
          />
          <div
            className="aurora-blob"
            style={{
              width: "34rem",
              height: "34rem",
              bottom: "-14rem",
              left: "30%",
              background:
                "radial-gradient(circle, rgba(236,72,153,0.4), transparent 68%)",
              animationDelay: "-11s",
            }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}
