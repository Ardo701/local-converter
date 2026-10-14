"use client";

import Catalogue from "@/components/Catalogue";
import Figures from "@/components/Figures";
import GitHubLink from "@/components/GitHubLink";
import LanguageToggle from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import ThemeToggle from "@/components/ThemeToggle";
import Workspace from "@/components/Workspace";

const NOTES = [
  {
    id: "privacy",
    kicker: { fr: "Confidentialité", en: "Privacy" },
    body: {
      fr: "Il n’y a pas de formulaire d’envoi. Les fichiers sont lus dans la mémoire de l’onglet, transformés là, puis oubliés à la fermeture. Aucun compte, aucun quota, aucun filigrane.",
      en: "There is no upload form. Files are read into the tab’s memory, transformed there, then forgotten when it closes. No account, no quota, no watermark.",
    },
  },
  {
    id: "engines",
    kicker: { fr: "Moteurs", en: "Engines" },
    body: {
      fr: "FFmpeg, pdf.js, Brotli et les décodeurs d’images sont compilés en WebAssembly et exécutés par votre processeur. Le premier usage télécharge le moteur ; les suivants sont immédiats.",
      en: "FFmpeg, pdf.js, Brotli and the image decoders are compiled to WebAssembly and run by your processor. The first use downloads the engine; after that, it’s instant.",
    },
  },
  {
    id: "limits",
    kicker: { fr: "Limites", en: "Limits" },
    body: {
      fr: "Un PDF scanné ne rendra pas de texte : il n’y a pas d’OCR. Une vidéo de plusieurs gigaoctets saturera la mémoire de l’onglet bien avant votre disque.",
      en: "A scanned PDF won’t give you any text: there is no OCR. A video of several gigabytes will fill the tab’s memory long before your disk.",
    },
  },
];

export default function Home() {
  const { locale, t } = useLocale();

  return (
    <>
      <header className="border-b border-edge">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <a
            href="#"
            className="display shrink-0 text-[15px] tracking-normal sm:text-[20px]"
          >
            {locale === "en" ? (
              <>
                <span className="italic text-accent">Local</span> converter
              </>
            ) : (
              <>
                Convertisseur <span className="italic text-accent">local</span>
              </>
            )}
          </a>
          {/* Phones get tighter type, gaps and switch padding so the brand,
              both switches and the GitHub link fit from 360 px. */}
          <nav className="flex items-center gap-2 sm:gap-6">
            <span className="label hidden text-faint lg:inline">
              {t({ fr: "Rien ne quitte cet onglet", en: "Nothing leaves this tab" })}
            </span>
            {/* On a phone the two switches need the room; the catalogue is
                just a scroll away. */}
            <a
              href="#catalogue"
              className="hidden text-[13.5px] underline decoration-edge underline-offset-[3px] hover:decoration-accent sm:inline"
            >
              {t({ fr: "Catalogue", en: "Catalog" })}
            </a>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
            <GitHubLink />
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-5xl px-6 pb-12 pt-14 sm:pt-20">
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-12">
            <div className="md:col-span-8">
              <h1 className="display text-[38px] sm:text-[52px]">
                {locale === "en" ? (
                  <>
                    Your files never leave
                    <br />
                    <span className="italic">this tab.</span>
                  </>
                ) : (
                  <>
                    Vos fichiers ne quittent
                    <br />
                    pas <span className="italic">cet onglet.</span>
                  </>
                )}
              </h1>
              <p className="mt-6 max-w-[34rem] text-[15.5px] leading-relaxed text-muted">
                {t({
                  fr: "Documents, tableurs, images, audio, vidéo, archives, polices, modèles 3D, code source. Tout est converti sur votre machine, par votre navigateur, sans qu’un octet parte sur un serveur.",
                  en: "Documents, spreadsheets, images, audio, video, archives, fonts, 3D models, source code. Everything is converted on your machine, by your browser, without a single byte going to a server.",
                })}
              </p>
            </div>
            <div className="md:col-span-4 md:pt-3">
              <Figures />
            </div>
          </div>
        </section>

        <Workspace />

        <section className="mx-auto w-full max-w-5xl px-6 pb-4">
          <div className="grid gap-x-12 gap-y-8 border-t border-edge pt-8 md:grid-cols-3">
            {NOTES.map((note) => (
              <div key={note.id}>
                <h2 className="label text-accent">{t(note.kicker)}</h2>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
                  {t(note.body)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Catalogue />
      </main>

      <footer className="border-t border-edge">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-6">
          <p className="label text-faint">
            {t({ fr: "Convertisseur local", en: "Local converter" })}
          </p>
          <p className="label text-faint">
            {t({
              fr: "Fonctionne hors ligne une fois la page chargée",
              en: "Works offline once the page has loaded",
            })}
          </p>
        </div>
      </footer>
    </>
  );
}
