import type { ActorRole, AuditEvent } from "../types";

let auditSequence = 0;

export interface AuditEventInput {
  actorId: string;
  actorRole: ActorRole;
  action: string;
  entityType: AuditEvent["entityType"];
  entityId: string;
  fromState?: string;
  toState?: string;
  createdAt?: string;
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  auditSequence += 1;

  return {
    id: `audit_${auditSequence}`,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    fromState: input.fromState,
    toState: input.toState,
    createdAt: input.createdAt ?? "2026-05-29T12:00:00+05:30",
  };
}
