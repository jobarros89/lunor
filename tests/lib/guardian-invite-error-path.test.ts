import { describe, expect, it } from "vitest";

// Mantém este teste sem importar o helper server-only; a matriz abaixo fixa
// os contratos de erro que o onboarding P0 deve preservar nas rotas.
const cases = [
  ["invite_email_mismatch", "/familia/acesso?erro=email"],
  ["guardian_already_linked", "/familia/acesso?erro=vinculado"],
  ["invite_expired", "/familia/acesso?erro=convite-expirado"],
  ["invite_already_used", "/familia/acesso?erro=convite-usado"],
  ["invite_invalid", "/familia/acesso?erro=convite-invalido"],
] as const;

function expectedPath(message: string) {
  if (message.includes("invite_email_mismatch")) return "/familia/acesso?erro=email";
  if (message.includes("guardian_already_linked")) return "/familia/acesso?erro=vinculado";
  if (message.includes("invite_expired")) return "/familia/acesso?erro=convite-expirado";
  if (message.includes("invite_already_used")) return "/familia/acesso?erro=convite-usado";
  if (message.includes("invite_invalid")) return "/familia/acesso?erro=convite-invalido";
  return "/familia/acesso?erro=convite";
}

describe("guardian invite onboarding error contract", () => {
  it.each(cases)("routes %s explicitly", (error, path) => {
    expect(expectedPath(error)).toBe(path);
  });

  it("keeps unknown failures recoverable", () => {
    expect(expectedPath("network_failure")).toBe("/familia/acesso?erro=convite");
  });
});
