import { executeDatabase, type DatabaseClient } from './client';
export type DailySchedule = { id: string; operator: string; routeId: string; routeCode: string; origin: string; destination: string; departureTimes: string[]; durationMinutes: number | null; isActive: boolean; routeActive: boolean };
export type ScheduleRoute = { id: string; code: string; origin: string; destination: string; isActive: boolean; operators: string[] };
export type DailySchedulesData = { schedules: DailySchedule[]; routes: ScheduleRoute[] };
export type DailyScheduleInput = { id?: string; operator: string; routeId: string; departureTimes: string[]; durationMinutes: number | null; isActive: boolean };
export const dailySchedules = (client: DatabaseClient) => executeDatabase<DailySchedulesData>(client, 'AdminDailySchedules', {});
export const saveDailySchedule = (client: DatabaseClient, args: DailyScheduleInput) => executeDatabase<DailySchedulesData>(client, 'AdminSaveDailySchedule', args);
export const setDailyScheduleActive = (client: DatabaseClient, id: string, isActive: boolean) => executeDatabase<DailySchedulesData>(client, 'AdminSetDailyScheduleActive', { id, isActive });
