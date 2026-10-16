import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { MessageInbox, type InboxMessageView } from "@/components/messages/message-inbox";
import { PageHeader } from "@/components/ui/page-header";
import { LoadError } from "@/components/shell/load-error";

export default async function MensagensPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from("inbox_messages")
    .select(
      "id, church_id, ministry_id, sender_id, recipient_id, kind, title, body, event_id, read_at, created_at",
    )
    .eq("church_id", tenant.church.id)
    .or(`recipient_id.eq.${tenant.userId},sender_id.eq.${tenant.userId}`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("mensagens:", error.message);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Mensagens"
          description="Comunicação da liderança e lembretes das suas escalas."
        />
        <LoadError oQue="as mensagens" />
      </div>
    );
  }

  const profileIds = [
    ...new Set(
      (messages ?? []).flatMap((message) => [
        ...(message.sender_id ? [message.sender_id] : []),
        ...(message.recipient_id ? [message.recipient_id] : []),
      ]),
    ),
  ];
  const ministryIds = [
    ...new Set(
      (messages ?? []).flatMap((message) =>
        message.ministry_id ? [message.ministry_id] : [],
      ),
    ),
  ];

  const [{ data: profiles }, { data: ministries }] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ministryIds.length > 0
      ? supabase.from("ministries").select("id, name").in("id", ministryIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const profileName = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const ministryName = new Map(
    (ministries ?? []).map((ministry) => [ministry.id, ministry.name]),
  );

  const view: InboxMessageView[] = (messages ?? []).map((message) => ({
    id: message.id,
    kind: message.kind as "direct" | "service_reminder",
    title: message.title,
    body: message.body,
    createdAt: message.created_at,
    readAt: message.read_at,
    senderName: message.sender_id
      ? profileName.get(message.sender_id) ?? null
      : null,
    recipientName: profileName.get(message.recipient_id) ?? null,
    ministryName: message.ministry_id
      ? ministryName.get(message.ministry_id) ?? null
      : null,
    eventUrl: message.event_id
      ? `/${churchSlug}/escalas/${message.event_id}`
      : null,
    direction:
      message.recipient_id === tenant.userId ? "received" : "sent",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mensagens"
        description="Comunicação da liderança e lembretes das suas escalas."
      />
      <MessageInbox
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        messages={view}
      />
    </div>
  );
}
