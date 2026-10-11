import { requireSupabase } from './supabase';
import type { BoardSailing } from './sailingBoard';

export type DisplayPort = { id: string; name: string; city: string };
export type DisplaySailing = BoardSailing & { operator: string | null };
export type PortDisplayData = {
  date: string;
  updatedAt: string;
  portId: string | null;
  ports: DisplayPort[];
  sailings: DisplaySailing[];
  advisories: { id: string; title: string; message: string; priority: string; endsAt: string }[];
};
export async function loadPortDisplay(port: string | null, signal?: AbortSignal): Promise<PortDisplayData> {
  let request = requireSupabase().rpc('port_display', { p_port: port });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return data as PortDisplayData;
}
export function manilaDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
}
export function displaySailings(data: PortDisplayData | null, direction: 'departures' | 'arrivals', today: string): DisplaySailing[] {
  if (!data || data.date !== today) return [];
  const departure = direction === 'departures';
  return data.sailings.filter(s => (departure ? s.origin.id : s.destination.id) === data.portId
    && manilaDate(departure ? s.departureAt : s.arrivalAt) === today)
    .sort((a, b) => Date.parse(departure ? a.departureAt : a.arrivalAt) - Date.parse(departure ? b.departureAt : b.arrivalAt) || a.code.localeCompare(b.code));
}
