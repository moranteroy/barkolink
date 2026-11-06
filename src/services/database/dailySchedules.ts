import { executeDatabase, type DatabaseClient } from './client';
export type DailySchedule = {
  id: string;
  operator: string;
  routeId: string;
  routeCode: string;
  origin: string;
  destination: string;
  departureTimes: string[];
  durationMinutes: number | null;
  isActive: boolean;
  routeActive: boolean;
  assignmentMode?: 'FIXED' | 'FLEET';
  fleetCount?: number;
  vesselId?: string | null;
  vesselName?: string | null;
  generationIssues?: {
    departureAt: string;
    reason: string;
    vesselIssues?: { vessel: string; reason: string }[];
  }[];
  generatedCount?: number;
  lastGeneratedAt?: string | null;
};
export type ScheduleRoute = {
  id: string;
  code: string;
  origin: string;
  destination: string;
  isActive: boolean;
  operators: string[];
};
export type ScheduleVessel = { id: string; name: string; operator: string; routeIds: string[] };
export type DailySchedulesData = {
  schedules: DailySchedule[];
  routes: ScheduleRoute[];
  vessels?: ScheduleVessel[];
};
export type DailyScheduleInput = {
  id?: string;
  operator: string;
  routeId: string;
  departureTimes: string[];
  durationMinutes: number | null;
  isActive: boolean;
  vesselId?: string;
  assignmentMode?: 'FIXED' | 'FLEET';
};
export const dailySchedules = (client: DatabaseClient) =>
  executeDatabase<DailySchedulesData>(client, 'AdminDailySchedules', {});
export const saveDailySchedule = (client: DatabaseClient, args: DailyScheduleInput) =>
  executeDatabase<DailySchedulesData>(client, 'AdminSaveDailySchedule', args);
export const setDailyScheduleActive = (client: DatabaseClient, id: string, isActive: boolean) =>
  executeDatabase<DailySchedulesData>(client, 'AdminSetDailyScheduleActive', { id, isActive });
