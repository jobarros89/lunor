"use client";

export function HumanReview({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-foreground/15 p-3 text-xs leading-relaxed">
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-brand" />
      <span>Revisei os dados e os avisos desta proposta e valido esta alteração.
        A gravação acontece somente ao tocar no botão de aprovação abaixo.</span>
    </label>
  );
}
