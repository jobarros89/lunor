"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printKidsLabel } from "@/lib/kids-label-print";
import type { KidsPrintSettings } from "@/lib/kids-print-settings";

const PROD_ORIGIN = "https://lunorservice.com";

export function PrintLabelButton({
  churchName,
  childName,
  childAge,
  className,
  guardianName,
  restrictedPickupNames,
  allergies,
  specialNeeds,
  code,
  pickupToken,
  eventTitle,
  eventContext,
  printSettings,
}: {
  churchName: string;
  childName: string;
  childAge: string;
  className: string | null;
  guardianName: string | null;
  restrictedPickupNames: string[];
  allergies: string | null;
  specialNeeds: string | null;
  code: string;
  pickupToken: string;
  eventTitle: string;
  eventContext: string;
  printSettings: KidsPrintSettings;
}) {
  function printLabel() {
    const currentUrl = `${window.location.origin.replace(/\/$/, "")}/q/${pickupToken}`;
    const pickupUrl = new TextEncoder().encode(currentUrl).length <= 78
      ? currentUrl
      : `${PROD_ORIGIN}/q/${pickupToken}`;

    printKidsLabel(printSettings, {
      churchName,
      childName,
      childAge,
      className,
      guardianName,
      restrictedPickupNames,
      allergies,
      specialNeeds,
      code,
      pickupUrl,
      eventTitle,
      eventContext,
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={printLabel}
      className="h-9 rounded-full px-3"
    >
      <Printer className="size-4" />
      Etiqueta
    </Button>
  );
}
