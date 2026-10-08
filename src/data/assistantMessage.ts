export type MessagePart = { text: string; path?: string; bold?: boolean };

/** Older deployed chatbot responses used Home for section-specific actions. */
export function assistantDestination(link: { label: string; path: string }) {
  if (/^\/search(?:[?#]|$)/.test(link.path)) return link.path.replace(/^\/search/, '/trips');
  if (link.path === '/home') {
    if (/loyalty|reward/i.test(link.label)) return '/home#loyalty-rewards';
    if (/advisories|advisory/i.test(link.label)) return '/home#travel-advisories';
    if (/weather|forecast/i.test(link.label)) return '/home#weather-outlook';
  }
  if (link.path === '/help') {
    if (/payment|pay\b/i.test(link.label)) return '/help#payment';
    if (/boarding|qr|e-ticket/i.test(link.label)) return '/help#e-ticket';
    if (/reserve|reservation|booking guide/i.test(link.label)) return '/help#reserve-sailing';
  }
  return link.path;
}

export function assistantPath(path: string) {
  return !/[\\\s]/.test(path) && /^\/(home|trips|search|trip-details|bookings|booking-details|ticket|help|travelers|notifications|profile)(?:[?#].*)?$/.test(path);
}

/** Render a small, safe subset of formatting as Vue text and router links. */
export function assistantMessage(content: string, links: { path: string; label?: string }[] = []): MessagePart[] {
  const approved = new Set(links.filter(link => assistantPath(link.path)).map(link => link.path));
  const parts: MessagePart[] = [];
  const pattern = /\[([^\]\n]+)\]\(([^)\n]+)\)|\*\*([^*\n]+)\*\*/g;
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ text: content.slice(cursor, match.index) });
    if (match[3]) parts.push({ text: match[3], bold: true });
    else {
      const link = links.find(link => link.path === match[2]);
      const path = assistantDestination({ label: match[1], path: match[2] });
      parts.push({ text: match[1], ...(approved.has(match[2]) ? { path: path !== match[2] ? path : assistantDestination({ label: link?.label || '', path: match[2] }) } : {}) });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < content.length) parts.push({ text: content.slice(cursor) });
  return parts;
}
