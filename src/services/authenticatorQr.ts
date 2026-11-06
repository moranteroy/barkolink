import QRCode from 'qrcode';

/** Render the exact Auth enrollment URI with a four-module scan margin. */
export async function authenticatorQr(uri: string): Promise<{ src: string; size: number }> {
  const parsed = new URL(uri);
  if (
    parsed.protocol !== 'otpauth:' ||
    parsed.hostname !== 'totp' ||
    !parsed.searchParams.get('secret')
  ) {
    throw new Error('Invalid authenticator setup URI.');
  }
  const options = { errorCorrectionLevel: 'M' as const, margin: 4 };
  const modules = QRCode.create(uri, options).modules.size + 8;
  // Whole CSS pixels per module keep the code sharp on a laptop screen.
  const size = modules * Math.max(3, Math.floor(280 / modules));
  const svg = await QRCode.toString(uri, {
    ...options,
    type: 'svg',
    color: { dark: '#000000', light: '#ffffff' },
  });
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, size };
}
