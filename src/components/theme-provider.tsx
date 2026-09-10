"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "theme";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = theme === "system" ? systemTheme() : theme;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  enableSystem = true,
}: {
  children: React.ReactNode;
  attribute?: "class";
  defaultTheme?: Theme;
  enableSystem?: boolean;
}) {
  const safeDefault = !enableSystem && defaultTheme === "system" ? "light" : defaultTheme;
  const [theme, setThemeState] = useState<Theme>(safeDefault);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    safeDefault === "dark" ? "dark" : "light"
  );

  const setTheme = useCallback((nextTheme: Theme) => {
    const normalized = !enableSystem && nextTheme === "system" ? "light" : nextTheme;
    localStorage.setItem(STORAGE_KEY, normalized);
    setThemeState(normalized);
    setResolvedTheme(applyTheme(normalized));
  }, [enableSystem]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: Theme =
      stored === "light" || stored === "dark" || (enableSystem && stored === "system")
        ? stored
        : safeDefault;

    // A leitura do localStorage só existe no browser. A sincronização após a
    // hidratação é intencional para manter SSR determinístico e respeitar a
    // preferência persistida sem acessar window durante o render do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    setResolvedTheme(applyTheme(initial));
  }, [enableSystem, safeDefault]);

  useEffect(() => {
    if (theme !== "system" || !enableSystem) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, enableSystem]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return context;
}
