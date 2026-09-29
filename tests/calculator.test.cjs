const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculate, capacity, InputError } = require("../calculator.js");
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
