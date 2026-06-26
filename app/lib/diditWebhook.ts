import { createHmac, timingSafeEqual } from 'crypto';

export function verificarFirmaDidit(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const signature = headers.get('x-signature');
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  const sigBuf  = Buffer.from(signature);
  const expBuf  = Buffer.from(expected);

  // timingSafeEqual lanza si los buffers tienen distinto largo
  if (sigBuf.length !== expBuf.length) return false;

  try {
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export function verificarTimestamp(
  headers: Headers,
  toleranciaMs = 300_000,
): boolean {
  const ts = headers.get('x-timestamp');
  if (!ts) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;

  // Acepta epoch en segundos o milisegundos sin ampliar la ventana anti-replay.
  const tsMs = tsNum < 1_000_000_000_000 ? tsNum * 1000 : tsNum;
  if (isNaN(tsMs)) return false;

  return Math.abs(Date.now() - tsMs) <= toleranciaMs;
}
