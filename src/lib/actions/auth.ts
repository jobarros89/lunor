"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const credentialsSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha precisa de pelo menos 8 caracteres"),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().min(2, "Informe seu nome").max(80),
  legalAccepted: z.literal("true", {
    error: "Você precisa aceitar os Termos de Uso e a Política de Privacidade",
  }),
});

const INVITE_COOKIE = "lunor_invite";

async function acceptPendingInvite(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const cookieStore = await cookies();
  const inviteCode = cookieStore.get(INVITE_COOKIE)?.value;
  if (!inviteCode) return null;

  const { data, error } = await supabase.rpc("join_church", {
    p_invite_code: inviteCode.toLowerCase(),
  });
  if (error || !data) return null;
  cookieStore.delete(INVITE_COOKIE);
  return data;
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: "E-mail ou senha incorretos" };
  }
  const invitedChurchId = await acceptPendingInvite(supabase);
  if (invitedChurchId) redirect(`/onboarding?igreja=${invitedChurchId}`);
  redirect("/");
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    legalAccepted: formData.get("legalAccepted"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) {
    return { ok: false, error: "Não foi possível criar a conta" };
  }

  // Quando a confirmação de e-mail está habilitada, o Supabase cria o usuário
  // sem abrir sessão. Nesse caso o convite precisa continuar no cookie até o
  // primeiro login autenticado; tentar aceitar agora falharia silenciosamente.
  if (!data.session) {
    redirect("/login?cadastro=confirme-email");
  }

  const invitedChurchId = await acceptPendingInvite(supabase);
  if (invitedChurchId) redirect(`/onboarding?igreja=${invitedChurchId}`);
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const emailSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

/**
 * Envia o link de redefinição de senha. Responde sempre com sucesso,
 * mesmo se o e-mail não existir — revelar isso permitiria enumerar
 * contas cadastradas.
 */
export async function requestPasswordReset(
  formData: FormData
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const h = await headers();
  const host = h.get("host");
  const origin =
    h.get("origin") ?? (host ? `https://${host}` : "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/redefinir-senha` }
  );
  if (error) {
    // logado no servidor, mas não exposto ao usuário (anti-enumeração)
    console.error("requestPasswordReset:", error);
  }
  return { ok: true, data: undefined };
}
