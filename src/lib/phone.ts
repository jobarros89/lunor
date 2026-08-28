export function normalizePhoneE164(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;

  if (hasPlus) return `+${digits}`;

  // Compatibilidade com os cadastros brasileiros atuais do LUNOR.
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;

  // Outros países devem chegar com código internacional explícito.
  return null;
}
