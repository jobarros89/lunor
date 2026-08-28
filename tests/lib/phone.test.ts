import { describe, expect, it } from "vitest";
import { normalizePhoneE164 } from "@/lib/phone";

describe("normalizePhoneE164", () => {
  it("mantém número internacional e remove formatação", () => {
    expect(normalizePhoneE164("+55 (21) 99999-8888")).toBe("+5521999998888");
  });

  it("aplica +55 a celular brasileiro atual", () => {
    expect(normalizePhoneE164("21 99999-8888")).toBe("+5521999998888");
  });

  it("aplica +55 a telefone brasileiro de 10 dígitos", () => {
    expect(normalizePhoneE164("21 3333-2222")).toBe("+552133332222");
  });

  it("não adivinha país para número sem código internacional fora do padrão BR", () => {
    expect(normalizePhoneE164("123456789" )).toBeNull();
  });

  it("rejeita entrada vazia ou curta", () => {
    expect(normalizePhoneE164("" )).toBeNull();
    expect(normalizePhoneE164("1234" )).toBeNull();
  });
});
