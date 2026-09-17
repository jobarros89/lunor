import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native selection keeps platform pickers and existing form semantics. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "lunor-control w-full text-base transition-colors md:text-sm aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
