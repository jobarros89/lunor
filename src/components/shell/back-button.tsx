"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BackButton({ churchSlug }: { churchSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const home = `/${churchSlug}`;

  if (pathname === home || pathname === `${home}/`) return null;

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(home);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={goBack}
      className="mb-3 h-10 rounded-full px-3 text-muted-foreground hover:text-foreground"
      aria-label="Voltar"
    >
      <ArrowLeft className="size-4" />
      Voltar
    </Button>
  );
}
