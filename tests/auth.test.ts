import { describe, expect, it } from "vitest";
import {
  buildGetParameterString,
  signFuturesRequest,
} from "../src/api/mexc/auth.js";

describe("futures auth", () => {
  it("builds sorted GET parameter string", () => {
    const result = buildGetParameterString({
      symbol: "BTC_USDT",
      page_num: 1,
      page_size: 20,
    });
    expect(result).toBe("page_num=1&page_size=20&symbol=BTC_USDT");
  });

  it("produces deterministic HMAC signature", () => {
    const sig = signFuturesRequest(
      "secret",
      "accessKey",
      "1234567890",
      "symbol=BTC_USDT",
    );
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(
      signFuturesRequest("secret", "accessKey", "1234567890", "symbol=BTC_USDT"),
    ).toBe(sig);
  });

  it("handles empty parameter string", () => {
    const sig = signFuturesRequest("secret", "accessKey", "1234567890", "");
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});
