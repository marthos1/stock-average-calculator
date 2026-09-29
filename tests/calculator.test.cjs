const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculate, capacity, InputError } = require("../calculator.js");
const presets = require("../brokers.js");
const base = {
  heldQuantity: "100",
  heldPrice: "18000",
  budget: "600000",
  marketPrice: "12500",
  buyPrice: "12500",
  buyQuantity: "48",
  useMarketPrice: true,
  useMaxQuantity: true,
};
const calc = (overrides = {}) => calculate({ ...base, ...overrides });
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test("60만 원 예산: 48주, 총 148주, 평균단가 및 평가손익", () => {
  const r = calc();
  assert.equal(r.buyQuantity, 48);
  assert.equal(r.purchaseCost, 600000);
  assert.equal(r.remainingBudget, 0);
  assert.equal(r.totalQuantity, 148);
  assert.equal(r.totalCost, 2400000);
  near(r.average, 16216.216216216217);
  assert.equal(r.beforePnl, -550000);
  assert.equal(r.afterPnl, -550000);
  near(r.afterReturn, -22.9166666667);
});
test("정수 주식 수량을 내림하고 잔여 예산을 정확히 보존", () => {
  const r = calc({ marketPrice: "13000" });
  assert.equal(r.buyQuantity, 46);
  assert.equal(r.remainingBudget, 2000);
  assert.equal(r.purchaseCost + r.remainingBudget, r.budget);
});
test("소수 단가의 경계값에서 부동소수점 때문에 1주를 잃지 않음", () => {
  assert.equal(capacity("0.30", "0.10"), 3n);
  const r = calc({ budget: "1.15", marketPrice: "0.05" });
  assert.equal(r.buyQuantity, 23);
  assert.equal(r.remainingBudget, 0);
});
test("별도 매수 단가로 자동 수량 계산; 현재가 기준 수량과 구분", () => {
  const r = calc({ useMarketPrice: false, buyPrice: "10000" });
  assert.equal(r.buyQuantity, 60);
  assert.equal(r.currentPriceCapacity, 48);
  assert.equal(r.buyPrice, 10000);
  assert.equal(r.afterPnl, -400000);
});
test("직접 매수 수량으로 미리 계산; 초과 예산을 숨기지 않음", () => {
  const r = calc({ useMaxQuantity: false, buyQuantity: "50" });
  assert.equal(r.overBudget, true);
  assert.equal(r.remainingBudget, -25000);
  assert.equal(r.buyQuantity, 50);
  assert.equal(r.maxBuyQuantity, 48);
});
test("일부만 매수할 때 남은 예산", () => {
  const r = calc({ useMaxQuantity: false, buyQuantity: "10" });
  assert.equal(r.remainingBudget, 475000);
  assert.equal(r.totalQuantity, 110);
});
test("예산 0원, 1주 미만 예산, 직접 매수 0주", () => {
  for (const budget of ["0", "12499.99"]) {
    const r = calc({ budget });
    assert.equal(r.buyQuantity, 0);
    assert.equal(r.average, 18000);
  }
  assert.equal(
    calc({ useMaxQuantity: false, buyQuantity: "0" }).average,
    18000,
  );
  const r = calc({ budget: "0", useMaxQuantity: false, buyQuantity: "1" });
  assert.equal(r.overBudget, true);
  assert.equal(r.budgetUsage, null);
});
test("보유 주식이 없는 첫 매수와 전부 0주인 경우", () => {
  const r = calc({ heldQuantity: "0", heldPrice: "0" });
  assert.equal(r.average, 12500);
  assert.equal(r.averageChange, null);
  assert.equal(r.beforeReturn, null);
  const empty = calc({ heldQuantity: "0", heldPrice: "0", budget: "0" });
  assert.equal(empty.average, null);
  assert.equal(empty.afterReturn, null);
});
test("높은 단가의 추가 매수는 평균단가 상승", () => {
  const r = calc({ marketPrice: "20000" });
  assert.ok(r.averageChange > 0);
});
test("금액 쉼표 및 소수 둘째 자리 지원", () => {
  assert.equal(
    calc({ heldPrice: "18,000.25", budget: "600,000" }).heldCost,
    1800025,
  );
});
test("음수, 빈 값, 비정수 수량, 잘못된 문자와 단가 0원 거부", () => {
  for (const value of [
    "",
    "-1",
    "1e5",
    "Infinity",
    "NaN",
    "1,2",
    "123.456",
    "<script>",
  ]) {
    assert.throws(() => calc({ budget: value }), InputError);
  }
  assert.throws(() => calc({ heldQuantity: "1.5" }), InputError);
  for (const field of ["marketPrice", "heldPrice"])
    assert.throws(() => calc({ [field]: "0" }), InputError);
  assert.throws(
    () => calc({ useMarketPrice: false, buyPrice: "0" }),
    InputError,
  );
});
test("지원 한도 초과 및 안전 정수 범위 초과 거부", () => {
  assert.throws(() => calc({ heldQuantity: "100000001" }), InputError);
  assert.throws(() => calc({ budget: "10000000001" }), InputError);
  assert.throws(
    () => calc({ budget: "10000000000", marketPrice: "0.01" }),
    InputError,
  );
  assert.throws(
    () => calc({ heldQuantity: "100000000", heldPrice: "10000000000" }),
    InputError,
  );
});
test("여러 예산과 단가에서 최대 수량과 잔액의 불변식", () => {
  for (const budget of ["1", "9.99", "100", "600000"]) {
    for (const price of ["0.03", "1", "101", "12500"]) {
      const r = calc({ budget, marketPrice: price });
      assert.ok(r.remainingBudget >= 0);
      assert.ok(r.remainingBudget < Number(price));
      near(r.purchaseCost + r.remainingBudget, r.budget);
    }
  }
});

