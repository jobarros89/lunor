import { redirect } from "next/navigation";
import { SignupForm } from "@/components/signup-form";
import { getGuardianInvitePreview } from "@/lib/guardian-invite-preview";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ intencao?: string; familia?: string }>;
}) {
  const params = await searchParams;
  const isFamilyAccess = Boolean(params.familia);

  if (!isFamilyAccess) {
    return <SignupForm intent={params.intencao} />;
  }

  const preview = await getGuardianInvitePreview();
  if (!preview || preview.status === "invalid") {
    redirect("/familia/acesso?erro=convite-invalido");
  }
  if (preview.status === "expired" || !preview.invitedEmail) {
    redirect("/familia/acesso?erro=convite-expirado");
  }
  if (preview.status === "used") {
    redirect("/familia/acesso?erro=convite-usado");
  }

  return (
    <SignupForm
      isFamilyAccess
      initialFullName={preview.guardianName ?? ""}
      initialEmail={preview.invitedEmail}
    />
  );
}
