import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, icon, action, className }: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed bg-card px-5 py-10 text-center", className)}>
      {icon && <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">{icon}</span>}
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
