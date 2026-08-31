"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  eventTitle,
  eventContext,
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
  eventTitle: string;
  eventContext: string;
}) {
  function printLabel() {
    const popup = window.open("", "_blank", "width=620,height=560");
    if (!popup) return;

    const restriction = restrictedPickupNames.length
      ? `Não entregar para: ${restrictedPickupNames.join(", ")}`
      : "";

    popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${escapeHtml(code)}</title>
  <style>
    @page { size: 62mm 50mm; margin: 2.5mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; color: #111; }
    .label { border: 1px solid #111; border-radius: 8px; padding: 7px; }
    .church { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .brand { font-size: 8px; margin-top: 1px; color: #444; text-transform: uppercase; letter-spacing: .1em; }
    .name { font-size: 18px; line-height: 1.05; font-weight: 800; margin-top: 5px; }
    .meta { font-size: 10px; margin-top: 3px; }
    .meta strong { font-weight: 700; }
    .event { font-size: 9px; margin-top: 3px; color: #333; }
    .security { display: flex; align-items: end; justify-content: space-between; gap: 8px; margin-top: 6px; padding-top: 5px; border-top: 1px solid #bbb; }
    .security-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .code { font-size: 27px; line-height: 1; font-weight: 900; letter-spacing: .12em; }
    .alert { margin-top: 5px; border: 2px solid #111; border-radius: 5px; padding: 4px 5px; font-size: 9px; font-weight: 700; line-height: 1.2; }
    .attention { margin-top: 3px; border: 1px solid #555; border-radius: 5px; padding: 3px 5px; font-size: 8px; line-height: 1.2; }
  </style>
</head>
<body>
  <div class="label">
    <div class="church">${escapeHtml(churchName)}</div>
    <div class="brand">LUNOR Kids</div>
    <div class="name">${escapeHtml(childName)}</div>
    <div class="meta"><strong>Idade / Sala:</strong> ${escapeHtml(childAge)}${className ? ` · ${escapeHtml(className)}` : " · Turma não definida"}</div>
    <div class="meta"><strong>Responsável:</strong> ${escapeHtml(guardianName ?? "Não informado")}</div>
    <div class="event">${escapeHtml(eventTitle)}${eventContext ? ` · ${escapeHtml(eventContext)}` : ""}</div>
    ${allergies ? `<div class="alert">⚠ ALERTA DE ALERGIA: ${escapeHtml(allergies)}</div>` : ""}
    ${restriction ? `<div class="alert">RESTRIÇÃO DE SAÍDA: ${escapeHtml(restriction)}</div>` : ""}
    ${specialNeeds ? `<div class="attention"><strong>ATENÇÃO ESPECIAL:</strong> ${escapeHtml(specialNeeds)}</div>` : ""}
    <div class="security">
      <div class="security-label">Código de segurança</div>
      <div class="code">${escapeHtml(code)}</div>
    </div>
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
