import { describe, expect, it } from "vitest";
import { buildIcs } from "../../src/lib/ics";

describe("buildIcs", () => {
  const base = {
    uid: "abc-123@acts",
    title: "Culto de Domingo",
    start: new Date("2026-07-19T22:00:00.000Z"),
    end: new Date("2026-07-20T00:00:00.000Z"),
  };

  it("gera um VCALENDAR/VEVENT válido com datas UTC", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("UID:abc-123@acts");
    expect(ics).toContain("DTSTART:20260719T220000Z");
    expect(ics).toContain("DTEND:20260720T000000Z");
    expect(ics).toContain("SUMMARY:Culto de Domingo");
  });

  it("preserva horário de parede quando floatingTime está ativo", () => {
    const ics = buildIcs({
      ...base,
      start: new Date("2026-09-06T09:00:00.000Z"),
      end: new Date("2026-09-06T12:45:00.000Z"),
      floatingTime: true,
    });

    expect(ics).toContain("DTSTART:20260906T090000\r\n");
    expect(ics).toContain("DTEND:20260906T124500\r\n");
    expect(ics).not.toContain("DTSTART:20260906T090000Z");
  });

  it("usa CRLF entre linhas (exigência do formato)", () => {
    expect(buildIcs(base)).toContain("\r\n");
  });

  it("escapa vírgula, ponto-e-vírgula e quebra de linha", () => {
    const ics = buildIcs({
      ...base,
      title: "Culto; especial, com nota\nsegunda linha",
    });
    // output esperado (backslashes literais): Culto\; especial\, com nota\nsegunda linha
    expect(ics).toContain(
      String.raw`Culto\; especial\, com nota\nsegunda linha`
    );
  });

  it("omite LOCATION e DESCRIPTION quando ausentes", () => {
    const ics = buildIcs(base);
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("inclui LOCATION e DESCRIPTION quando presentes", () => {
    const ics = buildIcs({
      ...base,
      location: "Templo principal",
      description: "Funcao: Fotografia",
    });
    expect(ics).toContain("LOCATION:Templo principal");
    expect(ics).toContain("DESCRIPTION:Funcao: Fotografia");
  });
});
