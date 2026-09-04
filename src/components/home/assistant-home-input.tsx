"use client";

import { Sparkles, X } from "lucide-react";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AssistantHomeInput({
  churchSlug,
  ministryId,
  ministryName,
}: {
  churchSlug: string;
  ministryId: string;
  ministryName: string;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/40"
            aria-label="Abrir Assistente LUNOR"
          />
        }
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#6e5ce6] text-white">
          <Sparkles className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">
          Pergunte sobre sua equipe, escalas ou repertório...
        </span>
      </SheetTrigger>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="h-[100dvh] w-full max-w-none gap-0 overflow-hidden border-l-0 data-[side=right]:w-full data-[side=right]:max-w-none sm:data-[side=right]:w-[min(100vw,42rem)] sm:data-[side=right]:border-l"
      >
        <SheetHeader className="sticky top-0 z-20 shrink-0 border-b bg-popover/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur sm:px-5 sm:pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#6e5ce6] text-white">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-lg">Assistente LUNOR</SheetTitle>
              <SheetDescription className="mt-0.5 truncate">
                <span className="sm:hidden">Contexto: {ministryName}</span>
                <span className="hidden sm:inline">
                  Contexto atual: {ministryName} · você pode perguntar sobre outros módulos que gerencia.
                </span>
              </SheetDescription>
            </div>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 rounded-full px-3"
                  aria-label="Fechar Assistente LUNOR"
                />
              }
            >
              <X className="size-4" />
              <span className="text-xs font-semibold">Fechar</span>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
          <AssistantPanel
            churchSlug={churchSlug}
            ministryId={ministryId}
            ministryName={ministryName}
            compact
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
