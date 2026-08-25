// Funções puras e tipos do repertório: este arquivo é importado por
// componentes "use client", então NÃO pode tocar em nada de servidor
// (next/headers via supabase/server contamina o bundle do navegador).
// A busca do setor vive em louvor-server.ts.
export type Song = {
  id: string;
  title: string;
  artist: string | null;
  default_key: string | null;
  bpm: number | null;
  lyrics: string | null;
  chord_chart?: string | null;
  link: string | null;
  active: boolean;
};

export type SetlistItem = {
  id: string;
  position: number;
  key_override: string | null;
  notes: string | null;
  songs: Song;
};

/** O tom em que a música vai ser cantada NESTE culto. */
export function tomDoCulto(item: Pick<SetlistItem, "key_override" | "songs">): string | null {
  return item.key_override ?? item.songs.default_key ?? null;
}

/**
 * Há quanto tempo a igreja não canta cada música.
 * Serve para não repetir demais nem sumir com uma música boa por seis meses —
 * é derivado do histórico de repertórios, sem tabela nova.
 */
export function semanasDesde(ultimaVez: string | null, hoje = new Date()): number | null {
  if (!ultimaVez) return null;
  const dias = (hoje.getTime() - new Date(ultimaVez).getTime()) / 86400000;
  return Math.max(0, Math.floor(dias / 7));
}

export function rotuloUltimaVez(ultimaVez: string | null): string {
  const semanas = semanasDesde(ultimaVez);
  if (semanas === null) return "nunca cantada";
  if (semanas === 0) return "cantada esta semana";
  if (semanas === 1) return "cantada há 1 semana";
  if (semanas < 8) return `cantada há ${semanas} semanas`;
  const meses = Math.floor(semanas / 4.345);
  return `cantada há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/**
 * A lista que a mídia cola no Holyrics. Texto puro de propósito: o destino é
 * outro programa, não a nossa tela.
 */
export function listaParaHolyrics(itens: SetlistItem[]): string {
  return itens
    .map((i, index) => {
      const tom = tomDoCulto(i);
      const artista = i.songs.artist ? ` — ${i.songs.artist}` : "";
      return `${index + 1}. ${i.songs.title}${artista}${tom ? ` (${tom})` : ""}`;
    })
    .join("\n");
}
