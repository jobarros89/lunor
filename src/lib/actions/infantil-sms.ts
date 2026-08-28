"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/notifications/sms";
import { chamarResponsavel } from "@/lib/actions/infantil";
import type { ActionResult } from "@/lib/actions/types";

const callSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  checkinId: z.string().uuid(),
  reason: z.string().max(200).default(""),
});

type CallChannels = {
  sms: "sent" | "unconfigured" | "invalid_phone" | "failed" | "no_phone";
};

/**
 * Mantém o fluxo atual (registro do chamado + Web Push) e adiciona SMS como
 * canal complementar. A ausência/falha do provedor de SMS nunca desfaz o
 * chamado já registrado: o voluntário precisa conseguir operar mesmo se um
 * canal externo estiver indisponível.
 */
export async function chamarResponsavelComSms(raw: unknown): Promise<ActionResult<CallChannels>> {
  const parsed = callSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const base = await chamarResponsavel(d);
  if (!base.ok) return base;

  const supabase = await createClient();
  const { data: checkin } = await supabase
    .from("child_checkins")
    .select("child_id, code")
    .eq("id", d.checkinId)
    .single();

  if (!checkin) return { ok: true, data: { sms: "no_phone" } };

  const { data: links } = await supabase
    .from("child_guardians")
    .select("is_primary, can_pickup, guardians!inner(phone)")
    .eq("child_id", checkin.child_id)
    .eq("can_pickup", true)
    .order("is_primary", { ascending: false });

  const phone = (links ?? [])
    .map((link) => (link.guardians as unknown as { phone: string | null }).phone)
    .find((value): value is string => !!value?.trim());

  if (!phone) return { ok: true, data: { sms: "no_phone" } };

  const sms = await sendSms({
    to: phone,
    body: `LUNOR Kids: precisamos da sua presença no Kids. Código ${checkin.code}. Por favor, dirija-se à recepção.`,
  });

  return { ok: true, data: { sms: sms.status } };
}
