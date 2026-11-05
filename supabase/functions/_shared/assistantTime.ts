/** Format human clock times, leaving timestamps, offsets, identifiers and links intact. */
export function formatAssistantTimes(answer: string): string {
  return answer.replace(/https?:\/\/[^\s]+|`[^`]*`|\]\([^\n)]*\)|\b\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?|(?<![\w:+/.-])(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?![\d:+-])/g,
    (value, offset: number, text: string) => {
      if (!/^\d{1,2}:/.test(value) || /^\s*(?:a\.?m\.?|p\.?m\.?)/i.test(text.slice(offset + value.length)) || /(?:UTC|GMT)\s*$/i.test(text.slice(0, offset))) return value;
      const [hour, ...rest] = value.split(':');
      return `${Number(hour) % 12 || 12}:${rest.join(':')} ${Number(hour) < 12 ? 'AM' : 'PM'}`;
    });
}
