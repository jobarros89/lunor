export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  convidado: "Aguardando confirmação",
  confirmado: "Confirmado",
  falar_lider: "Quer falar com o líder",
  substituicao_solicitada: "Não pode servir",
  ausente: "Ausente",
  presente: "Presente",
};

export const ASSIGNMENT_STATUS_BADGE: Record<string, string> = {
  convidado: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  confirmado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  falar_lider: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  substituicao_solicitada: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  ausente: "bg-red-500/15 text-red-700 dark:text-red-400",
  presente: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
