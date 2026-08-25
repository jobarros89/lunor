import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getPlatformAdmin } from "@/lib/platform";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SessionKeeper } from "@/components/shell/session-keeper";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getPlatformAdmin();

  return (
    <div className="min-h-dvh">
      <SessionKeeper />
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] md:px-8">
          <Link href="/painel" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-foreground text-background">
              <ShieldCheck className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Painel da Plataforma</p>
              <p className="text-[11px] text-muted-foreground">LUNOR</p>
            </div>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 md:px-8">
        {children}
      </main>
    </div>
  );
}

