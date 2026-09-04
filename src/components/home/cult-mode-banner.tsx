"use client";

import Link from "next/link";
import { MonitorPlay } from "lucide-react";

export function CultModeBanner({
  churchSlug,
  eventId,
  eventTitle,
  startsAt,
  nowMs,
}: {
  churchSlug: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  nowMs: number;
}) {
  const start = new Date(startsAt).getTime();
  const diffMs = start - nowMs;
  const diffMin = Math.max(0, Math.floor(diffMs / 60_000));

  const timeText =
    diffMin <= 0
      ? "Começando agora"
      : diffMin < 60
        ? `Começa em ${diffMin} min`
        : `Começa em ${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? String(diffMin % 60).padStart(2, "0") : ""}`;

  return (
    <Link
      href={`/${churchSlug}/escalas/${eventId}/modo-culto`}
      className="group flex items-center gap-4 rounded-3xl bg-[#6e5ce6] p-5 text-white shadow-lg transition-transform hover:-translate-y-0.5"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <MonitorPlay className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
          Modo Culto · {timeText}
        </p>
        <p className="mt-1 truncate text-lg font-semibold">{eventTitle}</p>
        <p className="mt-0.5 text-sm text-white/70">
          Controle de presença, ordem do culto e repertório ao vivo
        </p>
      </div>
    </Link>
  );
}
