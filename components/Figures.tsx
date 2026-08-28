"use client";

import { converters, supportedExtensions } from "@/lib/registry";

export default function Figures() {
  const rows = [
    { label: "Conversions", value: converters.length },
    { label: "Formats lus", value: supportedExtensions.length },
    { label: "Octets envoyés", value: 0 },
  ];

  return (
    <dl className="border-t border-edge">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between border-b border-rule py-2"
        >
          <dt className="label text-faint">{row.label}</dt>
          <dd className="nums font-mono text-[15px]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
