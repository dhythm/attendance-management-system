import type { Role } from "@/domain/role";
import { roleLabels } from "@/shared/format";

const avatarColors = [
  "linear-gradient(140deg, #38bdf8, #0284c7)",
  "linear-gradient(140deg, #a78bfa, #7c3aed)",
  "linear-gradient(140deg, #fb7185, #e11d48)",
  "linear-gradient(140deg, #fbbf24, #d97706)",
  "linear-gradient(140deg, #34d399, #059669)",
  "linear-gradient(140deg, #818cf8, #4f46e5)",
  "linear-gradient(140deg, #f472b6, #db2777)",
  "linear-gradient(140deg, #2dd4bf, #0d9488)",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return avatarColors[hash % avatarColors.length] ?? "var(--ink)";
}

export function Avatar({ name, seed, large }: { name: string; seed: string; large?: boolean }) {
  return (
    <span
      className={large ? "avatar large" : "avatar"}
      style={{ background: colorFor(seed) }}
      aria-hidden="true"
    >
      {Array.from(name.trim())[0] ?? "?"}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`role-badge ${role}`}>{roleLabels[role]}</span>;
}
