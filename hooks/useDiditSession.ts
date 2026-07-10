// ============================================================================
//  hooks/useDiditSession.ts — Lógica compartida del flujo Didit (escaneo de DNI)
//  Encapsula estados, polling de retorno y arranque de sesión.
//  Usado por la página interna (app/page.tsx) y el link público (app/cargar/[token]/page.tsx).
// ============================================================================
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { LOCALIDADES } from '../app/lib/estados';

export interface UseDiditSessionOptions {
  /** Endpoint POST que crea la sesión en Didit. */
  startSessionUrl: string;
  /** Endpoint GET que devuelve estado y datos de una sesión Didit. Se le agrega `?session_id=X`. */
  pollStatusUrl: string;
  /** Clave única de localStorage para persistir el sessionId pendiente entre redirects. */
  storageKey: string;
  /** Headers para el POST inicial (típicamente Content-Type + Authorization). */
  getStartHeaders: () => Promise<Record<string, string>>;
  /** Body del POST inicial. */
  getStartBody: () => Promise<Record<string, unknown>>;
  /** Headers para el polling. Opcional: el endpoint público no requiere auth. */
  getPollHeaders?: () => Promise<Record<string, string>>;
  /** Setter del formulario al que se autocompletan los campos extraídos. */
  setFormData: Dispatch<SetStateAction<any>>;
  /** Callback opcional cuando se detecta retorno con session pendiente (antes del polling). */
  onRetorno?: () => void;
  /** Callback opcional cuando Didit devuelve datos y se autocompleta el formulario. */
  onAutocompletado?: () => void;
  /**
   * Función para bajar el blob de un archivo de Storage dado su path.
   * Si no se provee, usa Firebase Storage SDK directamente (requiere auth).
   * El flujo público inyecta su propia función que llama a un endpoint backend.
   */
  bajarPreviewBlob?: (path: string) => Promise<Blob>;
}

export interface UseDiditSessionResult {
  iniciandoSesionDidit: boolean;
  diditProcesandoRetorno: boolean;
  diditError: string | null;
  diditMensajePendiente: string | null;
  diditAutocompleted: boolean;
  diditCamposAutocompletados: Set<string>;
  diditFrenteStoragePath: string | null;
  diditDorsoStoragePath: string | null;
  diditDniImagePath: string | null;
  diditFrentePreviewUrl: string | null;
  diditDorsoPreviewUrl: string | null;
  diditDniImagePreviewUrl: string | null;
  iniciarSesion: () => Promise<void>;
  /** Limpia todos los estados Didit y borra el sessionId pendiente del localStorage. */
  reset: () => void;
}

