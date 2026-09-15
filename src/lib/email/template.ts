export type EmailDetail = {
  label: string;
  value: string;
};

export type EmailListItem = {
  primary: string;
  secondary?: string | null;
};

export type LunorEmailOptions = {
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  details?: EmailDetail[];
  listTitle?: string;
  listItems?: EmailListItem[];
  note?: string;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDatePtBr(value: string) {
  const date = new Date(value);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
}

export function formatTimePtBr(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function renderDetails(details: EmailDetail[]) {
  if (details.length === 0) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border:1px solid #e5e7eb;border-radius:14px;border-collapse:separate;overflow:hidden">${details
    .map(
      ({ label, value }, index) =>
        `<tr><td style="padding:12px 16px;${index ? "border-top:1px solid #e5e7eb;" : ""}font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b7280;width:38%;vertical-align:top">${escapeHtml(label)}</td><td style="padding:12px 16px;${index ? "border-top:1px solid #e5e7eb;" : ""}font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#171717;font-weight:600;vertical-align:top">${escapeHtml(value)}</td></tr>`
    )
    .join("")}</table>`;
}

function renderList(title: string | undefined, items: EmailListItem[]) {
  if (!title || items.length === 0) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#171717;font-weight:700;padding-bottom:8px">${escapeHtml(title)}</td></tr>${items
    .map(
      ({ primary, secondary }) =>
        `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#404040;padding:7px 0;border-top:1px solid #f0f0f0"><strong style="color:#171717">${escapeHtml(primary)}</strong>${secondary ? ` <span style="color:#6b7280">· ${escapeHtml(secondary)}</span>` : ""}</td></tr>`
    )
    .join("")}</table>`;
}

export function renderLunorEmail(options: LunorEmailOptions) {
  const details = options.details ?? [];
  const listItems = options.listItems ?? [];
  const safeUrl = escapeHtml(options.actionUrl);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;background-color:#f6f7f8;padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:18px"><tr><td style="padding:34px"><p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#737373;margin:0 0 14px">LUNOR · Presença · preparo · propósito</p><h1 style="font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:34px;color:#171717;margin:0 0 12px">${escapeHtml(options.title)}</h1><p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#404040;margin:0">${escapeHtml(options.intro)}</p>${renderDetails(details)}${renderList(options.listTitle, listItems)}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px"><tr><td bgcolor="#171717" style="background-color:#171717;border-radius:10px"><a href="${safeUrl}" style="display:inline-block;padding:13px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:700">${escapeHtml(options.actionLabel)}</a></td></tr></table>${options.note ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#737373;margin:20px 0 0">${escapeHtml(options.note)}</p>` : ""}</td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px"><tr><td style="padding:16px 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#9ca3af">Mensagem automática do LUNOR.</td></tr></table></td></tr></table></body></html>`;
}

export function renderLunorText(options: LunorEmailOptions) {
  const lines = [
    "LUNOR · Presença · preparo · propósito",
    "",
    options.title,
    "",
    options.intro,
  ];

  if (options.details?.length) {
    lines.push("", ...options.details.map(({ label, value }) => `${label}: ${value}`));
  }

  if (options.listTitle && options.listItems?.length) {
    lines.push(
      "",
      options.listTitle,
      ...options.listItems.map(({ primary, secondary }) =>
        secondary ? `- ${primary} · ${secondary}` : `- ${primary}`
      )
    );
  }

  lines.push("", `${options.actionLabel}: ${options.actionUrl}`);
  if (options.note) lines.push("", options.note);
  return lines.join("\n");
}
