import { executeDatabase, type DatabaseClient } from './client';
export type SailingStatusPolicy = { operator: string; boardingLeadMinutes: number | null; boardingTimeSource: string | null; autoComplete: boolean };
export const sailingStatusPolicies = (client: DatabaseClient) => executeDatabase<{ policies: SailingStatusPolicy[] }>(client, 'AdminSailingStatusPolicies', {});
export const saveSailingStatusPolicy = (client: DatabaseClient, policy: SailingStatusPolicy) => executeDatabase<{ policies: SailingStatusPolicy[] }>(client, 'AdminSaveSailingStatusPolicy', policy);
