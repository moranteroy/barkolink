import { executeDatabase, type DatabaseClient } from './client';
export type SailingStatusPolicy = {
  operator: string;
  boardingLeadMinutes: number | null;
  boardingTimeSource: string | null;
  autoComplete: boolean;
};
export const sailingStatusPolicies = (client: DatabaseClient) =>
  executeDatabase<{ policies: SailingStatusPolicy[] }>(client, 'AdminSailingStatusPolicies', {});
export const saveSailingStatusPolicy = (client: DatabaseClient, policy: SailingStatusPolicy) =>
  executeDatabase<{ policies: SailingStatusPolicy[] }>(
    client,
    'AdminSaveSailingStatusPolicy',
    policy,
  );
export type BoardingTiming = {
  sailingCode: string;
  departureAt: string;
  boardingAt: string | null;
  effectiveBoardingAt: string | null;
  boardingTimeSource: string | null;
  usesOperatorDefault: boolean;
  updatedAt: string;
  status: string;
  canEdit: boolean;
};
export const boardingSailingTiming = (client: DatabaseClient, sailingCode: string) =>
  executeDatabase<{ timing: BoardingTiming }>(client, 'BoardingSailingTiming', { sailingCode });
export const setBoardingSailingTiming = (
  client: DatabaseClient,
  input: { sailingCode: string; boardingAt: string; expectedUpdatedAt: string; reason: string },
) => executeDatabase<{ timing: BoardingTiming }>(client, 'BoardingSetSailingTiming', input);
