import { BookOpen } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  REFERENCES_BY_THEME,
  THEME_LABELS,
  VERSE_THEMES,
  isVerseTheme,
  type VerseReference,
  type VerseTheme,
} from "@/lib/bible/references";
import { rotateTheme } from "@/lib/bible/select-theme";
import { selectDailyVerse } from "@/lib/bible/select-verse";
import { fetchVerseText } from "@/lib/bible/fetch-verse";
import { ShareDailyVerse } from "@/components/bible/share-daily-verse";
import { Card, CardContent } from "@/components/ui/card";

type DailyVerseContext = {
  enabled: boolean;
  version: string;
  fixed_theme: string | null;
  recent_references: string[] | null;
  sent_theme: string | null;
  sent_reference: string | null;
  sent_on: string | null;
};

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function findCuratedReference(label: string | null): {
  theme: VerseTheme;
  reference: VerseReference;
} | null {
  if (!label) return null;
  for (const theme of VERSE_THEMES) {
    const reference = REFERENCES_BY_THEME[theme].find((item) => item.label === label);
    if (reference) return { theme, reference };
  }
  return null;
}

function versionCredit(version: string): string {
  if (version.toLowerCase() === "blt" || version.toUpperCase() === "BLIVRE") {
    return "Bíblia Livre · BLIVRE · CC BY 3.0 BR";
  }
  return version.toUpperCase();
}

export default async function DailyVersePage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("daily_verse_context_for_member", {
    p_church: tenant.church.id,
  });
  const context = (data?.[0] ?? null) as DailyVerseContext | null;

  if (error || !context) {
    return (
      <div className="mx-auto max-w-2xl py-6 sm:py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <BookOpen className="mx-auto size-6 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Versículo do dia</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              O conteúdo de hoje está temporariamente indisponível. Tente abrir novamente em instantes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!context.enabled) {
    return (
      <div className="mx-auto max-w-2xl py-6 sm:py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <BookOpen className="mx-auto size-6 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Versículo do dia</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              O Versículo do Dia ainda não está ativado para {tenant.church.name}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = todayInSaoPaulo();
  const sent = findCuratedReference(context.sent_reference);
  const configuredTheme =
    context.fixed_theme && isVerseTheme(context.fixed_theme) ? context.fixed_theme : null;
  const sentTheme =
    context.sent_theme && isVerseTheme(context.sent_theme) ? context.sent_theme : sent?.theme ?? null;
  const theme = sentTheme ?? configuredTheme ?? rotateTheme(today);
  const reference =
    sent?.reference ??
    selectDailyVerse({
      theme,
      churchId: tenant.church.id,
      date: today,
      recentLabels: context.recent_references ?? [],
    });

  const verse = await fetchVerseText({
    reference,
    version: context.version,
  });

  if (!verse) {
    return (
      <div className="mx-auto max-w-2xl py-6 sm:py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <BookOpen className="mx-auto size-6 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Versículo do dia</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Não foi possível carregar o texto de {reference.label} agora. Tente novamente em instantes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-2xl py-3 sm:py-8">
      <section className="rounded-[2rem] border bg-card px-5 py-8 shadow-sm sm:px-10 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Versículo do dia
            </p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">{dateLabel}</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
            {THEME_LABELS[theme]}
          </span>
        </div>

        <div className="py-10 sm:py-14">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">
            {verse.label}
          </p>
          <blockquote className="mt-5 text-[1.65rem] font-medium leading-[1.42] tracking-[-0.02em] sm:text-4xl sm:leading-[1.35]">
            “{verse.text}”
          </blockquote>
        </div>

        <div className="border-t pt-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {versionCredit(verse.version)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{tenant.church.name}</p>
            </div>
            <ShareDailyVerse
              reference={verse.label}
              text={verse.text}
              churchName={tenant.church.name}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
