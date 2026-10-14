import type { MetadataRoute } from "next";

/* What Android uses when the page is added to the home screen; iOS reads
   app/apple-icon.png instead. The PNGs are renders of app/icon.svg. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Convertisseur local",
    short_name: "Convertisseur",
    description:
      "Un convertisseur de fichiers qui tourne dans votre navigateur.",
    lang: "fr",
    start_url: "/",
    // Opens in the browser like a bookmark: downloads of converted files are
    // unreliable in standalone web apps, especially on iOS.
    display: "browser",
    background_color: "#f4f2ec",
    theme_color: "#f4f2ec",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
