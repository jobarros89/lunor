import Link from "next/link";
import { CalendarCheck2, CalendarDays, Layers3, Music } from "lucide-react";

export type LouvorSection = "escalas" | "acervo" | "repertorios" | "arranjos";

export function LouvorSectionNav({
  churchSlug,
  active,
}: {
  churchSlug: string;
  active: LouvorSection;
}) {
  const items: { key: LouvorSection; label: string; href: string; icon: React.ReactNode }[] = [
    {
      key: "escalas",
      label: "Escalas",
      href: `/${churchSlug}/louvor/escalas`,
      icon: <CalendarCheck2 className="size-4" />,
    },
    {
      key: "acervo",
      label: "Acervo",
      href: `/${churchSlug}/louvor?aba=acervo`,
      icon: <Music className="size-4" />,
    },
    {
      key: "repertorios",
      label: "Repertórios",
      href: `/${churchSlug}/louvor?aba=repertorios`,
      icon: <CalendarDays className="size-4" />,
    },
    {
      key: "arranjos",
      label: "Arranjos",
      href: `/${churchSlug}/louvor?aba=arranjos`,
      icon: <Layers3 className="size-4" />,
    },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Seções do Louvor">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-medium transition ${
            active === item.key
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
