import { describe, expect, it } from "vitest";
import {
  DIAS_GRACA,
  diasRestantes,
  podeAdministrar,
  proximoVencimento,
} from "@/lib/billing";

const hoje = new Date("2026-07-22T12:00:00");

describe("proximoVencimento", () => {
  it("soma a partir do vencimento futuro (quem paga adiantado não perde dias)", () => {
    expect(proximoVencimento("2026-08-10", 1, hoje)).toBe("2026-09-10");
  });

  it("soma a partir de hoje quando já venceu", () => {
    expect(proximoVencimento("2026-06-01", 1, hoje)).toBe("2026-08-22");
  });

  it("soma a partir de hoje quando nunca pagou", () => {
    expect(proximoVencimento(null, 1, hoje)).toBe("2026-08-22");
  });

  it("aceita mais de um mês", () => {
    expect(proximoVencimento("2026-08-10", 12, hoje)).toBe("2027-08-10");
  });

  // O bug clássico: 31/01 + 1 mês vira 03/03 com setMonth cru.
  it("não estoura o mês: 31/01 + 1 mês = 28/02", () => {
    const jan = new Date("2026-01-15T12:00:00");
    expect(proximoVencimento("2026-01-31", 1, jan)).toBe("2026-02-28");
  });

  it("respeita ano bissexto: 31/01/2028 + 1 mês = 29/02", () => {
    const jan = new Date("2028-01-15T12:00:00");
    expect(proximoVencimento("2028-01-31", 1, jan)).toBe("2028-02-29");
  });

  it("vira o ano corretamente", () => {
    expect(proximoVencimento("2026-12-05", 1, hoje)).toBe("2027-01-05");
  });
});

describe("diasRestantes", () => {
  it("conta os dias que faltam", () => {
    const futuro = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    expect(diasRestantes(futuro)).toBeGreaterThan(0);
  });
  it("fica negativo quando vencido", () => {
    expect(diasRestantes("2020-01-01")).toBeLessThan(0);
  });
  it("sem data, não sabe dizer", () => {
    expect(diasRestantes(null)).toBeNull();
  });
});

describe("podeAdministrar", () => {
  const passado = (dias: number) =>
    new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  it("isenta pode sempre, mesmo com data velha", () => {
    expect(podeAdministrar("isenta", passado(999))).toBe(true);
  });

  it("em dia pode", () => {
    const futuro = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    expect(podeAdministrar("ativa", futuro)).toBe(true);
  });

  it("vencido há pouco ainda pode (período de graça)", () => {
    expect(podeAdministrar("pendente", passado(DIAS_GRACA - 2))).toBe(true);
  });

  it("passada a graça, perde as ações administrativas", () => {
    expect(podeAdministrar("pendente", passado(DIAS_GRACA + 2))).toBe(false);
  });

  it("sem data definida, não bloqueia (não punir por dado faltando)", () => {
    expect(podeAdministrar("trial", null)).toBe(true);
  });
});
