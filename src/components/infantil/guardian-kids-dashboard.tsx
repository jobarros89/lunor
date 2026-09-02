"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Baby, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { guardianCheckIn, guardianCheckOut } from "@/lib/actions/guardian-family";
import { PickupQr } from "@/components/infantil/pickup-qr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FamilyChild = {
  id: string;
  fullName: string;
  age: string;
  checkin: {
    id: string;
    code: string;
    pickupToken: string;
    checkedOut: boolean;
  } | null;
};

export function GuardianKidsDashboard({
  churchSlug,
  churchId,
  ministryId,
  event,
  children,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  event: { id: string; title: string } | null;
  children: FamilyChild[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function checkIn(child: FamilyChild) {
    if (!event) return;
    startTransition(async () => {
      const result = await guardianCheckIn({
        churchSlug,
        churchId,
        ministryId,
        eventId: event.id,
        childId: child.id,
      });
      if (!result.ok) return toast.error(result.error);
      toast.success(`${child.fullName} entrou no Kids`);
      router.refresh();
    });
  }

  function checkOut(child: FamilyChild) {
    if (!child.checkin || !window.confirm(`Confirmar a retirada de ${child.fullName}?`)) return;
    startTransition(async () => {
      const result = await guardianCheckOut({
        churchSlug,
        checkinId: child.checkin!.id,
      });
      if (!result.ok) return toast.error(result.error);
      toast.success(`${child.fullName} foi retirado(a)`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          LUNOR Kids · Família
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Meus filhos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta conta vê somente as crianças vinculadas a você.
        </p>
      </header>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Operação atual
          </CardTitle>
          <CardDescription>
            {event ? event.title : "Nenhuma recepção do Kids está aberta agora."}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {children.map((child) => {
          const present = child.checkin && !child.checkin.checkedOut;
          return (
            <Card key={child.id} className="rounded-3xl">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Baby className="size-4" /> {child.fullName}
                  </CardTitle>
                  <CardDescription>{child.age}</CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {present ? `Presente · ${child.checkin!.code}` : "Com a família"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {present ? (
                  <>
                    <div className="rounded-2xl border p-3">
                      <PickupQr token={child.checkin!.pickupToken} compact />
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Apresente este QR na recepção para conferência.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => checkOut(child)}
                      className="h-11 w-full rounded-full"
                    >
                      <LogOut className="size-4" /> Confirmar check-out
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    disabled={pending || !event}
                    onClick={() => checkIn(child)}
                    className="h-11 w-full rounded-full"
                  >
                    <LogIn className="size-4" /> Fazer check-in
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {children.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma criança está vinculada a esta conta. Peça à recepção do Kids para enviar um novo convite.
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Cadastros de outras crianças, escalas e dados internos da equipe não ficam disponíveis para contas de família.
      </p>
    </div>
  );
}
