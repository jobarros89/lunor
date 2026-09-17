import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLockup } from "@/components/brand-lockup";

export default async function KidsQrResolverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 py-8 text-center">
            <BrandLockup className="items-center" />
            <h1 className="text-xl font-semibold">QR do LUNOR Kids</h1>
            <p className="text-sm text-muted-foreground">
              Entre no LUNOR com uma conta autorizada do Kids e leia este QR novamente. Nenhum dado da criança é exibido antes da autenticação.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: checkin } = await supabase
    .from("child_checkins")
    .select("church_id, churches!inner(slug)")
    .eq("pickup_qr_token", token)
    .maybeSingle();

  if (!checkin) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 py-8 text-center">
            <h1 className="text-xl font-semibold">QR indisponível</h1>
            <p className="text-sm text-muted-foreground">
              O código é inválido, já não está acessível para sua conta ou você não faz parte da equipe Kids desta igreja.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const church = checkin.churches as unknown as { slug: string };
  redirect(`/${church.slug}/infantil/retirada/${token}`);
}
