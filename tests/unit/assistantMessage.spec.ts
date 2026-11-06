import { describe, expect, it } from 'vitest';
import {
  assistantMessage,
  assistantPath,
  assistantDestination,
} from '../../src/data/assistantMessage';

describe('assistant answer formatting', () => {
  it('shows clock times in AM/PM while preserving links, identifiers and timezone offsets', () => {
    const text = 'Calapan (21:00, 23:00), 00:15, 12:30, 09:00 AM. Philippine Time (UTC+08:00).';
    expect(
      assistantMessage(text)
        .map((p) => p.text)
        .join(''),
    ).toBe(
      'Calapan (9:00 PM, 11:00 PM), 12:15 AM, 12:30 PM, 09:00 AM. Philippine Time (UTC+08:00).',
    );
    expect(
      assistantMessage('At **21:00**. 2026-11-05T21:00:00+08:00 `21:00` BKG-21:00')
        .map((p) => p.text)
        .join(''),
    ).toBe('At 9:00 PM. 2026-11-05T21:00:00+08:00 `21:00` BKG-21:00');
    expect(
      assistantMessage('[Booking](/booking-details?reference=21:00)', [
        { path: '/booking-details?reference=21:00' },
      ]),
    ).toEqual([{ text: 'Booking', path: '/booking-details?reference=21:00' }]);
  });
  it.each([
    ['My loyalty rewards', '/home', '/home#loyalty-rewards'],
    ['Travel advisories', '/home', '/home#travel-advisories'],
    ['Weather outlook', '/home', '/home#weather-outlook'],
    ['Payment guide', '/help', '/help#payment'],
    ['QR ticket guide', '/help', '/help#e-ticket'],
    ['Reserve a sailing', '/help', '/help#reserve-sailing'],
    ['Travel guide', '/help', '/help'],
    ['Search sailings', '/search', '/trips'],
    [
      'Filtered sailings',
      '/search?source=assistant&from=Batangas&date=2026-10-12#results',
      '/trips?source=assistant&from=Batangas&date=2026-10-12#results',
    ],
    ['Find trips', '/trips?all=1', '/trips?all=1'],
    ['Booking BL-123', '/booking-details?reference=BL-123', '/booking-details?reference=BL-123'],
  ])('resolves %s to its destination', (label, path, destination) => {
    expect(assistantDestination({ label, path })).toBe(destination);
    expect(assistantMessage(`[${label}](${path})`, [{ label, path }])).toEqual([
      { text: label, path: destination },
    ]);
  });
  it('renders approved internal links and bold text without losing line breaks', () => {
    expect(
      assistantMessage('No trips.\nTry [Search sailings](/search) or **another date**.', [
        { path: '/search' },
      ]),
    ).toEqual([
      { text: 'No trips.\nTry ' },
      { text: 'Search sailings', path: '/trips' },
      { text: ' or ' },
      { text: 'another date', bold: true },
      { text: '.' },
    ]);
  });
  it('keeps unapproved and unsafe links as text', () => {
    expect(
      assistantMessage('[Bad](javascript:alert) [Other](/bookings)', [
        { path: 'javascript:alert' },
      ]),
    ).toEqual([{ text: 'Bad' }, { text: ' ' }, { text: 'Other' }]);
    for (const path of [
      '//example.com',
      '/search\\evil',
      '/search/../admin',
      '/admin',
      'https://example.com',
    ])
      expect(assistantPath(path)).toBe(false);
    expect(assistantPath('/booking-details?reference=BL-123')).toBe(true);
    expect(assistantPath('/trips?all=1')).toBe(true);
  });
  it('preserves HTML as plain text for Vue to escape', () => {
    expect(assistantMessage('<img src=x onerror=alert(1)>')).toEqual([
      { text: '<img src=x onerror=alert(1)>' },
    ]);
  });
});
