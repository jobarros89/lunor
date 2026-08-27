"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const normalizedEmailSchema = z
  .string()
  .trim()
  .email("E-mail inválido")
  .transform((email) => email.toLowerCase());

const credentialsSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(8, "Senha precisa de pelo menos 8 caracteres"),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().min(2, "Informe seu nome").max(80),
  legalAccepted: z.literal("true", {
    error: "Você precisa aceitar os Termos de Uso e a Política de Privacidade",
  }),
  intent: z.enum(["criar", "entrar", "convite", "direto"]).default("direto"),
});

const INVITE_COOKIE = "lunor_invite";
const SIGNUP_INTENT_COOKIE = "lunor_signup_intent";

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
  cookieStore.delete(SIGNUP_INTENT_COOKIE);
  return data;
}

async function redirectToPendingStart(): Promise<never> {
  const cookieStore = await cookies();
  const intent = cookieStore.get(SIGNUP_INTENT_COOKIE)?.value;
  cookieStore.delete(SIGNUP_INTENT_COOKIE);

  if (intent === "criar") redirect("/comecar?intencao=criar");
  if (intent === "entrar" || intent === "convite") redirect("/comecar?intencao=entrar");
  redirect("/comecar");
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

  const cookieStore = await cookies();
  if (cookieStore.has(SIGNUP_INTENT_COOKIE)) {
    return redirectToPendingStart();
  }
  redirect("/");
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    legalAccepted: formData.get("legalAccepted"),
    intent: formData.get("intent") ?? "direto",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const cookieStore = await cookies();
  if (parsed.data.intent !== "direto") {
    cookieStore.set(SIGNUP_INTENT_COOKIE, parsed.data.intent, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    cookieStore.delete(SIGNUP_INTENT_COOKIE);
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

  // Com confirmação de e-mail habilitada, mantemos convite/intenção em cookie
  // até o primeiro login autenticado para retomar exatamente o próximo passo.
  if (!data.session) {
    redirect("/login?cadastro=confirme-email");
  }

  const invitedChurchId = await acceptPendingInvite(supabase);
  if (invitedChurchId) redirect(`/onboarding?igreja=${invitedChurchId}`);
  return redirectToPendingStart();
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const emailSchema = z.object({
  email: normalizedEmailSchema,
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
  const protocol = h.get("x-forwarded-proto") ?? "https";
  const origin = h.get("origin") ?? (host ? `${protocol}://${host}` : "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/redefinir-senha` }
  );
  if (error) {
    console.error("requestPasswordReset:", error);
  }
  return { ok: true, data: undefined };
}
