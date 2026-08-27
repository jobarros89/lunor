import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Baby,
  BarChart3,
  Bell,
  CalendarCheck,
  Camera,
  Layers,
  Smartphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PRECO_MENSAL, PRECO_ANUAL, DIAS_TRIAL } from "@/lib/billing";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
    if (isPlatformAdmin) redirect("/painel");

    const { data: membership } = await supabase
      .from("church_members")
      .select("churches(slug)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const slug = (membership?.churches as unknown as { slug: string } | null)?.slug;
    redirect(slug ? `/${slug}` : "/comecar");
  }

  return <Landing />;
}

const recursos = [
  {
    icon: CalendarCheck,
    titulo: "Escalas que a equipe confirma",
    texto:
      "Monte a escala do culto e cada pessoa confirma em um toque — pelo app ou pelo calendário do celular.",
  },
  {
    icon: BarChart3,
    titulo: "Escalação assistida",
    texto:
      "Ao escalar, o líder vê a carga do mês, quem está indisponível, aptidões e interesses. Ninguém carrega sozinho.",
  },
  {
    icon: Layers,
    titulo: "Cada ministério no seu espaço",
    texto:
      "Mídia, Louvor, Recepção — cada setor vê só o que é seu. O culto é um evento compartilhado; a liderança enxerga o todo.",
  },
  {
    icon: Baby,
    titulo: "Infantil com segurança",
    texto:
      "Check-in das crianças, alergia em destaque, e a criança só sai com responsável autorizado — bloqueado pelo sistema.",
  },
  {
    icon: Camera,
    titulo: "Patrimônio e manutenção",
    texto:
      "Equipamentos, histórico de uso e chamados. Você sabe o que a igreja tem e em que estado está.",
  },
  {
    icon: Bell,
    titulo: "Avisos que chegam",
    texto:
      "A pessoa é avisada no celular quando é escalada ou quando algo muda — sem depender de grupo de mensagem.",
  },
];

function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <p className="text-xl font-semibold tracking-tight">LUNOR</p>
        <Button variant="outline" nativeButton={false} className="h-10 rounded-full px-5" render={<Link href="/login" />}>
          Entrar
        </Button>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 pb-10 pt-6 md:pt-14">
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          A gestão da sua igreja, feita para quem serve.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Escalas, equipe, ministérios, patrimônio e infantil — organizados num só lugar, no celular de cada voluntário.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button nativeButton={false} className="h-12 rounded-full px-7 text-base" render={<Link href="/signup?intencao=criar" />}>
            Criar minha igreja
          </Button>
          <Button variant="outline" nativeButton={false} className="h-12 rounded-full px-7 text-base" render={<Link href="/signup?intencao=entrar" />}>
            Entrar em uma igreja
          </Button>
          <span className="text-sm text-muted-foreground">{DIAS_TRIAL} dias grátis · sem cartão</span>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl overflow-x-auto px-5 pb-14">
        <div className="flex gap-4">
          {[
            { src: "/landing/inicio.png", alt: "Tela inicial com as próximas escalas" },
            { src: "/landing/escalas.png", alt: "Lista de escalas do culto" },
            { src: "/landing/escala.png", alt: "Detalhe da escala com a equipe" },
          ].map((s) => (
            <Image key={s.src} src={s.src} alt={s.alt} width={412} height={892} className="h-auto w-[220px] shrink-0 rounded-3xl border shadow-sm md:w-[260px]" />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Telas reais do aplicativo.</p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recursos.map((r) => (
            <div key={r.titulo} className="space-y-2">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-muted"><r.icon className="size-5" /></div>
              <h3 className="font-medium">{r.titulo}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-16">
        <div className="rounded-3xl border p-7 md:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">Quanto custa, e por quê</h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            O LUNOR custa <strong className="text-foreground">R$ {PRECO_MENSAL}/mês</strong> (ou R$ {PRECO_ANUAL}/ano) — o suficiente para pagar servidor e domínio, nada além. Não existe plano premium nem recurso escondido atrás de pagamento: toda igreja usa o sistema inteiro.
          </p>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            <strong className="text-foreground">Igreja sem condição de pagar é isenta.</strong>{" "}
            Basta pedir — sem constrangimento e sem perder nada. Quem pode contribuir sustenta a estrutura que mantém as igrejas menores no ar.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Os primeiros {DIAS_TRIAL} dias são grátis, sem cadastrar cartão.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-20">
        <div className="flex flex-wrap items-center gap-4">
          <Button nativeButton={false} className="h-12 rounded-full px-7 text-base" render={<Link href="/signup?intencao=criar" />}>
            Criar minha igreja
          </Button>
          <Button variant="outline" nativeButton={false} className="h-12 rounded-full px-7 text-base" render={<Link href="/signup?intencao=entrar" />}>
            Entrar em uma igreja
          </Button>
          <Button variant="ghost" nativeButton={false} className="h-12 rounded-full px-5 text-base" render={<Link href="/login" />}>
            Já tenho conta
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><Smartphone className="size-4" />Funciona como app no celular (PWA)</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/termos" className="underline underline-offset-4 hover:text-foreground">Termos</Link>
            <Link href="/privacidade" className="underline underline-offset-4 hover:text-foreground">Privacidade</Link>
            <a href="https://github.com/jobarros89/lunor" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">Código aberto</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
