// ============================================================================
//  app/lib/types.ts — Tipos del dominio (no formales en la app actual)
//  Reflejan los campos que ya usás en Firestore. Agregá los que falten.
// ============================================================================

export type EstadoControl =
  | 'pendiente' | 'escaneado' | 'cargado_je' | 'aprobado'
  | 'error' | 'suspendido' | 'baja' | 'firmado';

export type Rol = 'pendiente' | 'afiliador' | 'supervisor' | 'admin';

export interface Ficha {
  id: string;
  tipoDocumento?: 'DNI' | 'LE' | 'LC';
  dni: string;
  apellidos: string;
  nombres: string;
  sexo?: string;
  clase?: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  nacionalidad?: string;
  profesion?: string;
  estadoCivil?: string;
  celular?: string;
  mail?: string;
  distrito?: string;
  localidad?: string;
  calle?: string;
  numero?: string;
  piso?: string;
  dpto?: string;
  observaciones?: string;
  archivoDni?: string;
  archivoDniPath?: string;
  archivoFicha?: string;
  archivoFichaPath?: string;
  afiliadorNombre?: string;
  afiliadorEmail?: string;
  afiliadorUid?: string;
  estadoControl?: EstadoControl;
  errorJE?: string;
  suspendidoComentario?: string | null;
  estadoAnterior?: EstadoControl;
  fecha?: any;            // Firestore Timestamp
  // …resto de campos de auditoría de control
  [key: string]: any;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  perfilCompleto: boolean;
  fechaRegistro?: any;
}
