/**
 * Fixed-precision decimal helpers for price/size calculations.
 */

const DEFAULT_PRECISION = 12;

export function round(value: number, precision = DEFAULT_PRECISION): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function add(a: number, b: number, precision = DEFAULT_PRECISION): number {
  return round(a + b, precision);
}

export function subtract(a: number, b: number, precision = DEFAULT_PRECISION): number {
  return round(a - b, precision);
}

export function multiply(a: number, b: number, precision = DEFAULT_PRECISION): number {
  return round(a * b, precision);
}

export function divide(a: number, b: number, precision = DEFAULT_PRECISION): number {
  if (b === 0) {
    throw new Error("Division by zero");
  }
  return round(a / b, precision);
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function countDecimals(value: string | number): number {
  const str = String(value);
  const dot = str.indexOf(".");
  return dot === -1 ? 0 : str.length - dot - 1;
}

export function formatPrice(price: number, priceUnit?: number): string {
  if (priceUnit !== undefined && priceUnit > 0) {
    const decimals = countDecimals(String(priceUnit));
    const stepped = Math.round(price / priceUnit) * priceUnit;
    return stepped.toFixed(decimals);
  }
  return price.toString();
}

export function formatVolume(volume: number, volUnit?: number): string {
  if (volUnit !== undefined && volUnit > 0) {
    const stepped = Math.floor(volume / volUnit) * volUnit;
    return String(Math.max(stepped, volUnit));
  }
  return String(Math.floor(volume));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function percentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}
