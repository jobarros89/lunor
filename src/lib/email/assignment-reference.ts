export type AssignmentReference =
  | { kind: "assignment"; id: string }
  | { kind: "event"; id: string };

// Notification tags share a namespace across several flows. Assignment e-mail
// delivery must therefore be opt-in: only the two exact canonical tag shapes
// below are allowed to resolve an assignment context.
const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ASSIGNMENT_TAG = new RegExp(`^assignment-(${UUID_PATTERN})$`, "i");
const EVENT_TAG = new RegExp(`^assign-(${UUID_PATTERN})$`, "i");

export function assignmentReferenceFromTag(tag?: string): AssignmentReference | null {
  if (!tag) return null;

  const assignment = ASSIGNMENT_TAG.exec(tag);
  if (assignment) {
    return { kind: "assignment", id: assignment[1] };
  }

  const event = EVENT_TAG.exec(tag);
  if (event) {
    return { kind: "event", id: event[1] };
  }

  return null;
}
