import Link from "next/link";
import { CalendarCheck2, LayoutDashboard } from "lucide-react";

export type KidsSection = "visao" | "escalas";

export function KidsSectionNav({
  churchSlug,
  active,
}: {
  churchSlug: string;
  active: KidsSection;
}) {
  const items: { key: KidsSection; label: string; href: string; icon: React.ReactNode }[] = [
    {
      key: "visao",
      label: "Visão",
      href: `/${churchSlug}/infantil`,
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      key: "escalas",
      label: "Escalas",
      href: `/${churchSlug}/infantil/escalas`,
      icon: <CalendarCheck2 className="size-4" />,
    },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Seções do Kids">
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
