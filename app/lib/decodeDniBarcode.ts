// ============================================================================
//  app/lib/decodeDniBarcode.ts
//  Intenta decodificar el PDF417 de una foto/canvas del DNI. Devuelve los
//  campos parseados si lo logra, o null si no encuentra el codigo.
//  No tira excepciones: fail silently para uso en background al sacar foto.
// ============================================================================
import {
  BarcodeFormat,
  BinaryBitmap,
  BrowserPDF417Reader,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
  NotFoundException,
  PDF417Reader,
  type Binarizer,
  type Result,
} from '@zxing/library';
import { parseDniPdf417, type ParsedDni } from './parseDniPdf417';

export async function decodeDniBarcode(source: string | Blob | HTMLCanvasElement): Promise<ParsedDni | null> {
  try {
    const browserRaw = await leerConBrowserReader(source);
    if (browserRaw) return parseDniPdf417(browserRaw);

    const baseCanvas = typeof source === 'string'
      ? await dataUrlToCanvas(source)
      : source instanceof Blob
        ? await blobToCanvas(source)
      : source;
    const raw = await leerPdf417DesdeCanvas(baseCanvas);
    return parseDniPdf417(raw);
  } catch (e) {
    if (!(e instanceof NotFoundException)) {
      console.debug('[decodeDniBarcode]', e);
    }
    return null;
  }
}

async function leerConBrowserReader(source: string | Blob | HTMLCanvasElement): Promise<string | null> {
  let url: string | null = null;
  try {
    if (source instanceof HTMLCanvasElement) {
      url = source.toDataURL('image/png');
    } else if (source instanceof Blob) {
      url = URL.createObjectURL(source);
    } else {
      url = source;
    }

    const reader = new BrowserPDF417Reader();
    const result = await reader.decodeFromImageUrl(url);
    return result.getText();
  } catch {
    return null;
  } finally {
    if (source instanceof Blob && url) URL.revokeObjectURL(url);
  }
}

async function leerPdf417DesdeCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const normalizado = normalizarTamano(canvas);

  try {
    const variantesBasicas = [
      normalizado,
      aplicarFiltroCanvas(normalizado, 'grayscale(100%) contrast(1.7) brightness(1.08)'),
      aplicarUmbralCanvas(normalizado, 128),
    ];
    try {
      const raw = await probarVariantes(variantesBasicas);
      if (raw) return raw;
    } finally {
      liberarVariantes(variantesBasicas, normalizado);
    }

    const variantesAvanzadas = [
      aplicarFiltroCanvas(normalizado, 'grayscale(100%) contrast(2.25) brightness(1.15)'),
      aplicarUmbralCanvas(normalizado, 160),
      ...crearBandasHorizontales(normalizado).flatMap(banda => [
        banda,
        aplicarFiltroCanvas(banda, 'grayscale(100%) contrast(2) brightness(1.1)'),
      ]),
    ];
    try {
      const raw = await probarVariantes(variantesAvanzadas);
      if (raw) return raw;
    } finally {
      liberarVariantes(variantesAvanzadas);
    }
  } finally {
    liberarCanvasSiEsNuevo(normalizado, canvas);
  }

  throw NotFoundException.getNotFoundInstance();
}

async function probarVariantes(variantes: HTMLCanvasElement[]): Promise<string | null> {
  for (const variante of variantes) {
    const native = await leerConBarcodeDetector(variante);
    if (native) return native;
  }

  for (const variante of variantes) {
    const raw = leerConZxing(variante);
    if (raw) return raw;
  }

  return null;
}

function liberarVariantes(variantes: HTMLCanvasElement[], preservar?: HTMLCanvasElement) {
  for (const variante of variantes) {
    if (variante !== preservar) liberarCanvas(variante);
  }
}

function liberarCanvasSiEsNuevo(canvas: HTMLCanvasElement, original: HTMLCanvasElement) {
  if (canvas !== original) liberarCanvas(canvas);
}

function liberarCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function normalizarTamano(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const targetWidth = Math.min(2600, Math.max(1800, canvas.width));
  if (canvas.width >= 1800 && canvas.width <= 2600) return canvas;

  const scale = targetWidth / canvas.width;
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

function crearBandasHorizontales(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const bandas = [
    { y: 0.00, h: 0.45 },
    { y: 0.20, h: 0.50 },
    { y: 0.45, h: 0.55 },
  ];

  return bandas.map(({ y, h }) => {
    const sy = Math.round(canvas.height * y);
    const sh = Math.min(canvas.height - sy, Math.round(canvas.height * h));
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = sh;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, out.width, out.height);
    return out;
  });
}

function aplicarFiltroCanvas(canvas: HTMLCanvasElement, filter: string): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.filter = filter;
  ctx.drawImage(canvas, 0, 0);
  return out;
}

function aplicarUmbralCanvas(canvas: HTMLCanvasElement, umbral: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const v = lum > umbral ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

async function leerConBarcodeDetector(canvas: HTMLCanvasElement): Promise<string | null> {
  const Detector = (window as any).BarcodeDetector;
  if (!Detector) return null;

  try {
    const formats = typeof Detector.getSupportedFormats === 'function'
      ? await Detector.getSupportedFormats()
      : ['pdf417'];
    if (!formats.includes('pdf417')) return null;

    const detector = new Detector({ formats: ['pdf417'] });
    const barcodes = await detector.detect(canvas);
    return barcodes.find((b: any) => b.rawValue)?.rawValue || null;
  } catch {
    return null;
  }
}

function leerConZxing(canvas: HTMLCanvasElement): string | null {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  for (const BinarizerClass of [HybridBinarizer, GlobalHistogramBinarizer]) {
    try {
      const source = new HTMLCanvasElementLuminanceSource(canvas, true);
      const bitmap = new BinaryBitmap(new BinarizerClass(source) as Binarizer);
      const result: Result = new PDF417Reader().decode(bitmap, hints);
      return result.getText();
    } catch {}
  }

  return null;
}

function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('No se pudo crear canvas para leer el DNI.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen del DNI.'));
    img.src = dataUrl;
  });
}

function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('No se pudo crear canvas para leer el DNI.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen del DNI.'));
    };
    img.src = url;
  });
}
