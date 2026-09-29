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

test("키움 KRX 매수 예산: 48주 유지, 수수료 90원은 손익에서 차감", () => {
  const r = calc({ feeRate: "0.015" });
  assert.equal(r.budgetMode, "principal");
  assert.equal(r.buyQuantity, 48);
  assert.equal(r.currentPriceCapacity, 48);
  assert.equal(r.purchaseCost, 600000);
  assert.equal(r.purchaseFee, 90);
  assert.equal(r.purchaseTotal, 600090);
  assert.equal(r.remainingBudget, 0);
  assert.equal(r.overBudget, false);
  assert.equal(r.budgetUsage, 100);
  near(r.average, 2400000 / 148);
  near(r.costAverage, 2400090 / 148);
  assert.equal(r.afterPnl, -550090);
  near(r.afterReturn, (-550090 / 2400000) * 100);
});
test("수수료 포함 현금 한도를 명시적으로 선택하면 47주", () => {
  const r = calc({ feeRate: "0.015", budgetMode: "cash" });
  assert.equal(r.buyQuantity, 47);
  assert.equal(r.purchaseCost, 587500);
  assert.equal(r.purchaseFee, 89);
  assert.equal(r.purchaseTotal, 587589);
  assert.equal(r.remainingBudget, 12411);
  assert.equal(r.totalCost, 2387589);
  near(r.average, 2387500 / 147);
  near(r.costAverage, 2387589 / 147);
  assert.equal(r.beforePnl, -550000);
  assert.equal(r.afterPnl, -550089);
  assert.equal(r.currentPriceCapacity, 47);
});
test("직접 48주 입력: 매수 예산은 초과하지 않고 현금 한도만 초과", () => {
  const r = calc({
    feeRate: "0.015",
    useMaxQuantity: false,
    buyQuantity: "48",
  });
  assert.equal(r.overBudget, false);
  assert.equal(r.purchaseFee, 90);
  assert.equal(r.remainingBudget, 0);
  const cash = calc({
    feeRate: "0.015",
    budgetMode: "cash",
    useMaxQuantity: false,
    buyQuantity: "48",
  });
  assert.equal(cash.overBudget, true);
  assert.equal(cash.remainingBudget, -90);
  const over = calc({
    feeRate: "0.015",
    useMaxQuantity: false,
    buyQuantity: "49",
  });
  assert.equal(over.overBudget, true);
  assert.equal(over.remainingBudget, -12500);
});
test("수수료를 포함한 정확한 예산 경계", () => {
  const fees = { feeRate: "0.015", budgetMode: "cash" };
  assert.equal(capacity("600090", "12500", "buyPrice", fees), 48n);
  assert.equal(capacity("600089.99", "12500", "buyPrice", fees), 47n);
  assert.equal(
    capacity("1000.01", "1000", "buyPrice", {
      feeRate: "0.001",
      feeRounding: "ceil-cent",
      budgetMode: "cash",
    }),
    1n,
  );
});
test("최소 수수료, 정액 수수료와 거래 0주의 처리", () => {
  const fees = {
    feeRate: "0",
    minimumFee: "1",
    fixedFee: "0",
    budgetMode: "cash",
  };
  assert.equal(capacity("1000", "1000", "buyPrice", fees), 0n);
  assert.equal(capacity("1001", "1000", "buyPrice", fees), 1n);
  assert.equal(calc({ ...fees, budget: "0" }).purchaseFee, 0);
  const fixed = calc({
    feeRate: "0.1",
    fixedFee: "1000",
    minimumFee: "2000",
    useMaxQuantity: false,
    buyQuantity: "1",
  });
  assert.equal(fixed.purchaseFee, 2000);
  assert.equal(fixed.purchaseTotal, 14500);
  const principal = calc({
    ...fees,
    budgetMode: "principal",
    budget: "12500",
    fixedFee: "20000",
  });
  assert.equal(principal.buyQuantity, 1);
  assert.equal(principal.remainingBudget, 0);
  assert.equal(principal.purchaseFee, 20000);
  assert.equal(principal.overBudget, false);
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
test("수수료율 소수 일곱 자리 보존 및 잘못된 설정 거부", () => {
  assert.equal(
    calc({ feeRate: "0.0136396", useMaxQuantity: false, buyQuantity: "80" })
      .purchaseFee,
    137,
  );
  for (const feeRate of [
    "",
    "-0.1",
    "1e-3",
    "100.0000001",
    "0.00000001",
    "NaN",
  ]) {
    assert.throws(() => calc({ feeRate }), InputError);
  }
  for (const field of ["minimumFee", "fixedFee"])
    assert.throws(() => calc({ [field]: "-1" }), InputError);
  assert.throws(() => calc({ feeRounding: "invalid" }), InputError);
  assert.throws(() => calc({ budgetMode: "invalid" }), InputError);
  assert.throws(
    () => capacity("600000", "12500", "buyPrice", { budgetMode: "invalid" }),
    InputError,
  );
});
test("주문 계획 수량은 수수료 선택 전에도 계산 가능", () => {
  assert.equal(
    capacity("600000", "12500", "buyPrice", {
      feeRate: "",
      minimumFee: "",
      fixedFee: "",
    }),
    48n,
  );
});
test("처음 매수 후 현재가가 그대로여도 수수료만큼 음수 손익", () => {
  const r = calc({ heldQuantity: "0", heldPrice: "0", feeRate: "0.015" });
  assert.equal(r.average, 12500);
  assert.equal(r.afterPnl, -90);
  assert.equal(r.afterReturn, -0.015);
});
test("모든 증권사·거래소 참고 요율에서 예산 불변식 및 최대 수량", () => {
  for (const preset of presets.filter((item) => item.rate !== "")) {
    const feeInput = {
      feeRate: preset.rate,
      minimumFee: preset.minimum,
      fixedFee: preset.fixed,
      feeRounding: preset.rounding,
    };
    for (const budgetMode of ["principal", "cash"]) {
      for (const budget of ["0", "1000", "600000", "1234567.89"]) {
        const r = calc({ ...feeInput, budget, budgetMode });
        assert.ok(r.remainingBudget >= 0);
        near(r.budgetSpend + r.remainingBudget, r.budget);
        if (budgetMode === "principal") {
          assert.equal(
            r.buyQuantity,
            Math.floor(Number(budget) / Number(base.marketPrice)),
          );
        }
        const next = calc({
          ...feeInput,
          budget,
          budgetMode,
          useMaxQuantity: false,
          buyQuantity: String(r.buyQuantity + 1),
        });
        assert.equal(next.overBudget, true, preset.id);
      }
    }
  }
});
