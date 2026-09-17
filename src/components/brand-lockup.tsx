import { cn } from "@/lib/utils";

export function BrandLockup({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("inline-flex flex-col", className)}>
      <span className={cn(
        "font-bold uppercase leading-none text-foreground",
        compact ? "text-lg tracking-[0.22em]" : "text-[2rem] tracking-[0.22em]"
      )}>
        LUNOR
      </span>
      <span className={cn(
        "mt-2 uppercase leading-relaxed text-muted-foreground",
        compact ? "text-[10px] tracking-[0.03em]" : "text-[10px] tracking-[0.08em]"
      )}>
        Presença · preparo · propósito
      </span>
    </div>
  );
}
