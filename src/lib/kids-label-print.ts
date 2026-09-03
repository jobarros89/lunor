import { qrSvgMarkup } from "@/lib/qr";
import {
  kidsPrintPageSize,
  type KidsPrintSettings,
} from "@/lib/kids-print-settings";

export type KidsLabelPrintData = {
  churchName: string;
  childName: string;
  childAge: string;
  className: string | null;
  guardianName: string | null;
  restrictedPickupNames: string[];
  allergies: string | null;
  specialNeeds: string | null;
  code: string;
  pickupUrl: string;
  eventTitle: string;
  eventContext: string;
};

export function printKidsLabel(
  settings: KidsPrintSettings,
  data: KidsLabelPrintData
) {
  const popup = window.open("", "_blank", "width=620,height=560");
  if (!popup) return false;

  const page = kidsPrintPageSize(settings);
  const compact = page.heightMm <= 35 || page.widthMm <= 45;
  const qrSize = compact ? 34 : 54;
  const copies = Math.min(3, Math.max(1, Math.round(settings.copies)));
  const restriction = data.restrictedPickupNames.length
    ? `Não entregar para: ${data.restrictedPickupNames.join(", ")}`
    : "";
  const qr = settings.qrEnabled
    ? qrSvgMarkup(data.pickupUrl, compact ? 2 : 3, 4)
    : "";

  const labelMarkup = `
    <div class="label">
      <div class="church">${escapeHtml(data.churchName)}</div>
      <div class="brand">LUNOR Kids</div>
      <div class="name">${escapeHtml(data.childName)}</div>
      <div class="meta"><strong>Idade / Sala:</strong> ${escapeHtml(data.childAge)}${data.className ? ` · ${escapeHtml(data.className)}` : " · Turma não definida"}</div>
      <div class="meta"><strong>Responsável:</strong> ${escapeHtml(data.guardianName ?? "Não informado")}</div>
      <div class="event">${escapeHtml(data.eventTitle)}${data.eventContext ? ` · ${escapeHtml(data.eventContext)}` : ""}</div>
      ${data.allergies ? `<div class="alert">⚠ ALERTA DE ALERGIA: ${escapeHtml(data.allergies)}</div>` : ""}
      ${restriction ? `<div class="alert">RESTRIÇÃO DE SAÍDA: ${escapeHtml(restriction)}</div>` : ""}
      ${data.specialNeeds ? `<div class="attention"><strong>ATENÇÃO ESPECIAL:</strong> ${escapeHtml(data.specialNeeds)}</div>` : ""}
      <div class="security">
        <div class="security-copy">
          <div class="security-label">Código de segurança</div>
          <div class="code">${escapeHtml(data.code)}</div>
        </div>
        ${settings.qrEnabled ? `<div class="qr">${qr}</div>` : ""}
      </div>
    </div>`;

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${escapeHtml(data.code)}</title>
  <style>
    @page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: ${settings.marginMm}mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #111; }
    .page { break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .label { border: 1px solid #111; border-radius: ${compact ? "5px" : "8px"}; padding: ${compact ? "3px" : "7px"}; overflow: hidden; }
    .church { font-size: ${compact ? "7px" : "10px"}; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .brand { font-size: ${compact ? "6px" : "8px"}; margin-top: 1px; color: #444; text-transform: uppercase; letter-spacing: .1em; }
    .name { font-size: ${compact ? "13px" : "18px"}; line-height: 1.05; font-weight: 800; margin-top: ${compact ? "2px" : "5px"}; }
    .meta { font-size: ${compact ? "7px" : "10px"}; margin-top: ${compact ? "1px" : "3px"}; }
    .meta strong { font-weight: 700; }
    .event { font-size: ${compact ? "6px" : "9px"}; margin-top: ${compact ? "1px" : "3px"}; color: #333; }
    .security { display: flex; align-items: end; justify-content: space-between; gap: ${compact ? "4px" : "8px"}; margin-top: ${compact ? "2px" : "6px"}; padding-top: ${compact ? "2px" : "5px"}; border-top: 1px solid #bbb; }
    .security-copy { min-width: 0; }
    .qr { width: ${qrSize}px; height: ${qrSize}px; flex: 0 0 ${qrSize}px; }
    .qr svg { display: block; width: 100%; height: 100%; }
    .security-label { font-size: ${compact ? "6px" : "8px"}; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .code { font-size: ${compact ? "20px" : "27px"}; line-height: 1; font-weight: 900; letter-spacing: .12em; }
    .alert { margin-top: ${compact ? "2px" : "5px"}; border: ${compact ? "1px" : "2px"} solid #111; border-radius: 4px; padding: ${compact ? "2px 3px" : "4px 5px"}; font-size: ${compact ? "6px" : "9px"}; font-weight: 700; line-height: 1.15; }
    .attention { margin-top: ${compact ? "1px" : "3px"}; border: 1px solid #555; border-radius: 4px; padding: ${compact ? "1px 3px" : "3px 5px"}; font-size: ${compact ? "6px" : "8px"}; line-height: 1.15; }
  </style>
</head>
<body>
  ${Array.from({ length: copies }, () => `<div class="page">${labelMarkup}</div>`).join("")}
  <script>window.onload = () => { window.print(); window.close(); };</script>
</body>
</html>`);
  popup.document.close();
  return true;
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
