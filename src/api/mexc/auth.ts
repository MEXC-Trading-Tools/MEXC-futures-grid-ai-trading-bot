import { createHmac } from "node:crypto";

/**
 * MEXC Futures OPEN-API HMAC-SHA256 signature.
 * targetString = accessKey + timestamp + parameterString
 */
export function signFuturesRequest(
  secretKey: string,
  accessKey: string,
  timestamp: string,
  parameterString: string,
): string {
  const target = `${accessKey}${timestamp}${parameterString}`;
  return createHmac("sha256", secretKey).update(target).digest("hex");
}

export function buildGetParameterString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  return entries.join("&");
}

export function buildPostParameterString(body: Record<string, unknown> | unknown[]): string {
  return JSON.stringify(body);
}

export interface FuturesAuthHeaders {
  ApiKey: string;
  "Request-Time": string;
  Signature: string;
  "Recv-Window"?: string;
  "Content-Type"?: string;
}

export function buildAuthHeaders(
  accessKey: string,
  secretKey: string,
  parameterString: string,
  recvWindow = 5000,
): FuturesAuthHeaders {
  const timestamp = String(Date.now());
  const signature = signFuturesRequest(
    secretKey,
    accessKey,
    timestamp,
    parameterString,
  );

  return {
    ApiKey: accessKey,
    "Request-Time": timestamp,
    Signature: signature,
    "Recv-Window": String(recvWindow),
  };
}
