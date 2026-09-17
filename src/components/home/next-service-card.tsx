import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export function NextServiceCard({
  eyebrow,
  title,
  day,
  month,
  dateLabel,
  timeLabel,
  status,
  children,
  href,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  day: string;
  month: string;
  dateLabel: string;
  timeLabel: string;
  status?: ReactNode;
  children: ReactNode;
  href: string;
  actionLabel: string;
}) {
  return (
    <section
      className="lunor-prism relative overflow-hidden rounded-2xl border shadow-[var(--shadow-surface)]"
      aria-labelledby="next-service-title"
    >
      <div className="relative z-10 space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em]">
            {eyebrow}
          </p>
          {status}
        </div>
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="flex w-16 shrink-0 flex-col items-center rounded-xl border border-foreground/10 bg-background/80 px-2 py-3">
            <span className="text-3xl font-semibold leading-none tabular-nums">
              {day}
            </span>
            <span className="mt-1.5 text-xs font-medium uppercase text-muted-foreground">
              {month}
            </span>
          </div>
          <div className="min-w-0 space-y-2">
            <h1
              id="next-service-title"
              className="font-editorial text-[clamp(1.875rem,3.5vw,3rem)] font-medium leading-tight tracking-tight [overflow-wrap:anywhere]"
            >
              {title}
            </h1>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span className="capitalize text-muted-foreground">
                {dateLabel}
              </span>
              <span className="font-medium">{timeLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-foreground/10 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 text-sm leading-relaxed">
            {children}
          </div>
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-between gap-6 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong lg:shrink-0"
          >
            {actionLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
