"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveAuthenticatedDestination } from "@/lib/auth/post-login";
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
  familyToken: z.union([
    z.string().regex(/^[a-f0-9]{48}$/i),
    z.literal(""),
  ]).default(""),
});

const SIGNUP_INTENT_COOKIE = "lunor_signup_intent";
const FAMILY_INVITE_COOKIE = "lunor_family_invite";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  const origin = h.get("origin");
  if (origin) return origin;
  if (host) return `${protocol}://${host}`;
  throw new Error("Não foi possível determinar a origem da aplicação");
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

  const destination = await resolveAuthenticatedDestination(supabase, "/");
  redirect(destination);
}

export async function signInWithGoogle(): Promise<ActionResult> {
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    console.error("signInWithGoogle:", error);
    return { ok: false, error: "Não foi possível iniciar o login com Google" };
  }

  redirect(data.url);
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    legalAccepted: formData.get("legalAccepted"),
    intent: formData.get("intent") ?? "direto",
    familyToken: formData.get("familyToken") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const cookieStore = await cookies();
  if (parsed.data.familyToken) {
    cookieStore.set(FAMILY_INVITE_COOKIE, parsed.data.familyToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
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

  const destination = await resolveAuthenticatedDestination(supabase, "/comecar");
  redirect(destination);
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

  const origin = await requestOrigin();
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
