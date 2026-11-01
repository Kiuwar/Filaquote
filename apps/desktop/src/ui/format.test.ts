import { describe, expect, it } from "vitest";
import { dateBR, duration, money, percent } from "./format";

describe("formatação", () => {
  it("dinheiro e percentual em pt-BR, sem zero negativo", () => {
    expect(money(1234.5)).toBe("R$ 1.234,50");
    expect(money(-0.004)).toBe("R$ 0,00");
    expect(percent(-0.01)).toBe("0%");
    expect(percent(37.325)).toBe("37,3%");
    expect(money(null)).toBe("—");
  });

  it("duração e data", () => {
    expect(duration(4.5)).toBe("4 h 30 min");
    expect(duration(0.25)).toBe("15 min");
    expect(duration(2)).toBe("2 h");
    expect(dateBR("2026-11-01 10:00:00")).toBe("01/11/2026");
  });
});
