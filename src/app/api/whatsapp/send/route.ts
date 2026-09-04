import { publishMinistryScheduleWhatsApp } from "@/lib/whatsapp/publish";

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const result = await publishMinistryScheduleWhatsApp(payload);
  if (result.ok) return Response.json(result);

  const status = result.error === "Não autenticado" ? 401 : result.error.startsWith("Sem permissão") ? 403 : 400;
  return Response.json(result, { status });
}
