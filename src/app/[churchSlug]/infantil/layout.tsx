import { KidsSectionNav } from "@/components/infantil/kids-section-nav";

export default async function InfantilLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;

  return (
    <div className="space-y-6">
      <KidsSectionNav churchSlug={churchSlug} />
      {children}
    </div>
  );
}
