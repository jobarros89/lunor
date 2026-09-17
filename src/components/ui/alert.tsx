import type { ComponentProps, ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Alert({
  children,
  title,
  variant = "info",
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  title?: ReactNode;
  variant?: "info" | "success" | "error";
}) {
  const Icon =
    variant === "error"
      ? TriangleAlert
      : variant === "success"
        ? CircleCheck
        : Info;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      data-slot="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-sm",
        variant === "error"
          ? "border-destructive/25 bg-destructive/5 text-destructive"
          : variant === "success"
            ? "border-emerald-600/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
            : "bg-muted/50 text-foreground",
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1 break-words leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
