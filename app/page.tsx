import { Cpu, Lock, ShieldCheck, WifiOff, Zap } from "lucide-react";
import Workspace from "@/components/Workspace";
import Catalogue from "@/components/Catalogue";
import HeroStats from "@/components/HeroStats";

const FEATURES = [
  {
    icon: Lock,
    title: "Vos fichiers restent chez vous",
    body: "Aucun formulaire d'upload, aucune requête réseau contenant vos données. Le traitement se fait dans la mémoire de l'onglet, puis tout disparaît.",
  },
  {
    icon: Cpu,
    title: "WebAssembly à pleine vitesse",
    body: "FFmpeg, Brotli, Whisper et les décodeurs d'images sont compilés en Wasm et exécutés par votre processeur, pas par une file d'attente distante.",
  },
  {
    icon: WifiOff,
    title: "Fonctionne hors ligne",
    body: "Une fois la page et les moteurs chargés, la connexion devient facultative pour la grande majorité des conversions.",
  },
  {
    icon: Zap,
    title: "Sans limite de quota",
    body: "Pas de compte, pas de filigrane, pas de « 2 fichiers par jour ». La seule limite est la mémoire disponible de votre machine.",
  },
];

export default function Home() {
  return (
    <main className="relative">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.9)]">
            <ShieldCheck className="size-5" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            Convertisseur local
          </span>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <a
            href="#catalogue"
            className="rounded-lg px-3 py-1.5 text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            Catalogue
          </a>
          <a
            href="#convertisseur"
            className="rounded-lg border border-white/12 px-3 py-1.5 text-white/80 transition hover:bg-white/8 hover:text-white"
          >
            Convertir
          </a>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 pb-12 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/60">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          100 % côté client — rien ne transite par un serveur
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
          Convertissez <span className="text-gradient">n&apos;importe quel fichier</span>{" "}
          sans jamais le téléverser
        </h1>

        <HeroStats />
      </section>

      <Workspace />

      <section className="mx-auto w-full max-w-6xl px-5 py-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="glass rounded-3xl p-6">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-brand-400">
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/45">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Catalogue />

      <footer className="border-t border-white/6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-xs text-white/35 sm:flex-row">
          <p>
            Convertisseur local — tout le traitement a lieu dans votre
            navigateur.
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-400/60" />
            Aucune donnée collectée, aucun fichier stocké.
          </p>
        </div>
      </footer>
    </main>
  );
}
