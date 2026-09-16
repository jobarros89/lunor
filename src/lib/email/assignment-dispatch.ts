import "server-only";

import type { PushMessage } from "@/lib/push/send";
import { notifyAssignmentByEmail } from "@/lib/email/assignment";
import { assignmentReferenceFromTag } from "@/lib/email/assignment-reference";

/**
 * Fail-closed boundary for assignment e-mail delivery.
 *
 * Notification tags are also used by substitution, leader and other flows.
 * Never forward a message to the assignment e-mail renderer unless its tag is
 * one of the exact canonical assignment tag shapes.
 */
export async function dispatchAssignmentEmail(
  userIds: string[],
  message: PushMessage
): Promise<void> {
  if (!assignmentReferenceFromTag(message.tag)) return;
  await notifyAssignmentByEmail(userIds, message);
}
