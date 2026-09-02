/**
 * Geração de arquivo iCalendar (.ics) para "adicionar ao calendário".
 * Função pura — recebe os dados do evento e devolve o texto .ics que o
 * celular abre no app de calendário nativo (iOS Calendar, Google Agenda).
 */

export type IcsEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
  description?: string | null;
  /**
   * O LUNOR ainda trata horários operacionais como horário de parede.
   * Quando true, grava DTSTART/DTEND sem Z para preservar, por exemplo,
   * 09:00 como 09:00 no calendário do dispositivo.
   */
  floatingTime?: boolean;
};

/** Date → formato UTC do iCalendar: 20260720T190000Z */
function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Date → horário flutuante iCalendar: 20260720T190000.
 * Usa getters UTC porque os horários de parede atuais do LUNOR são persistidos
 * nessa representação para manter o mesmo relógio entre SSR e banco.
 */
function toIcsFloatingDate(d: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

/** Escapa os caracteres reservados do formato iCalendar. */
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(ev: IcsEvent): string {
  const eventDate = ev.floatingTime ? toIcsFloatingDate : toIcsDate;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LUNOR//PT-BR//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${eventDate(ev.start)}`,
    `DTEND:${eventDate(ev.end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    ...(ev.location ? [`LOCATION:${escapeIcs(ev.location)}`] : []),
    ...(ev.description ? [`DESCRIPTION:${escapeIcs(ev.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
