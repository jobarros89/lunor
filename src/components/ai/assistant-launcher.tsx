"use client";

import { Sparkles } from "lucide-react";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import {
  Sheet,
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
        className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="border-b pr-14">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#6e5ce6] text-white">
              <Sparkles className="size-5" />
            </span>
            <div>
              <SheetTitle>Assistente LUNOR</SheetTitle>
              <SheetDescription>
                {ministryName} · pergunte, analise e prepare ações antes de confirmar.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
