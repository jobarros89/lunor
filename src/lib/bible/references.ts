/**
 * Acervo curado de REFERÊNCIAS bíblicas por tema.
 *
 * Importante: este arquivo guarda apenas referências (livro, capítulo,
 * versículo) — nunca o texto. Referência é citação, não obra protegida;
 * o texto sempre vem da API na tradução configurada pela igreja, o que
 * mantém o LUNOR fora de qualquer questão de licenciamento de tradução.
 *
 * A IA escolhe o TEMA da semana a partir do contexto da igreja. A seleção
 * da referência dentro do tema é determinística. Assim a IA nunca produz
 * nem escolhe livremente escritura — só categoriza o momento.
 */

export type VerseTheme =
  | "servir"
  | "encorajamento"
  | "descanso"
  | "gratidao"
  | "perseveranca"
  | "unidade";

export const VERSE_THEMES: VerseTheme[] = [
  "servir",
  "encorajamento",
  "descanso",
  "gratidao",
  "perseveranca",
  "unidade",
];

export const THEME_LABELS: Record<VerseTheme, string> = {
  servir: "Servir",
  encorajamento: "Encorajamento",
  descanso: "Descanso",
  gratidao: "Gratidão",
  perseveranca: "Perseverança",
  unidade: "Unidade",
};

/** Referência canônica: abreviação do livro + capítulo + versículo. */
export type VerseReference = {
  /** Abreviação usada pela API (padrão abibliadigital/BLT). */
  book: string;
  chapter: number;
  verse: number;
  /** Rótulo curto para exibição, ex.: "Sl 100:2". */
  label: string;
};

function ref(book: string, chapter: number, verse: number, label: string): VerseReference {
  return { book, chapter, verse, label };
}

export const REFERENCES_BY_THEME: Record<VerseTheme, VerseReference[]> = {
  servir: [
    ref("sl", 100, 2, "Sl 100:2"),
    ref("cl", 3, 23, "Cl 3:23"),
    ref("gl", 5, 13, "Gl 5:13"),
    ref("1pe", 4, 10, "1Pe 4:10"),
    ref("mt", 20, 26, "Mt 20:26"),
    ref("hb", 6, 10, "Hb 6:10"),
  ],
  encorajamento: [
    ref("js", 1, 9, "Js 1:9"),
    ref("is", 41, 10, "Is 41:10"),
    ref("sl", 46, 1, "Sl 46:1"),
    ref("fp", 4, 13, "Fp 4:13"),
    ref("2co", 12, 9, "2Co 12:9"),
    ref("dt", 31, 6, "Dt 31:6"),
  ],
  descanso: [
    ref("mt", 11, 28, "Mt 11:28"),
    ref("sl", 23, 2, "Sl 23:2"),
    ref("mc", 6, 31, "Mc 6:31"),
    ref("ex", 33, 14, "Ex 33:14"),
    ref("sl", 127, 2, "Sl 127:2"),
  ],
  gratidao: [
    ref("1ts", 5, 18, "1Ts 5:18"),
    ref("sl", 107, 1, "Sl 107:1"),
    ref("cl", 3, 15, "Cl 3:15"),
    ref("sl", 136, 1, "Sl 136:1"),
    ref("ef", 5, 20, "Ef 5:20"),
  ],
  perseveranca: [
    ref("gl", 6, 9, "Gl 6:9"),
    ref("hb", 12, 1, "Hb 12:1"),
    ref("tg", 1, 12, "Tg 1:12"),
    ref("1co", 15, 58, "1Co 15:58"),
    ref("rm", 5, 4, "Rm 5:4"),
  ],
  unidade: [
    ref("sl", 133, 1, "Sl 133:1"),
    ref("ef", 4, 3, "Ef 4:3"),
    ref("rm", 12, 5, "Rm 12:5"),
    ref("1co", 12, 12, "1Co 12:12"),
    ref("fp", 2, 2, "Fp 2:2"),
  ],
};

export function isVerseTheme(value: string): value is VerseTheme {
  return (VERSE_THEMES as string[]).includes(value);
}
