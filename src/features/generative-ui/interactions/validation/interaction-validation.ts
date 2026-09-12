interface TextValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  kind?: "text" | "email" | "search";
}

interface NumberValidation {
  required?: boolean;
  min?: number;
  max?: number;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTextValue(value: string, validation?: TextValidation) {
  if (value.length === 0) return validation?.required ? "Este campo es obligatorio" : null;
  if (validation?.minLength !== undefined && value.length < validation.minLength) return `Usa al menos ${validation.minLength} caracteres`;
  if (validation?.maxLength !== undefined && value.length > validation.maxLength) return `Usa como máximo ${validation.maxLength} caracteres`;
  if (validation?.kind === "email" && value.length > 0 && !emailPattern.test(value)) return "Ingresa un correo válido";
  return null;
}

export function validateNumberValue(value: string, validation: NumberValidation) {
  if (value === "") return validation.required ? "Este campo es obligatorio" : null;
  const number = Number(value);
  if (!Number.isFinite(number)) return "Ingresa un número válido";
  if (validation.min !== undefined && number < validation.min) return `El mínimo es ${validation.min}`;
  if (validation.max !== undefined && number > validation.max) return `El máximo es ${validation.max}`;
  return null;
}

export function validateSelectionCount(length: number, min = 0, max = Number.POSITIVE_INFINITY) {
  if (length < min) return `Selecciona al menos ${min}`;
  if (length > max) return `Selecciona como máximo ${max}`;
  return null;
}

export function validateDateValue(value: string, required?: boolean, min?: string, max?: string) {
  if (!value) return required ? "Selecciona una fecha" : null;
  if (min && value < min) return `La fecha mínima es ${min}`;
  if (max && value > max) return `La fecha máxima es ${max}`;
  return null;
}