export function useDiditSession(opciones: UseDiditSessionOptions): UseDiditSessionResult {
  const [iniciandoSesionDidit, setIniciandoSesionDidit] = useState(false);
  const [diditProcesandoRetorno, setDiditProcesandoRetorno] = useState(false);
  const [diditError, setDiditError] = useState<string | null>(null);
  const [diditMensajePendiente, setDiditMensajePendiente] = useState<string | null>(null);
  const [diditAutocompleted, setDiditAutocompleted] = useState(false);
  const [diditCamposAutocompletados, setDiditCamposAutocompletados] = useState<Set<string>>(new Set());
  const [diditFrenteStoragePath, setDiditFrenteStoragePath] = useState<string | null>(null);
  const [diditDorsoStoragePath, setDiditDorsoStoragePath] = useState<string | null>(null);
  const [diditDniImagePath, setDiditDniImagePath] = useState<string | null>(null);
  const [diditFrentePreviewUrl, setDiditFrentePreviewUrl] = useState<string | null>(null);
  const [diditDorsoPreviewUrl, setDiditDorsoPreviewUrl] = useState<string | null>(null);
  const [diditDniImagePreviewUrl, setDiditDniImagePreviewUrl] = useState<string | null>(null);

  // Ref estable para que el useEffect del polling pueda leer la última versión
  // de las opciones sin invalidar el efecto en cada render.
  const opcionesRef = useRef(opciones);
  useEffect(() => {
    opcionesRef.current = opciones;
  });

  // Preview de la imagen combinada del DNI.
  useEffect(() => {
    if (!diditDniImagePath) {
      setDiditDniImagePreviewUrl(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const blob = opcionesRef.current.bajarPreviewBlob
          ? await opcionesRef.current.bajarPreviewBlob(diditDniImagePath)
          : await getBlob(ref(storage, diditDniImagePath));
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setDiditDniImagePreviewUrl(objectUrl);
      } catch (err) {
        console.error('[useDiditSession] error bajando preview DNI:', err);
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [diditDniImagePath]);

  // Preview del frente del DNI.
  useEffect(() => {
    if (!diditFrenteStoragePath) {
      setDiditFrentePreviewUrl(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const blob = opcionesRef.current.bajarPreviewBlob
          ? await opcionesRef.current.bajarPreviewBlob(diditFrenteStoragePath)
          : await getBlob(ref(storage, diditFrenteStoragePath));
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setDiditFrentePreviewUrl(objectUrl);
      } catch (err) {
        console.error('[useDiditSession] error bajando preview frente:', err);
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [diditFrenteStoragePath]);

  // Preview del dorso del DNI.
  useEffect(() => {
    if (!diditDorsoStoragePath) {
      setDiditDorsoPreviewUrl(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const blob = opcionesRef.current.bajarPreviewBlob
          ? await opcionesRef.current.bajarPreviewBlob(diditDorsoStoragePath)
          : await getBlob(ref(storage, diditDorsoStoragePath));
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setDiditDorsoPreviewUrl(objectUrl);
      } catch (err) {
        console.error('[useDiditSession] error bajando preview dorso:', err);
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [diditDorsoStoragePath]);

  // Polling de retorno desde Didit. Corre una sola vez al montar el componente.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const sessionIdParam = params.get('didit_session');
    const sessionId = sessionIdParam || localStorage.getItem(opcionesRef.current.storageKey);

    if (!sessionId) return;

    // Reanudación: no venimos del redirect de Didit sino de una sesión pendiente
    // guardada en localStorage (redirect fallido o escaneo abandonado).
    const esReanudacion = !sessionIdParam;

    localStorage.removeItem(opcionesRef.current.storageKey);

    // Quitar didit_session del query string preservando el resto.
    const url = new URL(window.location.href);
    url.searchParams.delete('didit_session');
    const search = url.searchParams.toString();
    const nuevoPath = url.pathname + (search ? `?${search}` : '') + url.hash;
    history.replaceState(null, '', nuevoPath);

    opcionesRef.current.onRetorno?.();
    setDiditError(null);

    let cancelado = false;
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Una consulta de estado. 'seguir': la sesión sigue pendiente. 'terminado':
    // estado final ya manejado (autocompletado o mensaje seteado). 'cortar': la
    // sesión o el link ya no son válidos (4xx definitivo). 'transitorio': fallo
    // de red o error del servidor, se puede reintentar.
    const consultarEstado = async (): Promise<'seguir' | 'terminado' | 'cortar' | 'transitorio'> => {
      try {
        const headers = opcionesRef.current.getPollHeaders
          ? await opcionesRef.current.getPollHeaders()
          : {};
        const res = await fetch(`${opcionesRef.current.pollStatusUrl}?session_id=${sessionId}`, {
          headers,
        });

        if (!res.ok) {
          if ([400, 401, 403, 404, 410].includes(res.status)) {
            setDiditError('La sesión de escaneo ya no es válida. Iniciá un escaneo nuevo o cargá los datos manualmente.');
            return 'cortar';
          }
          return 'transitorio';
        }

        const data = await res.json();
        if (data.status !== 'completado') return 'seguir';

        // Estados finales según el webhook: 'Approved' | 'Declined' (procesadoEn
        // solo se setea en esos dos, así que acá diditStatus es uno de ellos).
        if (data.diditStatus === 'Declined') {
          setDiditError('La verificación del DNI fue rechazada. Podés reintentar el escaneo o cargar los datos manualmente.');
          return 'terminado';
        }

        const raw: Record<string, unknown> = data.datos || {};
        const campos: Record<string, string> = {};
        const completados = new Set<string>();
        const tryAdd = (key: string, val: unknown) => {
          if (!val) return;
          const str = key === 'dni' ? String(val).replace(/\D/g, '') : String(val);
          if (str) {
            campos[key] = str;
            completados.add(key);
          }
        };
        tryAdd('dni', raw.dni);
        tryAdd('nombres', raw.nombres);
        tryAdd('apellidos', raw.apellidos);
        tryAdd('sexo', raw.sexo);
        tryAdd('fechaNacimiento', raw.fechaNacimiento);
        if (campos.fechaNacimiento) {
          const partes = campos.fechaNacimiento.split('/');
          if (partes.length === 3 && partes[2]) {
            campos.clase = partes[2];
            completados.add('clase');
          }
        }
        tryAdd('nacionalidad', raw.nacionalidad);
        tryAdd('lugarNacimiento', raw.lugarNacimiento);
        tryAdd('calle', raw.calle);
        tryAdd('numero', raw.numero);
        if (raw.localidad && LOCALIDADES.includes(String(raw.localidad))) {
          tryAdd('localidad', raw.localidad);
        }

        // Approved pero sin datos ni imágenes: no tratarlo como éxito silencioso.
        if (completados.size === 0 && !raw.frontImageStoragePath && !raw.backImageStoragePath && !raw.dniImageStoragePath) {
          setDiditError('El escaneo terminó pero no devolvió datos del DNI. Cargalos manualmente.');
          return 'terminado';
        }

        opcionesRef.current.setFormData((prev: any) => ({ ...prev, ...campos }));
        setDiditCamposAutocompletados(completados);
        setDiditAutocompleted(completados.size > 0);
        if (completados.size > 0) opcionesRef.current.onAutocompletado?.();

        if (raw.frontImageStoragePath) setDiditFrenteStoragePath(String(raw.frontImageStoragePath));
        if (raw.backImageStoragePath)  setDiditDorsoStoragePath(String(raw.backImageStoragePath));
        if (raw.dniImageStoragePath)   setDiditDniImagePath(String(raw.dniImageStoragePath));

        return 'terminado';
      } catch (e) {
        console.error('Error polling Didit:', e);
        return 'transitorio';
      }
    };

    const correr = async () => {
      if (esReanudacion) {
        // Sesión pendiente vieja: chequeo único sin bloquear la UI (más un
        // reintento corto por si el webhook de Didit todavía no llegó). Si la
        // sesión sigue pendiente, el usuario la abandonó: no se entra al
        // polling largo ni se bloquea el botón.
        let resultado = await consultarEstado();
        if (resultado === 'seguir' && !cancelado) {
          await esperar(5000);
          if (cancelado) return;
          resultado = await consultarEstado();
        }
        if (resultado === 'seguir' && !cancelado) {
          setDiditMensajePendiente('Quedó un escaneo de DNI sin terminar. Podés escanear de nuevo o cargar los datos manualmente.');
        }
        return;
      }

      // Retorno real desde Didit: polling largo con indicador de carga.
      setDiditProcesandoRetorno(true);
      let intentos = 0;
      let fallosSeguidos = 0;
      const maxIntentos = 60;

      while (intentos < maxIntentos && !cancelado) {
        intentos++;
        const resultado = await consultarEstado();
        if (resultado === 'terminado' || resultado === 'cortar') {
          setDiditProcesandoRetorno(false);
          return;
        }
        if (resultado === 'transitorio') {
          fallosSeguidos++;
          if (fallosSeguidos >= 3) {
            setDiditProcesandoRetorno(false);
            setDiditError('No se pudo consultar el estado del escaneo. Revisá tu conexión e intentá de nuevo, o cargá los datos manualmente.');
            return;
          }
        } else {
          fallosSeguidos = 0;
        }
        await esperar(3000);
      }

      if (!cancelado) {
        setDiditProcesandoRetorno(false);
        setDiditError('El escaneo está tardando. Podés completar los datos manualmente o intentar de nuevo.');
      }
    };

    correr();
    return () => {
      cancelado = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setIniciandoSesionDidit(false);
    setDiditProcesandoRetorno(false);
    setDiditError(null);
    setDiditMensajePendiente(null);
    setDiditAutocompleted(false);
    setDiditCamposAutocompletados(new Set());
    setDiditFrenteStoragePath(null);
    setDiditDorsoStoragePath(null);
    setDiditDniImagePath(null);
    setDiditFrentePreviewUrl(null);
    setDiditDorsoPreviewUrl(null);
    setDiditDniImagePreviewUrl(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(opcionesRef.current.storageKey);
    }
  }, []);

  const iniciarSesion = useCallback(async () => {
    setIniciandoSesionDidit(true);
    setDiditError(null);
    setDiditMensajePendiente(null);
    try {
      const headers = await opcionesRef.current.getStartHeaders();
      const body = await opcionesRef.current.getStartBody();
      const res = await fetch(opcionesRef.current.startSessionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Error al iniciar sesión con Didit');
      }
      const { sessionId, url } = await res.json();
      localStorage.setItem(opcionesRef.current.storageKey, sessionId);
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar el escaneo. Intentá de nuevo.';
      setDiditError(msg);
      setIniciandoSesionDidit(false);
    }
  }, []);

  return {
    iniciandoSesionDidit,
    diditProcesandoRetorno,
    diditError,
    diditMensajePendiente,
    diditAutocompleted,
    diditCamposAutocompletados,
    diditFrenteStoragePath,
    diditDorsoStoragePath,
    diditDniImagePath,
    diditFrentePreviewUrl,
    diditDorsoPreviewUrl,
    diditDniImagePreviewUrl,
    iniciarSesion,
    reset,
  };
}
