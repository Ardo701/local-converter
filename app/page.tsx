import Catalogue from "@/components/Catalogue";
import Figures from "@/components/Figures";
import ThemeToggle from "@/components/ThemeToggle";
import Workspace from "@/components/Workspace";

const NOTES = [
  {
    kicker: "Confidentialité",
    body: "Il n’y a pas de formulaire d’envoi. Les fichiers sont lus dans la mémoire de l’onglet, transformés là, puis oubliés à la fermeture. Aucun compte, aucun quota, aucun filigrane.",
  },
  {
    kicker: "Moteurs",
    body: "FFmpeg, pdf.js, Brotli et les décodeurs d’images sont compilés en WebAssembly et exécutés par votre processeur. Le premier usage télécharge le moteur ; les suivants sont immédiats.",
  },
  {
    kicker: "Limites",
    body: "Un PDF scanné ne rendra pas de texte : il n’y a pas d’OCR. Une vidéo de plusieurs gigaoctets saturera la mémoire de l’onglet bien avant votre disque.",
  },
];

export default function Home() {
  return (
    <>
      <header className="border-b border-edge">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <a
            href="#"
            className="display shrink-0 text-[17px] tracking-normal sm:text-[20px]"
          >
            Convertisseur <span className="italic text-accent">local</span>
          </a>
          <nav className="flex items-center gap-3 sm:gap-6">
            <span className="label hidden text-faint lg:inline">
              Rien ne quitte cet onglet
            </span>
            <a
              href="#catalogue"
              className="text-[13.5px] underline decoration-edge underline-offset-[3px] hover:decoration-accent"
            >
              Catalogue
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-5xl px-6 pb-12 pt-14 sm:pt-20">
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-12">
            <div className="md:col-span-8">
              <h1 className="display text-[38px] sm:text-[52px]">
                Vos fichiers ne quittent
                <br />
                pas <span className="italic">cet onglet.</span>
              </h1>
              <p className="mt-6 max-w-[34rem] text-[15.5px] leading-relaxed text-muted">
                Documents, tableurs, images, audio, vidéo, archives, polices,
                modèles 3D, code source. Tout est converti sur votre machine,
                par votre navigateur, sans qu’un octet parte sur un serveur.
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
              <div key={note.kicker}>
                <h2 className="label text-accent">{note.kicker}</h2>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Catalogue />
      </main>

      <footer className="border-t border-edge">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-6">
          <p className="label text-faint">Convertisseur local</p>
          <p className="label text-faint">
            Fonctionne hors ligne une fois la page chargée
          </p>
        </div>
      </footer>
    </>
  );
}
