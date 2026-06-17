// ============================================================================
//  app/lib/decodeDniBarcode.ts
//  Intenta decodificar el PDF417 de un dataUrl (foto del DNI). Devuelve los
//  campos parseados si lo logra, o null si no encuentra el código.
//  No tira excepciones — fail silently para uso "en background" al sacar foto.
// ============================================================================
import { BrowserPDF417Reader, DecodeHintType, NotFoundException } from '@zxing/library';
import { parseDniPdf417, type ParsedDni } from './parseDniPdf417';

export async function decodeDniBarcode(dataUrl: string): Promise<ParsedDni | null> {
  try {
    const reader = new BrowserPDF417Reader();
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    (reader as any).hints = hints;
    const result = await reader.decodeFromImageUrl(dataUrl);
    const raw = result.getText();
    return parseDniPdf417(raw);
  } catch (e) {
    if (!(e instanceof NotFoundException)) {
      console.debug('[decodeDniBarcode]', e);
    }
    return null;
  }
}