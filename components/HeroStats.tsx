"use client";

import { converters, supportedExtensions } from "@/lib/registry";

export default function HeroStats() {
  const stats = [
    { value: `${converters.length}`, label: "conversions" },
    { value: `${supportedExtensions.length}`, label: "formats lus" },
    { value: "0", label: "octet envoyé" },
  ];

  return (
    <>
      <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-white/50">
        Documents, tableurs, images, audio, vidéo, archives, polices, modèles 3D
        et code source. {converters.length} conversions,{" "}
        {supportedExtensions.length} formats reconnus, zéro octet envoyé.
      </p>

      <dl className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-2xl px-3 py-4 text-center">
            <dt className="text-2xl font-bold text-white sm:text-3xl">
              {stat.value}
            </dt>
            <dd className="mt-0.5 text-[11px] uppercase tracking-wider text-white/35">
              {stat.label}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
