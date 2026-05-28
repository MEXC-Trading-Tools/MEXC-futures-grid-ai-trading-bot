import type { FuturesPosition } from "../../api/mexc/types.js";
import type { GridOrderAction } from "../../api/mexc/types.js";

export interface PositionState {
  longVol: number;
  shortVol: number;
  longAvgPrice: number;
  shortAvgPrice: number;
  unrealisedPnl: number;
}

export class PositionTracker {
  private longVol = 0;
  private shortVol = 0;
  private longAvgPrice = 0;
  private shortAvgPrice = 0;
  private unrealisedPnl = 0;

  syncFromExchange(positions: FuturesPosition[]): void {
    this.longVol = 0;
    this.shortVol = 0;
    this.longAvgPrice = 0;
    this.shortAvgPrice = 0;
    this.unrealisedPnl = 0;

    for (const pos of positions) {
      if (pos.positionType === 1) {
        this.longVol += pos.holdVol;
        this.longAvgPrice = pos.holdAvgPrice;
      } else {
        this.shortVol += pos.holdVol;
        this.shortAvgPrice = pos.holdAvgPrice;
      }
      this.unrealisedPnl += pos.unrealisedPnl;
    }
  }

  recordFill(action: GridOrderAction, vol: number, price: number): void {
    switch (action) {
      case "open_long":
        this.longVol += vol;
        this.longAvgPrice = price;
        break;
      case "close_long":
        this.longVol = Math.max(0, this.longVol - vol);
        break;
      case "open_short":
        this.shortVol += vol;
        this.shortAvgPrice = price;
        break;
      case "close_short":
        this.shortVol = Math.max(0, this.shortVol - vol);
        break;
    }
  }

  hasLongPosition(): boolean {
    return this.longVol > 0;
  }

  hasShortPosition(): boolean {
    return this.shortVol > 0;
  }

  canCloseLong(vol: number): boolean {
    return this.longVol >= vol;
  }

  canCloseShort(vol: number): boolean {
    return this.shortVol >= vol;
  }

  getState(): PositionState {
    return {
      longVol: this.longVol,
      shortVol: this.shortVol,
      longAvgPrice: this.longAvgPrice,
      shortAvgPrice: this.shortAvgPrice,
      unrealisedPnl: this.unrealisedPnl,
    };
  }
}
