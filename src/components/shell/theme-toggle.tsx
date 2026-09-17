"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar tema"
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent"
    >
      <Sun className="size-[18px] dark:hidden" strokeWidth={1.8} />
      <Moon className="hidden size-[18px] dark:block" strokeWidth={1.8} />
    </button>
  );
}
