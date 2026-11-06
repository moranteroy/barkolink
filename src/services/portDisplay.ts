import { requireSupabase } from './supabase';
import type { BoardSailing } from './sailingBoard';

export type DisplayPort = { id: string; name: string; city: string };
export type DisplaySailing = BoardSailing & { operator: string | null };
export type PortDisplayData = {
  date: string;
  updatedAt: string;
  portId: string | null;
  portLocked?: boolean;
  ports: DisplayPort[];
  sailings: DisplaySailing[];
  advisories: { id: string; title: string; message: string; priority: string; endsAt: string }[];
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function portSlug(port: DisplayPort): string {
  return port.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
export function portDisplayKey(port: DisplayPort, ports: DisplayPort[]): string {
  const slug = portSlug(port);
  // Keep IDs for ambiguous names so a shared link can never select the wrong terminal.
  return slug &&
    !uuidPattern.test(slug) &&
    ports.filter((candidate) => portSlug(candidate) === slug).length === 1
    ? slug
    : port.id;
}
async function fetchPortDisplay(
  port: string | null,
  signal?: AbortSignal,
): Promise<PortDisplayData> {
  let request = requireSupabase().rpc('port_display', { p_port: port });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return data as PortDisplayData;
}
export async function loadPortDisplay(
  port: string | null,
  signal?: AbortSignal,
  knownPorts?: DisplayPort[],
): Promise<PortDisplayData> {
  if (!port || uuidPattern.test(port)) return fetchPortDisplay(port, signal);
  // The public feed provides the directory; private port tables remain inaccessible.
  const initial = knownPorts ? undefined : await fetchPortDisplay(null, signal);
  // Staff feeds choose the current assignment on the server, even for a changed URL.
  if (initial?.portLocked) return initial;
  const ports = knownPorts ?? initial!.ports;
  const selected = ports.find((candidate) => portDisplayKey(candidate, ports) === port);
  if (!selected) throw new Error('Port is unavailable.');
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
  return initial?.portId === selected.id ? initial : fetchPortDisplay(selected.id, signal);
}
export function manilaDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}
export function displaySailings(
  data: PortDisplayData | null,
  direction: 'departures' | 'arrivals',
  today: string,
): DisplaySailing[] {
  if (!data || data.date !== today) return [];
  const departure = direction === 'departures';
  return data.sailings
    .filter(
      (s) =>
        (departure ? s.origin.id : s.destination.id) === data.portId &&
        manilaDate(departure ? s.departureAt : s.arrivalAt) === today,
    )
    .sort(
      (a, b) =>
        Date.parse(departure ? a.departureAt : a.arrivalAt) -
          Date.parse(departure ? b.departureAt : b.arrivalAt) || a.code.localeCompare(b.code),
    );
}
