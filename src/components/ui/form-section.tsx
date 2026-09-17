import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  children,
  className,
  ...props
}: Omit<ComponentProps<"fieldset">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <fieldset
      className={cn(
        "min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5",
        className,
      )}
      {...props}
    >
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {children}
    </fieldset>
  );
}
