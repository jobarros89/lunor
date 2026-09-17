import Link from "next/link";
import {
  Building2,
  Camera,
  CalendarPlus,
  CheckCircle2,
  Send,
  Sparkles,
  UserCog,
  Wrench,
} from "lucide-react";
import { getTenant } from "@/lib/tenant";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  {
    name: "Administrador",
    color: "bg-foreground text-background",
    desc: "Controle total da igreja: cria ministérios, define quem é admin, vê tudo.",
  },
  {
    name: "Gerente",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    desc: "Administra um ministério: pessoas, equipamentos, escalas, aptidões.",
  },
  {
    name: "Líder",
    color: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    desc: "Cuida da sua equipe: monta escalas, avalia, registra presença e chamados.",
  },
  {
    name: "Instrutor",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    desc: "Cuida de treinamentos e materiais (em breve).",
  },
  {
    name: "Voluntário",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    desc: "Vê apenas o que é seu: escalas, briefing, equipamentos que vai usar.",
  },
];

export default async function GuiaPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);

  const steps = [
    {
      icon: CheckCircle2,
      title: "1. Sua igreja está criada",
      desc: "Quem cria a igreja vira o Administrador. Você já está aqui — este é o primeiro passo concluído.",
      done: true,
    },
    {
      icon: Building2,
      title: "2. Crie os ministérios",
      desc: "Em Administração, cadastre os ministérios (Mídia, Louvor, Recepção…). É por eles que as pessoas terão funções.",
      href: `/${churchSlug}/admin`,
      cta: "Ir para Administração",
      role: "Administrador",
    },
    {
      icon: Send,
      title: "3. Convide sua equipe",
      desc: "Na tela inicial (ou em Administração) há um código de convite. Envie para os voluntários — eles se cadastram em /signup e entram com esse código.",
      href: `/${churchSlug}`,
      cta: "Ver código de convite",
      role: "Administrador",
    },
    {
      icon: UserCog,
      title: "4. Defina as funções de cada pessoa",
      desc: "Em Equipe, abra a pessoa e, no cartão Ministérios, escolha o papel dela em cada ministério: Gerente, Líder, Instrutor ou Voluntário. Como admin, você também pode promover alguém a Administrador da igreja.",
      href: `/${churchSlug}/pessoas`,
      cta: "Ir para Equipe",
      role: "Administrador / Gerente",
    },
    {
      icon: Sparkles,
      title: "5. Marque as aptidões",
      desc: "No perfil da pessoa, aprove o que ela sabe fazer (fotografia, áudio…). Pode marcar como 'apto por experiência' ou 'por treinamento' — treinamento nunca é obrigatório para servir.",
      href: `/${churchSlug}/pessoas`,
      cta: "Abrir Equipe",
      role: "Gerente",
    },
    {
      icon: Camera,
      title: "6. Cadastre os equipamentos",
      desc: "Em Equipamentos, adicione câmeras, mesas de som, cabos… com foto, valor e garantia. Cada item ganha um histórico automático de uso e manutenção.",
      href: `/${churchSlug}/equipamentos`,
      cta: "Ir para Equipamentos",
      role: "Gerente",
    },
    {
      icon: CalendarPlus,
      title: "7. Crie eventos e monte a escala",
      desc: "Em Escalas, crie o culto/evento, escale as pessoas com suas funções e vincule os equipamentos que cada uma vai usar. O voluntário confirma presença pelo celular.",
      href: `/${churchSlug}/escalas`,
      cta: "Ir para Escalas",
      role: "Líder / Gerente",
    },
    {
      icon: Wrench,
      title: "8. Acompanhe o dia a dia",
      desc: "Após o culto, avalie a equipe (6 critérios) no evento. Abra chamados de Manutenção quando um equipamento precisar de reparo — ele entra e sai de manutenção automaticamente.",
      href: `/${churchSlug}/manutencoes`,
      cta: "Ver Manutenções",
      role: "Líder",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title ">
          Guia de uso
        </h1>
        <p className="text-muted-foreground">
          Como montar sua igreja do zero, passo a passo
        </p>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">As funções do sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ROLES.map((r) => (
            <div key={r.name} className="flex gap-3">
              <Badge className={`h-fit shrink-0 rounded-full border-0 ${r.color}`}>
                {r.name}
              </Badge>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            As funções de ministério (Gerente, Líder, Instrutor, Voluntário)
            são definidas em cada pessoa, dentro da Equipe. Só o Administrador
            promove ou remove outro Administrador.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {steps.map((s) => (
          <Card key={s.title} className="rounded-3xl">
            <CardContent className="space-y-3 py-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                  <s.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{s.title}</p>
                    {s.done && (
                      <Badge className="rounded-full border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        Concluído
                      </Badge>
                    )}
                    {s.role && (
                      <Badge variant="secondary" className="rounded-full">
                        {s.role}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                  {s.href && s.cta && (
                    <Link
                      href={s.href}
                      className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
                    >
                      {s.cta} →
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tenant.role === "admin" && (
        <Card className="rounded-3xl bg-foreground text-background">
          <CardContent className="space-y-1 py-5">
            <p className="font-medium">Pronto para começar?</p>
            <p className="text-sm text-background/70">
              Comece pelo passo 2: crie seus ministérios em Administração.
            </p>
            <Link
              href={`/${churchSlug}/admin`}
              className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
            >
              Criar ministérios →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
