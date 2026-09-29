/* Shared by the browser and Node's built-in test runner. No dependencies. */
(function (root) {
  "use strict";
  const MAX_MONEY = 10000000000n * 100n; // 100억 원, represented in hundredths of a won.
  const MAX_QUANTITY = 100000000n;
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

  class InputError extends Error {
    constructor(field, message) {
      super(message);
      this.name = "InputError";
      this.field = field;
    }
  }

  function parse(value, field, isQuantity = false) {
    const raw = String(value ?? "").trim();
    if (!raw) throw new InputError(field, "값을 입력해 주세요.");
    // Reject malformed grouping, negatives, scientific notation and hidden precision.
    const pattern = isQuantity
      ? /^(?:\d+|\d{1,3}(?:,\d{3})+)$/
      : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
    if (raw.length > 30 || !pattern.test(raw)) {
      throw new InputError(
        field,
        isQuantity
          ? "0 이상의 정수 수량을 입력해 주세요."
          : "0 이상의 금액을 소수 둘째 자리까지 입력해 주세요.",
      );
    }
    const [whole, decimal = ""] = raw.replaceAll(",", "").split(".");
    const result = isQuantity
      ? BigInt(whole)
      : BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
    if (result > (isQuantity ? MAX_QUANTITY : MAX_MONEY)) {
      throw new InputError(
        field,
        isQuantity
          ? "수량은 1억 주 이하로 입력해 주세요."
          : "금액은 100억 원 이하로 입력해 주세요.",
      );
    }
    return result;
  }

  function capacity(budget, price, priceField = "buyPrice") {
    const funds = parse(budget, "budget");
    const unitPrice = parse(price, priceField);
    if (unitPrice === 0n)
      throw new InputError(priceField, "단가는 0원보다 커야 해요.");
    return funds / unitPrice;
  }

  function calculate(input) {
    const heldQuantity = parse(input.heldQuantity, "heldQuantity", true);
    const heldPrice = parse(input.heldPrice, "heldPrice");
    const budget = parse(input.budget, "budget");
    const marketPrice = parse(input.marketPrice, "marketPrice");
    const buyPrice = input.useMarketPrice
      ? marketPrice
      : parse(input.buyPrice, "buyPrice");
    if (heldQuantity > 0n && heldPrice === 0n)
      throw new InputError(
        "heldPrice",
        "보유 주식의 매입단가는 0원보다 커야 해요.",
      );
    if (marketPrice === 0n)
      throw new InputError("marketPrice", "현재가는 0원보다 커야 해요.");
    if (buyPrice === 0n)
      throw new InputError("buyPrice", "매수 단가는 0원보다 커야 해요.");
    const maxBuyQuantity = budget / buyPrice;
    const buyQuantity = input.useMaxQuantity
      ? maxBuyQuantity
      : parse(input.buyQuantity, "buyQuantity", true);
    if (buyQuantity > MAX_QUANTITY)
      throw new InputError(
        "buyQuantity",
        "계산 가능한 추가 매수 수량은 1억 주 이하예요.",
      );
    const heldCost = heldQuantity * heldPrice;
    const purchaseCost = buyQuantity * buyPrice;
    const totalCost = heldCost + purchaseCost;
    const totalQuantity = heldQuantity + buyQuantity;
    const beforeValue = heldQuantity * marketPrice;
    const afterValue = totalQuantity * marketPrice;
    if (
      [totalCost, beforeValue, afterValue].some((value) => value > MAX_SAFE)
    ) {
      throw new InputError(
        "heldQuantity",
        "총 금액이 계산 범위를 초과했어요. 수량이나 단가를 줄여 주세요.",
      );
    }
    const money = (value) => Number(value) / 100;
    const beforePnl = beforeValue - heldCost;
    const afterPnl = afterValue - totalCost;
    const average =
      totalQuantity > 0n ? money(totalCost) / Number(totalQuantity) : null;
    const averageChange =
      heldQuantity > 0n && average !== null ? average - money(heldPrice) : null;
    return {
      heldQuantity: Number(heldQuantity),
      heldPrice: money(heldPrice),
      budget: money(budget),
      marketPrice: money(marketPrice),
      buyPrice: money(buyPrice),
      buyQuantity: Number(buyQuantity),
      currentPriceCapacity: Number(budget / marketPrice),
      maxBuyQuantity: Number(maxBuyQuantity),
      heldCost: money(heldCost),
      purchaseCost: money(purchaseCost),
      totalCost: money(totalCost),
      totalQuantity: Number(totalQuantity),
      remainingBudget: money(budget - purchaseCost),
      overBudget: purchaseCost > budget,
      average,
      averageChange,
      averageChangePercent:
        averageChange === null
          ? null
          : (averageChange / money(heldPrice)) * 100,
      budgetUsage:
        budget > 0n
          ? (Number(purchaseCost) / Number(budget)) * 100
          : purchaseCost > 0n
            ? null
            : 0,
      beforePnl: money(beforePnl),
      afterPnl: money(afterPnl),
      beforeReturn:
        heldCost > 0n ? (Number(beforePnl) / Number(heldCost)) * 100 : null,
      afterReturn:
        totalCost > 0n ? (Number(afterPnl) / Number(totalCost)) * 100 : null,
    };
  }
  const api = Object.freeze({ calculate, capacity, parse, InputError });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StockCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
