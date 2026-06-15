// ============================================================================
//  app/lib/parseDniPdf417.ts
//  Parser del código de barras PDF417 del DNI argentino.
//
//  Formato típico (campos separados por '@'):
//    [trámite] @ APELLIDO @ NOMBRE @ Sexo(M/F) @ DNI @ Ejemplar @ FechaNac(DD/MM/AAAA)
//      @ FechaEmisión(DD/MM/AAAA) @ [CUIL: prefijo y/o sufijo]
//
//  Algunos DNIs no traen todos los campos (sin CUIL, sin emisión, etc).
//  El parser es defensivo: hace detección heurística y devuelve `warnings`
//  para mostrar en la UI cuando un campo no se pudo extraer.
// ============================================================================

export interface ParsedDni {
  apellidos: string;
  nombres: string;
  sexo: '' | 'Masculino' | 'Femenino';
  dni: string;
  fechaNacimiento: string;   // DD/MM/AAAA
  clase: string;             // AAAA (derivado de fechaNacimiento)
  cuil: string;              // XX-XXXXXXXX-X o '' si no se pudo armar
  ejemplar: string;
  fechaEmision: string;
  numeroTramite: string;
  raw: string;               // string original (debug)
  warnings: string[];
}

const RE_DATE   = /^\d{2}\/\d{2}\/\d{4}$/;
const RE_DIGITS = /^\d+$/;
const RE_LETTER = /^[A-Z]$/;
const RE_SEX    = /^[MF]$/;

/**
 * El PDF417 no soporta caracteres extendidos: la Ñ aparece codificada como "XX"
 * entre letras (NUXXEZ → NUÑEZ, MUXXOZ → MUÑOZ). La Ü a veces también se ve
 * como XX (AGUXXERO → AGÜERO), pero como la Ü es más rara, dejamos que el
 * usuario corrija ese caso en la edición.
 */
function fixNyXX(s: string): string {
  return s.replace(/([A-Z])XX([A-Z])/g, '$1Ñ$2');
}

/**
 * Pasa "NUÑEZ" → "Nuñez", "MARIA LAURA" → "Maria Laura", "DE LA TORRE" → "De La Torre".
 * Capitaliza después de espacios, guiones y apóstrofes. Usa \p{L} para letras Unicode.
 */
function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

export function parseDniPdf417(raw: string): ParsedDni {
  const warnings: string[] = [];
  const result: ParsedDni = {
    apellidos: '', nombres: '', sexo: '', dni: '',
    fechaNacimiento: '', clase: '', cuil: '',
    ejemplar: '', fechaEmision: '', numeroTramite: '',
    raw, warnings,
  };

  const parts = raw.split('@').map(p => p.trim()).filter(p => p.length > 0);

  if (parts.length < 5) {
    warnings.push(`Pocos campos detectados (${parts.length}). El formato no parece ser PDF417 del DNI.`);
    return result;
  }

  let i = 0;

  // [0] Número de trámite (8-9 dígitos). Algunos DNIs viejos no lo traen.
  if (parts[i] && RE_DIGITS.test(parts[i]) && parts[i].length >= 7) {
    result.numeroTramite = parts[i];
    i++;
  }

  // Apellido (texto, no puro dígito)
  if (parts[i] && !RE_DIGITS.test(parts[i])) {
    result.apellidos = titleCase(fixNyXX(parts[i]));
    i++;
  } else {
    warnings.push('No se pudo detectar el apellido.');
  }

  // Nombre (texto, no puro dígito)
  if (parts[i] && !RE_DIGITS.test(parts[i])) {
    result.nombres = titleCase(fixNyXX(parts[i]));
    i++;
  } else {
    warnings.push('No se pudo detectar el nombre.');
  }

  // Sexo (M/F)
  if (parts[i] && RE_SEX.test(parts[i])) {
    result.sexo = parts[i] === 'M' ? 'Masculino' : 'Femenino';
    i++;
  } else {
    warnings.push('No se pudo detectar el sexo.');
  }

  // DNI (7-9 dígitos, no es una fecha)
  if (parts[i] && RE_DIGITS.test(parts[i]) && parts[i].length >= 7 && parts[i].length <= 9) {
    result.dni = parts[i];
    i++;
  } else {
    warnings.push('No se pudo detectar el número de DNI.');
  }

  // Ejemplar (A, B, C...)
  if (parts[i] && RE_LETTER.test(parts[i])) {
    result.ejemplar = parts[i];
    i++;
  }

  // Fecha de nacimiento (DD/MM/AAAA)
  if (parts[i] && RE_DATE.test(parts[i])) {
    result.fechaNacimiento = parts[i];
    result.clase = parts[i].split('/')[2];
    i++;
  } else {
    warnings.push('No se pudo detectar la fecha de nacimiento.');
  }

  // Fecha de emisión (DD/MM/AAAA) — opcional, no se mapea al form pero lo guardamos
  if (parts[i] && RE_DATE.test(parts[i])) {
    result.fechaEmision = parts[i];
    i++;
  }

  // CUIL: el PDF417 trae prefijo (2 dígitos) y sufijo (1 dígito). El medio es el DNI.
  // Formato XX-XXXXXXXX-X. Algunos DNIs vienen como "20" + "3" en tokens separados,
  // otros como "203" concatenado, otros como CUIL completo de 11 dígitos.
  if (result.dni && i < parts.length) {
    const tok = parts[i];
    if (RE_DIGITS.test(tok)) {
      if (tok.length === 2 && parts[i + 1] && RE_DIGITS.test(parts[i + 1]) && parts[i + 1].length === 1) {
        result.cuil = `${tok}-${result.dni.padStart(8, '0')}-${parts[i + 1]}`;
        i += 2;
      } else if (tok.length === 3) {
        result.cuil = `${tok.slice(0, 2)}-${result.dni.padStart(8, '0')}-${tok.slice(2)}`;
        i++;
      } else if (tok.length === 11) {
        result.cuil = `${tok.slice(0, 2)}-${tok.slice(2, 10)}-${tok.slice(10)}`;
        i++;
      }
    }
  }

  if (!result.apellidos && !result.nombres && !result.dni) {
    warnings.unshift('No se pudieron extraer datos del código. Verificá el escaneo.');
  }

  return result;
}

/**
 * Devuelve sólo los campos que mapean al formData del FichaForm.
 * Útil para hacer setFormData(prev => ({ ...prev, ...campos })) sin pisar
 * datos no relacionados.
 */
export function parsedDniToFormFields(p: ParsedDni): Partial<{
  apellidos: string;
  nombres: string;
  sexo: string;
  dni: string;
  fechaNacimiento: string;
  clase: string;
  nacionalidad: string;
}> {
  const out: any = {};
  if (p.apellidos) out.apellidos = p.apellidos;
  if (p.nombres) out.nombres = p.nombres;
  if (p.sexo) out.sexo = p.sexo;
  if (p.dni) out.dni = p.dni;
  if (p.fechaNacimiento) out.fechaNacimiento = p.fechaNacimiento;
  if (p.clase) out.clase = p.clase;
  // Si el código se parseó bien, asumimos argentino. El usuario puede corregir.
  if (p.dni && p.fechaNacimiento) out.nacionalidad = 'Argentina';
  return out;
}