import { describe, expect, it } from "vitest";
import {
  listaParaHolyrics,
  rotuloUltimaVez,
  semanasDesde,
  tomDoCulto,
  type SetlistItem,
} from "@/lib/louvor";

const song = (over: Partial<SetlistItem["songs"]> = {}) => ({
  id: "s1",
  title: "Bondade de Deus",
  artist: "Isaias Saad",
  default_key: "G",
  bpm: 72,
  lyrics: null,
  link: null,
  active: true,
  ...over,
});

const item = (over: Partial<SetlistItem> = {}): SetlistItem => ({
  id: "i1",
  position: 1,
  key_override: null,
  notes: null,
  songs: song(),
  ...over,
});

// O mesmo hino sobe ou desce conforme quem canta naquele domingo.
describe("tomDoCulto", () => {
  it("usa o tom do culto quando o líder definiu", () => {
    expect(tomDoCulto(item({ key_override: "D" }))).toBe("D");
  });
  it("cai no tom padrão da música quando não definiu", () => {
    expect(tomDoCulto(item())).toBe("G");
  });
  it("sem tom nenhum, não inventa", () => {
    expect(tomDoCulto(item({ songs: song({ default_key: null }) }))).toBeNull();
  });
});

describe("semanasDesde", () => {
  const hoje = new Date("2026-07-22T12:00:00");
  it("conta as semanas cheias", () => {
    expect(semanasDesde("2026-07-01T10:00:00", hoje)).toBe(3);
  });
  it("música nunca cantada não tem data", () => {
    expect(semanasDesde(null)).toBeNull();
  });
  it("data futura não vira número negativo", () => {
    expect(semanasDesde("2026-12-01T10:00:00", hoje)).toBe(0);
  });
});

// O rótulo existe para o líder não repetir demais nem sumir com uma música boa.
describe("rotuloUltimaVez", () => {
  const diasAtras = (d: number) =>
    new Date(Date.now() - d * 86400000).toISOString();

  it("nunca cantada aparece como tal", () => {
    expect(rotuloUltimaVez(null)).toBe("nunca cantada");
  });
  it("essa semana", () => {
    expect(rotuloUltimaVez(diasAtras(2))).toBe("cantada esta semana");
  });
  it("singular de semana", () => {
    expect(rotuloUltimaVez(diasAtras(8))).toBe("cantada há 1 semana");
  });
  it("plural de semanas", () => {
    expect(rotuloUltimaVez(diasAtras(21))).toBe("cantada há 3 semanas");
  });
  it("a partir de dois meses, fala em meses", () => {
    expect(rotuloUltimaVez(diasAtras(90))).toMatch(/meses/);
  });
});

// O destino é o Holyrics — outro programa. Texto puro, não a nossa tela.
describe("listaParaHolyrics", () => {
  it("numera na ordem, com artista e tom do culto", () => {
    const texto = listaParaHolyrics([
      item({ position: 1, key_override: "D" }),
      item({
        id: "i2",
        position: 2,
        songs: song({ id: "s2", title: "Deus é Deus", artist: null, default_key: "A" }),
      }),
    ]);
    expect(texto).toBe("1. Bondade de Deus — Isaias Saad (D)\n2. Deus é Deus (A)");
  });

  it("música sem tom não ganha parêntese vazio", () => {
    const texto = listaParaHolyrics([
      item({ songs: song({ artist: null, default_key: null }) }),
    ]);
    expect(texto).toBe("1. Bondade de Deus");
  });

  it("repertório vazio vira string vazia, não quebra", () => {
    expect(listaParaHolyrics([])).toBe("");
  });

  it("numera pela sequência exibida mesmo quando há lacunas nas posições", () => {
    const texto = listaParaHolyrics([
      item({ position: 1 }),
      item({ id: "i2", position: 3, songs: song({ id: "s2" }) }),
    ]);
    expect(texto).toContain("\n2. Bondade de Deus");
  });
});
