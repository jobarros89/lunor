"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintLabelButton({
  childName,
  className,
  code,
  eventTitle,
  eventContext,
}: {
  childName: string;
  className: string | null;
  code: string;
  eventTitle: string;
  eventContext: string;
}) {
  function printLabel() {
    const popup = window.open("", "_blank", "width=520,height=420");
    if (!popup) return;

    popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${code}</title>
  <style>
    @page { size: 62mm 40mm; margin: 3mm; }
    body { font-family: Arial, sans-serif; margin: 0; color: #111; }
    .label { border: 1px solid #111; border-radius: 10px; padding: 10px; }
    .brand { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
    .name { font-size: 20px; font-weight: 700; margin-top: 8px; }
    .meta { font-size: 12px; margin-top: 4px; }
    .context { font-size: 13px; font-weight: 700; margin-top: 4px; }
    .code { font-size: 30px; font-weight: 800; letter-spacing: .14em; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="label">
    <div class="brand">LUNOR Kids</div>
    <div class="name">${escapeHtml(childName)}</div>
    <div class="meta">${escapeHtml(className ?? "Turma não definida")}</div>
    <div class="meta">${escapeHtml(eventTitle)}</div>
    ${eventContext ? `<div class="context">${escapeHtml(eventContext)}</div>` : ""}
    <div class="code">${escapeHtml(code)}</div>
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
