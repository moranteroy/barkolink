import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { ticketDocument } from '../../src/data/ticketExport'
const code = '11111111-1111-4111-8111-111111111111'
const booking = { reference: 'BL-TEST', status: 'CONFIRMED', paymentStatus: 'PAID', from: '<script>alert(1)</script>', to: 'Batangas', date: 'Oct 4, 2026', departure: '8:00 AM', vessel: 'Test ferry', passengers: [{ name: 'Passenger & One', type: 'Regular', ticketCode: code, ticketStatus: 'ISSUED' }] }
describe('Downloadable tickets', () => {
  it('exports issued paid tickets with embedded QR and escaped passenger text', async () => {
    const html = await ticketDocument(booking)
    expect(html).toContain('data:image/png;base64,')
    expect(html).toContain('Passenger &amp; One')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('https://')
    expect(html).toContain(code)
    await expect(ticketDocument({ ...booking, paymentStatus: 'UNPAID' })).rejects.toThrow('paid')
    await expect(ticketDocument({ ...booking, status: 'CANCELLED' })).rejects.toThrow('paid')
    await expect(ticketDocument({ ...booking, passengers: [{ ...booking.passengers[0], ticketStatus: 'CANCELLED' }] })).rejects.toThrow('No issued')
  })
  it('encodes a real ticket value that the boarding decoder can read', () => {
    const qr = QRCode.create(code, { errorCorrectionLevel: 'M' })
    const scale = 6, margin = 4, size = (qr.modules.size + margin * 2) * scale
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255)
    for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
      if (!qr.modules.get(y, x)) continue
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const offset = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0
      }
    }
    expect(jsQR(pixels, size, size)?.data).toBe(code)
  })
})