test("키움 요율과 국내주식 세금: 48주 유지, 매수 전후 모든 비용 반영", () => {
  const r = calc({ feeRate: "0.015", sellTaxRate: "0.2" });
  assert.equal(r.buyQuantity, 48);
  assert.equal(r.currentPriceCapacity, 48);
  assert.equal(r.purchaseCost, 600000);
  assert.equal(r.purchaseFee, 90);
  assert.equal(r.purchaseTotal, 600090);
  assert.equal(r.remainingBudget, 0);
  assert.equal(r.overBudget, false);
  assert.equal(r.heldBuyFee, 270);
  assert.equal(r.totalBuyFees, 360);
  assert.equal(r.beforeSellFee, 188);
  assert.equal(r.afterSellFee, 278);
  assert.equal(r.beforeTax, 2500);
  assert.equal(r.afterTax, 3700);
  assert.equal(r.beforePnl, -552958);
  assert.equal(r.afterPnl, -554338);
  near(r.beforeReturn, -30.7198888889);
  near(r.afterReturn, -23.0974166667);
  near(r.average, 2400000 / 148);
  near(r.costAverage, 2400360 / 148);
});
test("처음 매수 후 가격 불변: 매수·매도 수수료와 세금만큼 손실", () => {
  const r = calc({
    heldQuantity: "0",
    heldPrice: "0",
    feeRate: "0.015",
    sellTaxRate: "0.2",
  });
  assert.equal(r.average, 12500);
  assert.equal(r.heldBuyFee, 0);
  assert.equal(r.beforeReturn, null);
  assert.equal(r.afterPnl, -1380);
  near(r.afterReturn, -0.23);
});
test("ETF·ETN 거래세 0%는 거래세만 제외하고 매수·매도 수수료 유지", () => {
  const r = calc({
    heldQuantity: "0",
    heldPrice: "0",
    feeRate: "0.015",
    sellTaxRate: "0",
  });
  assert.equal(r.afterTax, 0);
  assert.equal(r.afterPnl, -180);
  near(r.afterReturn, -0.03);
});
test("기존 실제 매수 수수료를 입력하면 추정 비용 대신 한 번만 반영", () => {
  const r = calc({
    feeRate: "0.015",
    sellFeeRate: "0.01",
    sellTaxRate: "0.2",
    heldBuyFee: "123",
  });
  assert.equal(r.heldBuyFee, 123);
  assert.equal(r.totalBuyFees, 213);
  assert.equal(r.beforeSellFee, 125);
  assert.equal(r.afterSellFee, 185);
  assert.equal(r.beforePnl, -552748);
  assert.equal(r.afterPnl, -554098);
  assert.equal(calc({ feeRate: "0.015", heldBuyFee: "0" }).heldBuyFee, 0);
});
test("0주 추가 매수 시 전후 손익·수익률 동일, 0주 보유 시 비용 없음", () => {
  const r = calc({
    feeRate: "0.015",
    sellTaxRate: "0.2",
    useMaxQuantity: false,
    buyQuantity: "0",
  });
  assert.equal(r.beforePnl, r.afterPnl);
  assert.equal(r.beforeReturn, r.afterReturn);
  assert.equal(r.purchaseFee, 0);
  const empty = calc({
    heldQuantity: "0",
    heldPrice: "0",
    budget: "0",
    feeRate: "0.015",
    minimumFee: "1",
    fixedFee: "1000",
    sellTaxRate: "0.2",
  });
  assert.equal(empty.beforePnl, 0);
  assert.equal(empty.afterPnl, 0);
  assert.equal(empty.afterReturn, null);
});
test("양수 수익도 비용을 차감한 뒤 원금으로 나누며 시장가 평가를 유지", () => {
  const r = calc({
    heldQuantity: "10",
    heldPrice: "100",
    budget: "1000",
    marketPrice: "120",
    useMarketPrice: false,
    buyPrice: "100",
    feeRate: "1",
    sellFeeRate: "1",
    sellTaxRate: "1",
  });
  assert.equal(r.beforeValue, 1200);
  assert.equal(r.afterValue, 2400);
  assert.equal(r.beforePnl, 166);
  assert.equal(r.afterPnl, 332);
  near(r.beforeReturn, 16.6);
  near(r.afterReturn, 16.6);
});
test("거래 비용이 양수 가격 차익보다 크면 수익률도 음수", () => {
  const r = calc({
    heldQuantity: "100",
    heldPrice: "1000",
    budget: "0",
    marketPrice: "1001",
    feeRate: "0.015",
    sellTaxRate: "0.2",
  });
  assert.equal(r.beforePnl, -132);
  assert.equal(r.afterPnl, -132);
  near(r.afterReturn, -0.132);
});
test("직접 수량: 수수료는 예산 초과를 유발하지 않으며 원금 초과만 표시", () => {
  const r = calc({
    feeRate: "0.015",
    sellTaxRate: "0.2",
    useMaxQuantity: false,
    buyQuantity: "48",
  });
  assert.equal(r.overBudget, false);
  assert.equal(r.remainingBudget, 0);
  const over = calc({
    feeRate: "0.015",
    useMaxQuantity: false,
    buyQuantity: "49",
  });
  assert.equal(over.overBudget, true);
  assert.equal(over.remainingBudget, -12500);
});
test("최소·정액 수수료가 커도 매수 예산으로 계산한 수량 유지", () => {
  assert.equal(capacity("1000", "1000"), 1n);
  const r = calc({
    feeRate: "0",
    minimumFee: "1",
    fixedFee: "20000",
    budget: "12500",
  });
  assert.equal(r.buyQuantity, 1);
  assert.equal(r.remainingBudget, 0);
  assert.equal(r.purchaseFee, 20000);
  assert.equal(r.overBudget, false);
  assert.equal(
    calc({ feeRate: "0", minimumFee: "1", budget: "0" }).purchaseFee,
    0,
  );
});
test("원·10원 절사 및 소수 둘째 자리 올림", () => {
  const input = { feeRate: "0.015", useMaxQuantity: false, buyQuantity: "47" };
  assert.equal(calc({ ...input, feeRounding: "ceil-won" }).purchaseFee, 89);
  assert.equal(calc({ ...input, feeRounding: "floor-won" }).purchaseFee, 88);
  assert.equal(
    calc({ ...input, feeRounding: "floor-ten-won" }).purchaseFee,
    80,
  );
  assert.equal(calc({ ...input, feeRounding: "ceil-cent" }).purchaseFee, 88.13);
});
test("매수·매도·세율의 소수 일곱 자리 보존 및 입력 오류 위치", () => {
  assert.equal(
    calc({ feeRate: "0.0136396", useMaxQuantity: false, buyQuantity: "80" })
      .purchaseFee,
    137,
  );
  for (const field of ["feeRate", "sellFeeRate", "sellTaxRate"]) {
    for (const value of [
      "",
      "-0.1",
      "1e-3",
      "100.0000001",
      "0.00000001",
      "NaN",
    ]) {
      assert.throws(
        () => calc({ [field]: value }),
        (error) => error instanceof InputError && error.field === field,
      );
    }
  }
  for (const field of ["minimumFee", "fixedFee", "heldBuyFee"])
    assert.throws(() => calc({ [field]: "-1" }), InputError);
  assert.throws(() => calc({ feeRounding: "invalid" }), InputError);
});
test("여러 증권사·가격·예산에서 수량 및 비용 차감 결과 검증", () => {
  for (const preset of presets.filter((item) => item.rate !== "")) {
    for (const budget of ["0", "1000", "600000", "1234567.89"]) {
      const input = {
        feeRate: preset.rate,
        minimumFee: preset.minimum,
        fixedFee: preset.fixed,
        feeRounding: preset.rounding,
        sellTaxRate: "0.2",
        budget,
      };
      const r = calc(input);
      assert.ok(r.remainingBudget >= 0);
      near(r.purchaseCost + r.remainingBudget, r.budget);
      assert.equal(
        r.buyQuantity,
        Math.floor(Number(budget) / Number(base.marketPrice)),
      );
      near(
        r.beforeValue -
          r.heldCost -
          r.heldBuyFee -
          r.beforeSellFee -
          r.beforeTax,
        r.beforePnl,
      );
      near(
        r.afterValue -
          r.totalPrincipal -
          r.totalBuyFees -
          r.afterSellFee -
          r.afterTax,
        r.afterPnl,
      );
      assert.equal(
        calc({
          ...input,
          useMaxQuantity: false,
          buyQuantity: String(r.buyQuantity + 1),
        }).overBudget,
        true,
      );
    }
  }
});
