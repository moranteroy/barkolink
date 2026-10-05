import { executeDatabase, type DatabaseClient } from "./client";

export type ActivityRecord = {
  id: string;
  actorName: string;
  actorRole?: string;
  actorRoleRecorded?: boolean;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
};
export const operationSettings = (client: DatabaseClient) =>
  executeDatabase<{ reservationMinutes: number }>(
    client,
    "AdminOperationsSettings",
    {},
  );
export const saveOperationSettings = (
  client: DatabaseClient,
  reservationMinutes: number,
) =>
  executeDatabase(client, "AdminSaveOperationsSettings", {
    reservationMinutes,
  });
export const activityLog = (client: DatabaseClient, page: number) =>
  executeDatabase<{ records: ActivityRecord[]; totalCount: number }>(
    client,
    "AdminActivityLog",
    { page },
  );
export type AuditFilters = {
  page: number;
  entityType?: string;
  search?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
};
export const auditLog = (client: DatabaseClient, filters: AuditFilters) =>
  executeDatabase<{
    records: ActivityRecord[];
    totalCount: number;
    actions: string[];
  }>(client, "AdminAuditLog", filters);
export const verifyPassengerDiscount = (
  client: DatabaseClient,
  passengerId: string,
  note: string,
) => executeDatabase(client, "VerifyPassengerDiscount", { passengerId, note });
export const refundBooking = (
  client: DatabaseClient,
  bookingId: string,
  note: string,
) => executeDatabase(client, "RefundBooking", { bookingId, note });
