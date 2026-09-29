(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const form = $("calculator-form");
  const fields = Object.fromEntries(
    [...form.querySelectorAll("input[name]")].map((input) => [
      input.name,
      input,
    ]),
  );
  const number = (value) =>
    value === null
      ? "—"
      : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
          value,
        );
  const won = (value) => (value === null ? "—" : `${number(value)}원`);
  const shares = (value) => `${number(value)}주`;
  const signed = (value, suffix) =>
    value === null
      ? "—"
      : `${value < 0 ? "−" : value > 0 ? "+" : ""}${number(Math.abs(value))}${suffix}`;
  let latestResult = null;
  const resultIds = [
    "new-average",
    "old-average",
    "average-percent",
    "purchase-cost",
    "remaining-budget",
    "budget-percent",
    "before-quantity",
    "after-quantity",
    "before-cost",
    "after-cost",
    "before-pnl",
    "after-pnl",
    "before-return",
    "after-return",
  ];

  function read() {
    return {
      ...Object.fromEntries(
        Object.entries(fields).map(([name, input]) => [name, input.value]),
      ),
      useMarketPrice: $("use-market-price").checked,
      useMaxQuantity: $("use-max-quantity").checked,
    };
  }
  function text(id, value) {
    $(id).textContent = value;
  }
  function notice(message) {
    text("result-notice", message);
    $("result-notice").hidden = !message;
  }
  function color(id, value) {
    $(id).classList.toggle("loss", value < 0);
    $(id).classList.toggle("profit", value > 0);
  }
  function clearErrors() {
    Object.values(fields).forEach((input) => {
      input.removeAttribute("aria-invalid");
      text(`${input.id}-error`, "");
    });
  }
  function invalid(error) {
    latestResult = null;
    resultIds.forEach((id) => text(id, "—"));
    text("average-change", "입력값을 확인하면 결과가 바로 표시돼요.");
    $("average-change").classList.remove("increase");
    text("purchase-description", "");
    text("remaining-label", "남는 예산");
    $("budget-bar").style.width = "0%";
    document.querySelector(".budget-summary").classList.remove("over-budget");
    $("copy-result").disabled = true;
    ["before-pnl", "after-pnl", "before-return", "after-return"].forEach((id) =>
      color(id, 0),
    );
    if (error instanceof StockCalculator.InputError) {
      const input = fields[error.field];
      if (input) {
        input.setAttribute("aria-invalid", "true");
        text(`${input.id}-error`, error.message);
      }
      notice(error.message);
    } else {
      notice("계산을 완료하지 못했어요. 입력값을 다시 확인해 주세요.");
    }
  }

  function update() {
    clearErrors();
    text("copy-status", "");
    const input = read();
    fields.buyPrice.readOnly = input.useMarketPrice;
    fields.buyQuantity.readOnly = input.useMaxQuantity;
    text("auto-badge", input.useMaxQuantity ? "자동" : "직접 입력");
    if (input.useMarketPrice) {
      fields.buyPrice.value = input.marketPrice;
      input.buyPrice = input.marketPrice;
    }
    try {
      const capacity = StockCalculator.capacity(
        input.budget,
        input.marketPrice,
        "marketPrice",
      );
      const callout = $("afford-text");
      callout.replaceChildren(document.createTextNode("현재가로 최대 "));
      const strong = document.createElement("strong");
      strong.textContent = `${capacity.toLocaleString("ko-KR")}주`;
      callout.append(strong, document.createTextNode(" 살 수 있어요."));
    } catch {
      text("afford-text", "예산과 현재가를 입력하면 매수 가능 수량이 나와요.");
    }
    if (input.useMaxQuantity) {
      try {
        fields.buyQuantity.value = StockCalculator.capacity(
          input.budget,
          input.buyPrice,
        ).toLocaleString("ko-KR");
      } catch {
        fields.buyQuantity.value = "";
      }
    }
    document.querySelectorAll("[data-budget]").forEach((button) => {
      const active =
        input.budget.replaceAll(",", "") !== "" &&
        Number(input.budget.replaceAll(",", "")) ===
          Number(button.dataset.budget);
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    try {
      const result = StockCalculator.calculate(input);
      latestResult = result;
      $("copy-result").disabled = false;
      text("new-average", number(result.average));
      text(
        "old-average",
        result.heldQuantity ? won(result.heldPrice) : "보유 없음",
      );
      text("average-percent", signed(result.averageChangePercent, "%"));
      $("average-change").classList.toggle(
        "increase",
        result.averageChange > 0,
      );
      if (result.average === null)
        text("average-change", "보유 또는 추가 매수 수량을 입력해 주세요.");
      else if (result.averageChange === null)
        text("average-change", "첫 매수의 예상 평균단가예요.");
      else if (Math.abs(result.averageChange) < 0.005)
        text("average-change", "기존 평균단가와 같아요. (소수 둘째 자리 기준)");
      else
        text(
          "average-change",
          `기존보다 ${won(Math.abs(result.averageChange))} ${result.averageChange < 0 ? "낮아져요" : "높아져요"}`,
        );
      text("purchase-cost", won(result.purchaseCost));
      text("remaining-label", result.overBudget ? "초과한 예산" : "남는 예산");
      text("remaining-budget", won(Math.abs(result.remainingBudget)));
      text(
        "budget-percent",
        result.budgetUsage === null
          ? "예산 없음"
          : `${number(result.budgetUsage)}%`,
      );
      $("budget-bar").style.width =
        `${result.budgetUsage === null ? 100 : Math.min(100, result.budgetUsage)}%`;
      document
        .querySelector(".budget-summary")
        .classList.toggle("over-budget", result.overBudget);
      text(
        "purchase-description",
        `${won(result.buyPrice)} × ${shares(result.buyQuantity)}`,
      );
      text("before-quantity", shares(result.heldQuantity));
      text("after-quantity", shares(result.totalQuantity));
      text("before-cost", won(result.heldCost));
      text("after-cost", won(result.totalCost));
      text("before-pnl", signed(result.beforePnl, "원"));
      text("after-pnl", signed(result.afterPnl, "원"));
      text("before-return", signed(result.beforeReturn, "%"));
      text("after-return", signed(result.afterReturn, "%"));
      ["before-pnl", "before-return"].forEach((id) =>
        color(id, result.beforePnl),
      );
      ["after-pnl", "after-return"].forEach((id) => color(id, result.afterPnl));
      if (result.overBudget)
        notice(
          `예산보다 ${won(-result.remainingBudget)} 초과한 계획이에요. 이 단가에서 예산 내 최대 수량은 ${shares(result.maxBuyQuantity)}입니다.`,
        );
      else if (result.buyQuantity === 0 && result.maxBuyQuantity === 0)
        notice("현재 예산으로는 설정한 매수 단가에 1주를 살 수 없어요.");
      else notice("");
    } catch (error) {
      invalid(error);
    }
  }

  function formatField(input) {
    try {
      const quantity = input.name.toLowerCase().includes("quantity");
      const parsed = StockCalculator.parse(input.value, input.name, quantity);
      input.value = number(Number(parsed) / (quantity ? 1 : 100));
    } catch {
      /* Preserve invalid input so the user can fix it. */
    }
  }

  form.addEventListener("submit", (event) => event.preventDefault());
  Object.values(fields).forEach((input) => {
    input.addEventListener("input", update);
    input.addEventListener("blur", () => {
      formatField(input);
      update();
    });
  });
  ["use-market-price", "use-max-quantity"].forEach((id) =>
    $(id).addEventListener("change", update),
  );
  document.querySelectorAll("[data-budget]").forEach((button) =>
    button.addEventListener("click", () => {
      fields.budget.value = number(Number(button.dataset.budget));
      update();
    }),
  );
  $("reset").addEventListener("click", () => {
    form.reset();
    update();
    fields.heldQuantity.focus();
  });

  $("copy-result").addEventListener("click", async () => {
    if (!latestResult) return;
    const r = latestResult;
    const summary = [
      "모아 · 예산 맞춤 물타기 계산",
      `현재 보유: ${shares(r.heldQuantity)} / 평균 ${won(r.heldPrice)}`,
      `현재가: ${won(r.marketPrice)}`,
      `매수 예산: ${won(r.budget)}`,
      `추가 매수: ${shares(r.buyQuantity)} × ${won(r.buyPrice)} = ${won(r.purchaseCost)}`,
      `${r.overBudget ? "예산 초과" : "남는 예산"}: ${won(Math.abs(r.remainingBudget))}`,
      `매수 후: ${shares(r.totalQuantity)} / 평균 ${won(r.average)}`,
      `총 매입금액: ${won(r.totalCost)}`,
      `현재가 기준 평가손익: ${signed(r.afterPnl, "원")} (${signed(r.afterReturn, "%")})`,
      "1주 단위 · 수수료 및 세금 제외 · 직접 입력한 시세 기준",
    ].join("\n");
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(summary);
          copied = true;
        } catch {
          /* Try local-file fallback. */
        }
      }
      if (!copied) {
        const active = document.activeElement;
        const area = document.createElement("textarea");
        area.value = summary;
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.append(area);
        area.select();
        try {
          copied = document.execCommand("copy");
        } finally {
          area.remove();
          active?.focus();
        }
      }
      text(
        "copy-status",
        copied
          ? "계산 결과를 복사했어요."
          : "복사할 수 없어요. 결과를 직접 선택해 복사해 주세요.",
      );
    } catch {
      text(
        "copy-status",
        "복사할 수 없어요. 브라우저의 클립보드 권한을 확인해 주세요.",
      );
    }
  });
  update();
})();
