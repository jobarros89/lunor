export type MinistryRecipientMembership = {
  user_id: string | null;
  church_id: string;
  ministry_id: string;
  role: string | null;
  active: boolean | null;
};

type MinistryRecipientScope = {
  churchId: string;
  ministryId: string;
  explicitLeaderId?: string | null;
};

const OPERATIONAL_LEADERSHIP_ROLES = new Set(["gerente", "lider"]);

/**
 * Resolve destinatários de notificações operacionais de um ministério.
 *
 * Cargo global na igreja (admin/coordenador) não concede, por si só,
 * participação nas notificações de todos os ministérios. O destinatário
 * precisa ser gerente/líder ativo no ministério da operação. O líder
 * explicitamente vinculado à escala também é mantido como responsável direto.
 */
export function ministryOperationalRecipientIds(
  memberships: MinistryRecipientMembership[],
  scope: MinistryRecipientScope
): string[] {
  const ids = memberships.flatMap((membership) => {
    if (
      membership.church_id !== scope.churchId ||
      membership.ministry_id !== scope.ministryId ||
      membership.active !== true ||
      !membership.user_id ||
      !OPERATIONAL_LEADERSHIP_ROLES.has(membership.role ?? "")
    ) {
      return [];
    }

    return [membership.user_id];
  });

  if (scope.explicitLeaderId) ids.push(scope.explicitLeaderId);

  return [...new Set(ids)];
}
