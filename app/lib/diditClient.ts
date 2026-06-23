const BASE_URL    = process.env.DIDIT_BASE_URL ?? 'https://verification.didit.me';
const API_KEY     = process.env.DIDIT_API_KEY ?? '';
const WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID ?? '';

export interface SesionDidit {
  session_id: string;
  url: string;
}

// Campos extraídos del documento que nos devuelve Didit en kyc.data.
// TODO: verificar nombres exactos de campo en respuesta real de Didit para cada uno.
export interface DatosDocumentoDidit {
  document_number?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;        // TODO: verificar valores posibles ('M'/'F' o 'Male'/'Female')
  date_of_birth?: string; // TODO: verificar formato (esperamos YYYY-MM-DD)
  nationality?: string;
  mrz_line1?: string;
  mrz_line2?: string;
}

export interface DecisionDidit {
  status: string;
  kyc?: {
    status?: string;
    data?: DatosDocumentoDidit;
  };
}

interface CrearSesionOptions {
  vendorData: string;
  callback: string;
}

export async function crearSesionDidit(options: CrearSesionOptions): Promise<SesionDidit> {
  if (!API_KEY || !WORKFLOW_ID) {
    throw new Error('DIDIT_API_KEY o DIDIT_WORKFLOW_ID no están configuradas');
  }

  const res = await fetch(`${BASE_URL}/v3/session/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      workflow_id: WORKFLOW_ID,
      vendor_data: options.vendorData,
      callback: options.callback,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Didit API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<SesionDidit>;
}

export async function obtenerDecision(sessionId: string): Promise<DecisionDidit> {
  if (!API_KEY) {
    throw new Error('DIDIT_API_KEY no está configurada');
  }

  const res = await fetch(`${BASE_URL}/v3/session/${sessionId}/decision/`, {
    headers: { 'x-api-key': API_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Didit API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<DecisionDidit>;
}
