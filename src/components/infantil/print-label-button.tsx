"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { qrSvgMarkup } from "@/lib/qr";

const PROD_ORIGIN = "https://lunorservice.com";

export function PrintLabelButton({
  childName,
  className,
  code,
  pickupToken,
  eventTitle,
  eventContext,
}: {
  childName: string;
  className: string | null;
  code: string;
  pickupToken: string;
  eventTitle: string;
  eventContext: string;
}) {
  function printLabel() {
    const popup = window.open("", "_blank", "width=520,height=420");
    if (!popup) return;

    const currentUrl = `${window.location.origin.replace(/\/$/, "")}/q/${pickupToken}`;
    const pickupUrl = new TextEncoder().encode(currentUrl).length <= 78
      ? currentUrl
      : `${PROD_ORIGIN}/q/${pickupToken}`;
    const qr = qrSvgMarkup(pickupUrl, 3, 4);

    popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${code}</title>
  <style>
    @page { size: 62mm 40mm; margin: 3mm; }
    body { font-family: Arial, sans-serif; margin: 0; color: #111; }
    .label { border: 1px solid #111; border-radius: 10px; padding: 8px; display: grid; grid-template-columns: 1fr 86px; gap: 8px; align-items: center; }
    .brand { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
    .name { font-size: 17px; font-weight: 700; margin-top: 6px; line-height: 1.05; }
    .meta { font-size: 10px; margin-top: 3px; }
    .context { font-size: 10px; font-weight: 700; margin-top: 3px; }
    .code { font-size: 24px; font-weight: 800; letter-spacing: .12em; margin-top: 7px; }
    .qr { text-align: center; font-size: 8px; }
    .qr svg { width: 82px; height: 82px; display: block; margin: 0 auto 2px; }
  </style>
</head>
<body>
  <div class="label">
    <div>
      <div class="brand">LUNOR Kids</div>
      <div class="name">${escapeHtml(childName)}</div>
      <div class="meta">${escapeHtml(className ?? "Turma não definida")}</div>
      <div class="meta">${escapeHtml(eventTitle)}</div>
      ${eventContext ? `<div class="context">${escapeHtml(eventContext)}</div>` : ""}
      <div class="code">${escapeHtml(code)}</div>
    </div>
    <div class="qr">${qr}<span>Retirada</span></div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); };</script>
</body>
</html>`);
    popup.document.close();
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[char] ?? char;
  });
}
