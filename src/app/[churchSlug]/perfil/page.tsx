import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { serverEnv } from "@/lib/env";
import { signOut } from "@/lib/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PushToggle } from "@/components/push/push-toggle";

const CHURCH_ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  member: "Membro",
};

const MINISTRY_ROLE_LABEL: Record<string, string> = {
  gerente: "Gerente",
  lider: "Líder",
  instrutor: "Instrutor",
  voluntario: "Voluntário",
};

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const vapidPublicKey = serverEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const initials = tenant.profile.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // papéis: o de igreja + os de ministério (sem duplicar "voluntário" genérico).
  // Set: o mesmo papel pode vir de vários setores (líder na Mídia E no Louvor).
  const roleBadges = [
    ...new Set([
      CHURCH_ROLE_LABEL[tenant.role] ?? "Membro",
      ...tenant.ministryRoles
        .filter((r) => r !== "voluntario")
        .map((r) => MINISTRY_ROLE_LABEL[r]),
    ]),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <Card className="rounded-3xl">
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar className="size-16">
            <AvatarImage src={tenant.profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-lg font-semibold">{tenant.profile.full_name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {roleBadges.map((label) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="rounded-full"
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="py-4">
          <PushToggle
            churchId={tenant.church.id}
            vapidPublicKey={vapidPublicKey}
          />
        </CardContent>
      </Card>

      <Link href={`/${churchSlug}/pessoas/${tenant.userId}`} className="block">
        <Card className="rounded-3xl transition-colors hover:bg-accent/40">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">Meu perfil completo</p>
              <p className="text-sm text-muted-foreground">
                Aptidões, interesses e disponibilidade
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <Card className="rounded-3xl">
        <CardContent className="space-y-3 py-4">
          <div>
            <p className="font-medium">Meus dados</p>
            <p className="text-sm text-muted-foreground">
              Baixe tudo o que a igreja guarda sobre você, em arquivo aberto.
            </p>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            className="h-11 w-full rounded-full"
            render={<a href={`/${churchSlug}/exportar/pessoal`} download />}
          >
            <Download className="size-4" />
            Baixar meus dados
          </Button>
        </CardContent>
      </Card>

      <form action={signOut}>
        <Button variant="outline" className="h-12 w-full rounded-full">
          Sair da conta
        </Button>
      </form>
    </div>
  );
}
