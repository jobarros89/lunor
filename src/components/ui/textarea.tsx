import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "lunor-control min-h-28 w-full text-base leading-relaxed transition-colors placeholder:text-muted-foreground md:text-sm aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
