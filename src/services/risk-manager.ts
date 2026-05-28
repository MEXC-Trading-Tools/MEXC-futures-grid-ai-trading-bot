import type { GridLevel } from "../strategies/grid/grid-config.js";
import { multiply } from "../utils/decimal.js";

export interface RiskLimits {
  maxMarginExposure?: number;
  orderSize: number;
  leverage: number;
  contractSize?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  maxFundingRate?: number;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export type PriceTriggerAction = "stop_loss" | "take_profit" | null;

export class RiskManager {
  private marginExposure = 0;

  constructor(private readonly limits: RiskLimits) {}

  resetExposure(): void {
    this.marginExposure = 0;
  }

  private calcMargin(price: number, size: number): number {
    const contractSize = this.limits.contractSize ?? 1;
    const notional = multiply(multiply(price, size), contractSize);
    return notional / this.limits.leverage;
  }

  recordOpenPosition(price: number, size: number): void {
    this.marginExposure += this.calcMargin(price, size);
  }

  recordClosePosition(price: number, size: number): void {
    this.marginExposure = Math.max(0, this.marginExposure - this.calcMargin(price, size));
  }

  canPlaceOrder(price: number, size: number): RiskCheckResult {
    const margin = this.calcMargin(price, size);

    if (this.limits.maxMarginExposure !== undefined) {
      const projected = this.marginExposure + margin;
      if (projected > this.limits.maxMarginExposure) {
        return {
          allowed: false,
          reason: `Would exceed max margin exposure (${this.limits.maxMarginExposure} USDT)`,
        };
      }
    }

    if (size > this.limits.orderSize * 3) {
      return {
        allowed: false,
        reason: `Order size ${size} exceeds safe limit`,
      };
    }

    return { allowed: true };
  }

  checkPriceTriggers(lastPrice: number): PriceTriggerAction {
    if (
      this.limits.stopLossPrice !== undefined &&
      lastPrice <= this.limits.stopLossPrice
    ) {
      return "stop_loss";
    }

    if (
      this.limits.takeProfitPrice !== undefined &&
      lastPrice >= this.limits.takeProfitPrice
    ) {
      return "take_profit";
    }

    return null;
  }

  checkFundingRate(fundingRate: number): RiskCheckResult {
    if (this.limits.maxFundingRate === undefined) {
      return { allowed: true };
    }

    if (Math.abs(fundingRate) > this.limits.maxFundingRate) {
      return {
        allowed: false,
        reason: `Funding rate ${fundingRate} exceeds max ${this.limits.maxFundingRate}`,
      };
    }

    return { allowed: true };
  }

  validateGridConfig(levels: GridLevel[]): RiskCheckResult {
    if (levels.length < 2) {
      return { allowed: false, reason: "Grid must have at least 2 levels" };
    }

    for (let i = 1; i < levels.length; i++) {
      if (levels[i]!.price <= levels[i - 1]!.price) {
        return {
          allowed: false,
          reason: `Grid levels must be strictly increasing at index ${i}`,
        };
      }
    }

    return { allowed: true };
  }

  getMarginExposure(): number {
    return this.marginExposure;
  }

  setContractSize(contractSize: number): void {
    this.limits.contractSize = contractSize;
  }
}
