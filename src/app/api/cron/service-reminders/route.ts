import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { sendWebPushDetailed, type PushTarget } from "@/lib/push/send";
import { notifyServiceReminderByEmail } from "@/lib/email/service-reminder";

type ServiceReminder = {
  message_id: string;
  user_id: string;
  assignment_id: string;
  titulo: string;
  corpo: string;
  url: string;
  push_targets: PushTarget[] | null;
};

export async function POST(request: Request): Promise<Response> {
  const secret = serverEnv("CRON_SECRET");
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return new Response("Not found", { status: 404 });
  }

  const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return Response.json(
      { ok: false, error: "supabase não configurado" },
      { status: 500 },
    );
  }

  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("service_reminders_due", {
    p_secret: secret,
  });
  if (error) {
    console.error("service-reminders cron: RPC falhou", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const reminders = (data ?? []) as ServiceReminder[];
  let pushAccepted = 0;
  let pushFailed = 0;
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const reminder of reminders) {
    const pushTargets = Array.isArray(reminder.push_targets)
      ? reminder.push_targets
      : [];

    const [pushResult, emailResult] = await Promise.allSettled([
      sendWebPushDetailed(pushTargets, {
        title: reminder.titulo,
        body: reminder.corpo.replaceAll("\n", " · "),
        url: reminder.url,
        tag: `service-reminder-${reminder.assignment_id}`,
      }),
      notifyServiceReminderByEmail({
        userId: reminder.user_id,
        assignmentId: reminder.assignment_id,
        messageId: reminder.message_id,
        path: reminder.url,
      }),
    ]);

    if (pushResult.status === "fulfilled") {
      pushAccepted += pushResult.value.accepted;
      pushFailed += pushResult.value.failed;
    } else {
      pushFailed += pushTargets.length;
      console.error("service-reminders cron: push falhou", pushResult.reason);
    }

    if (emailResult.status === "fulfilled" && emailResult.value) {
      emailsSent += 1;
    } else {
      emailsFailed += 1;
      if (emailResult.status === "rejected") {
        console.error("service-reminders cron: e-mail falhou", emailResult.reason);
      }
    }
  }

  return Response.json({
    ok: true,
    reminders: reminders.length,
    inAppCreated: reminders.length,
    pushAccepted,
    pushFailed,
    emailsSent,
    emailsFailed,
  });
}
