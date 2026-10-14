"use client";

import { converters, supportedExtensions } from "@/lib/registry";
import { useLocale } from "./LocaleProvider";

export default function Figures() {
  const { t } = useLocale();
  const rows = [
    { key: "conversions", label: "Conversions", value: converters.length },
    {
      key: "formats",
      label: t({ fr: "Formats lus", en: "Formats read" }),
      value: supportedExtensions.length,
    },
    {
      key: "bytes",
      label: t({ fr: "Octets envoyés", en: "Bytes sent" }),
      value: 0,
    },
  ];

  return (
    <dl className="border-t border-edge">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-baseline justify-between border-b border-rule py-2"
        >
          <dt className="label text-faint">{row.label}</dt>
          <dd className="nums font-mono text-[15px]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
