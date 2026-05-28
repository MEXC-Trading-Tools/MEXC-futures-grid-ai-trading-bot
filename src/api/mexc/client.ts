import {
  buildAuthHeaders,
  buildGetParameterString,
  buildPostParameterString,
} from "./auth.js";
import type {
  ContractDetail,
  ContractPrecision,
  ContractTicker,
  FuturesOrder,
  FuturesPosition,
  MexcFuturesResponse,
  OpenOrdersPage,
  PlaceFuturesOrderRequest,
  PlaceFuturesOrderResult,
} from "./types.js";
import { withRetry } from "../../utils/retry.js";

export interface MexcFuturesClientConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
  recvWindow?: number;
}

export class MexcFuturesApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "MexcFuturesApiError";
  }
}

const DEFAULT_BASE_URL = "https://api.mexc.com";

export class MexcFuturesClient {
  private readonly baseUrl: string;
  private readonly recvWindow: number;

  constructor(private readonly config: MexcFuturesClientConfig) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.recvWindow = config.recvWindow ?? 5000;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, string | number | boolean | undefined> = {},
    body?: Record<string, unknown> | unknown[],
    signed = false,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (signed) {
      const parameterString =
        method === "GET" || method === "DELETE"
          ? buildGetParameterString(params)
          : buildPostParameterString(body ?? {});

      const authHeaders = buildAuthHeaders(
        this.config.apiKey,
        this.config.secretKey,
        parameterString,
        this.recvWindow,
      );

      Object.assign(headers, authHeaders);

      if (method === "POST") {
        headers["Content-Type"] = "application/json";
      }

      if ((method === "GET" || method === "DELETE") && parameterString) {
        url += `?${parameterString}`;
      }
    } else {
      const qs = buildGetParameterString(params);
      if (qs) {
        url += `?${qs}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body:
        method === "POST" && body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });

    const text = await response.text();
    let json: MexcFuturesResponse<T> | null = null;

    if (text) {
      try {
        json = JSON.parse(text) as MexcFuturesResponse<T>;
      } catch {
        throw new Error(`Invalid JSON response (${response.status}): ${text}`);
      }
    }

    if (!response.ok) {
      throw new MexcFuturesApiError(
        json?.message ?? text ?? `HTTP ${response.status}`,
        json?.code ?? response.status,
      );
    }

    if (json && !json.success) {
      throw new MexcFuturesApiError(
        json.message ?? "MEXC Futures API error",
        json.code,
      );
    }

    return json!.data;
  }

  async ping(): Promise<boolean> {
    const ticker = await this.getTicker("BTC_USDT");
    return ticker.symbol === "BTC_USDT";
  }

  async getTicker(symbol: string): Promise<ContractTicker> {
    return this.request<ContractTicker>("GET", "/api/v1/contract/ticker", {
      symbol,
    });
  }

  async getContractDetail(symbol: string): Promise<ContractDetail> {
    return this.request<ContractDetail>("GET", "/api/v1/contract/detail", {
      symbol,
    });
  }

  extractPrecision(detail: ContractDetail): ContractPrecision {
    return {
      priceUnit: detail.priceUnit,
      volUnit: detail.volUnit,
      minVol: detail.minVol,
      maxVol: detail.maxVol,
      contractSize: detail.contractSize,
    };
  }

  async getOpenOrders(
    symbol?: string,
    pageNum = 1,
    pageSize = 100,
  ): Promise<FuturesOrder[]> {
    const data = await this.request<OpenOrdersPage>(
      "GET",
      "/api/v1/private/order/list/open_orders",
      {
        symbol,
        page_num: pageNum,
        page_size: pageSize,
      },
      undefined,
      true,
    );

    return data.resultList ?? [];
  }

  async placeOrder(
    order: PlaceFuturesOrderRequest,
  ): Promise<PlaceFuturesOrderResult> {
    const body: Record<string, unknown> = {
      symbol: order.symbol,
      price: order.price,
      vol: order.vol,
      side: order.side,
      type: order.type ?? 1,
      openType: order.openType,
      leverage: order.leverage,
      externalOid: order.externalOid,
      positionMode: order.positionMode ?? 2,
      reduceOnly: order.reduceOnly,
    };

    for (const key of Object.keys(body)) {
      if (body[key] === undefined) {
        delete body[key];
      }
    }

    return withRetry(
      () =>
        this.request<PlaceFuturesOrderResult>(
          "POST",
          "/api/v1/private/order/create",
          {},
          body,
          true,
        ),
      {
        shouldRetry: (err) =>
          err instanceof MexcFuturesApiError &&
          [429, 500, 503, 504].includes(err.code ?? 0),
      },
    );
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request<unknown>(
      "POST",
      "/api/v1/private/order/cancel",
      {},
      [Number(orderId)],
      true,
    );
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    await this.request<unknown>(
      "POST",
      "/api/v1/private/order/cancel_all",
      {},
      { symbol },
      true,
    );
  }

  async getOpenPositions(symbol?: string): Promise<FuturesPosition[]> {
    const data = await this.request<FuturesPosition[]>(
      "GET",
      "/api/v1/private/position/open_positions",
      symbol ? { symbol } : {},
      undefined,
      true,
    );

    return data ?? [];
  }

  async setLeverage(
    symbol: string,
    leverage: number,
    openType: 1 | 2,
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      "/api/v1/private/position/change_leverage",
      {},
      { symbol, leverage, openType },
      true,
    );
  }
}
