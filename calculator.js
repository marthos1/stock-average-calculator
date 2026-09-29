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

  // Percentage precision: seven decimal places (e.g. 0.0036396%).
  const RATE_SCALE = 1000000000n;
  function parseRate(value) {
    const raw = String(value ?? "").trim();
    if (!raw) throw new InputError("feeRate", "매수 수수료율을 입력해 주세요.");
    if (raw.length > 20 || !/^\d+(?:\.\d{1,7})?$/.test(raw)) {
      throw new InputError(
        "feeRate",
        "수수료율은 소수 일곱째 자리까지 입력해 주세요.",
      );
    }
    const [whole, decimal = ""] = raw.split(".");
    const rate = BigInt(whole) * 10000000n + BigInt(decimal.padEnd(7, "0"));
    if (rate > RATE_SCALE)
      throw new InputError(
        "feeRate",
        "수수료율은 0~100% 사이로 입력해 주세요.",
      );
    return rate;
  }

  function feeSettings(input = {}) {
    const rounding = input.feeRounding ?? "ceil-won";
    if (
      !["ceil-won", "floor-won", "floor-ten-won", "ceil-cent"].includes(
        rounding,
      )
    ) {
      throw new InputError("feeRate", "수수료 계산 단위를 선택해 주세요.");
    }
    return {
      rate: parseRate(input.feeRate ?? "0"),
      minimum: parse(input.minimumFee ?? "0", "minimumFee"),
      fixed: parse(input.fixedFee ?? "0", "fixedFee"),
      rounding,
    };
  }

  function feeForCost(cost, fees) {
    if (cost === 0n) return 0n;
    const unit =
      fees.rounding === "ceil-cent"
        ? 1n
        : fees.rounding === "floor-ten-won"
          ? 1000n
          : 100n;
    const numerator = cost * fees.rate + fees.fixed * RATE_SCALE;
    const denominator = RATE_SCALE * unit;
    const rounded =
      (fees.rounding.startsWith("ceil")
        ? (numerator + denominator - 1n) / denominator
        : numerator / denominator) * unit;
    return rounded < fees.minimum ? fees.minimum : rounded;
  }

  function budgetMode(input) {
    const mode = input.budgetMode ?? "principal";
    if (!["principal", "cash"].includes(mode))
      throw new InputError("budget", "예산 기준을 선택해 주세요.");
    return mode;
  }

  // A purchase plan uses principal. Only an explicit cash limit reserves fees.
  function affordableQuantity(funds, unitPrice, fees, mode) {
    if (mode === "principal") return funds / unitPrice;
    let low = 0n;
    let high = funds / unitPrice;
    while (low < high) {
      const middle = (low + high + 1n) / 2n;
      const principal = middle * unitPrice;
      if (principal + feeForCost(principal, fees) <= funds) low = middle;
      else high = middle - 1n;
    }
    return low;
  }

  function capacity(budget, price, priceField = "buyPrice", feeInput = {}) {
    const funds = parse(budget, "budget");
    const unitPrice = parse(price, priceField);
    if (unitPrice === 0n)
      throw new InputError(priceField, "단가는 0원보다 커야 해요.");
    const mode = budgetMode(feeInput);
    return affordableQuantity(
      funds,
      unitPrice,
      mode === "cash" ? feeSettings(feeInput) : null,
      mode,
    );
  }

  function calculate(input) {
    const heldQuantity = parse(input.heldQuantity, "heldQuantity", true);
    const heldPrice = parse(input.heldPrice, "heldPrice");
    const budget = parse(input.budget, "budget");
    const marketPrice = parse(input.marketPrice, "marketPrice");
    const buyPrice = input.useMarketPrice
      ? marketPrice
      : parse(input.buyPrice, "buyPrice");
    const fees = feeSettings(input);
    const mode = budgetMode(input);
    if (heldQuantity > 0n && heldPrice === 0n)
      throw new InputError(
        "heldPrice",
        "보유 주식의 매입단가는 0원보다 커야 해요.",
      );
    if (marketPrice === 0n)
      throw new InputError("marketPrice", "현재가는 0원보다 커야 해요.");
    if (buyPrice === 0n)
      throw new InputError("buyPrice", "매수 단가는 0원보다 커야 해요.");
    const maxBuyQuantity = affordableQuantity(budget, buyPrice, fees, mode);
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
    const purchaseFee = feeForCost(purchaseCost, fees);
    const purchaseTotal = purchaseCost + purchaseFee;
    const budgetSpend = mode === "cash" ? purchaseTotal : purchaseCost;
    const totalPrincipal = heldCost + purchaseCost;
    const totalCost = heldCost + purchaseTotal;
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
      totalQuantity > 0n ? money(totalPrincipal) / Number(totalQuantity) : null;
    const averageChange =
      heldQuantity > 0n && average !== null ? average - money(heldPrice) : null;
    return {
      heldQuantity: Number(heldQuantity),
      heldPrice: money(heldPrice),
      budget: money(budget),
      budgetMode: mode,
      budgetSpend: money(budgetSpend),
      marketPrice: money(marketPrice),
      buyPrice: money(buyPrice),
      buyQuantity: Number(buyQuantity),
      currentPriceCapacity: Number(
        affordableQuantity(budget, marketPrice, fees, mode),
      ),
      maxBuyQuantity: Number(maxBuyQuantity),
      heldCost: money(heldCost),
      purchaseCost: money(purchaseCost),
      purchaseFee: money(purchaseFee),
      purchaseTotal: money(purchaseTotal),
      feeRate: Number(fees.rate) / 10000000,
      costAverage:
        totalQuantity > 0n ? money(totalCost) / Number(totalQuantity) : null,
      totalPrincipal: money(totalPrincipal),
      totalCost: money(totalCost),
      totalQuantity: Number(totalQuantity),
      remainingBudget: money(budget - budgetSpend),
      overBudget: budgetSpend > budget,
      average,
      averageChange,
      averageChangePercent:
        averageChange === null
          ? null
          : (averageChange / money(heldPrice)) * 100,
      budgetUsage:
        budget > 0n
          ? (Number(budgetSpend) / Number(budget)) * 100
          : budgetSpend > 0n
            ? null
            : 0,
      beforePnl: money(beforePnl),
      afterPnl: money(afterPnl),
      beforeReturn:
        heldCost > 0n ? (Number(beforePnl) / Number(heldCost)) * 100 : null,
      afterReturn:
        totalPrincipal > 0n
          ? (Number(afterPnl) / Number(totalPrincipal)) * 100
          : null,
    };
  }
  const api = Object.freeze({
    calculate,
    capacity,
    parse,
    parseRate,
    InputError,
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StockCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
