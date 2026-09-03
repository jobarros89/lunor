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

export function AssistantLauncher({
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
            className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex min-h-14 items-center gap-2 rounded-full bg-[#6e5ce6] px-4 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(71,55,170,0.35)] transition hover:-translate-y-0.5 hover:bg-[#5f4fd1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6e5ce6] md:right-6 md:bottom-6"
            aria-label="Abrir Assistente LUNOR"
          />
        }
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
          <Sparkles className="size-4" />
        </span>
        <span className="hidden sm:inline">Assistente LUNOR</span>
        <span className="sm:hidden">LUNOR</span>
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
                <span className="sm:hidden">{ministryName}</span>
                <span className="hidden sm:inline">
                  {ministryName} · pergunte, analise e prepare ações antes de confirmar.
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
