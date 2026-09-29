/* Official domestic online fee references checked 2026-09-29.
   Account/event discounts and actual execution conditions can differ.
   Presets use whole-won ceiling estimates; users can change rounding below. */
(function (root) {
  "use strict";
  const kiwoom =
    "https://rank.kiwoom.com/r/heroad/myleague/VLeagueInfoAllView?menuId=HRD0025";
  const toss =
    "https://home-files.tossinvest.com/files/notice/f8b692a8-2b29-46c4-b279-f6bf865e64d5.pdf";
  const kakao = "https://www.kakaopaysec.com/guide/feeGuide/dynamicPage.do";
  const mirae =
    "https://securities.miraeasset.com/public/mw/guide/html/20191119095045.html";
  // These references describe particular screens/products, not every account.
  const orderGuides = {
    kiwoom: {
      orderNote:
        "영웅문4 [0302]는 ‘미수불가 100%’ 조회에 수수료를 고려하고, ‘증거금100%종목’ 조회에는 고려하지 않아요. 잔고 평가손익에는 매수·매도 수수료와 매도 세금이 반영돼요. 이 계산기는 이번 매수 수수료만 손익에 반영해요.",
      orderSource: "https://download.kiwoom.com/hero4_help_new/0302.htm",
    },
    toss: {
      orderNote:
        "미수거래 설명서의 예시는 매수 증거금에 수수료를 더해 주문가능금액을 계산해요. 일반 현금계좌 전체와 앱 손익 표시 방식까지 같은 규칙이라고 확인된 것은 아니에요.",
      orderSource:
        "https://home-files.tossinvest.com/files/notice/d29248f1-ee13-48ab-abec-e570a062d3a7.pdf",
    },
    kakao: {
      orderNote:
        "위탁증거금 안내는 매수 수수료를 현금증거금으로 징수한다고 설명해요. 계좌의 주문가능금액과 개인이 정한 매수 예산은 구분해야 해요. 앱 손익 표시 산식은 이 자료에서 확인되지 않아요.",
      orderSource:
        "https://kakaopaysec.com/etcGuide/marginnotice/dynamicPage.do",
    },
    mirae: {
      orderNote:
        "카이로스 [0657]에서 계좌·종목별 주문가능금액을 조회할 수 있어요. 공개 도움말에는 수수료 포함 여부나 앱 손익 표시 산식이 명시되지 않아 일괄 적용하지 않았어요.",
      orderSource: "https://securities.miraeasset.com/kairos/0657.htm",
    },
  };
  const presets = [
    {
      id: "kiwoom-krx",
      label: "키움증권 · KRX 온라인",
      rate: "0.015",
      source: kiwoom,
    },
    {
      id: "kiwoom-nxt",
      label: "키움증권 · NXT 온라인",
      rate: "0.0145",
      source: kiwoom,
    },
    {
      id: "toss-krx",
      label: "토스증권 · KRX 일반",
      rate: "0.015",
      source: toss,
    },
    {
      id: "toss-nxt",
      label: "토스증권 · NXT 일반",
      rate: "0.014",
      source: toss,
    },
    {
      id: "kakao-krx",
      label: "카카오페이증권 · KRX 온라인",
      rate: "0.015",
      minimum: "1",
      source: kakao,
    },
    {
      id: "kakao-nxt",
      label: "카카오페이증권 · NXT 온라인",
      rate: "0.014",
      minimum: "1",
      source: kakao,
    },
    {
      id: "mirae-krx",
      label: "미래에셋 · 신규 다이렉트 / KRX",
      rate: "0.0136396",
      source: mirae,
    },
    {
      id: "mirae-nxt-taker",
      label: "미래에셋 · 신규 다이렉트 / NXT 즉시체결",
      rate: "0.0131833",
      source: mirae,
    },
    {
      id: "mirae-nxt-maker",
      label: "미래에셋 · 신규 다이렉트 / NXT 잔량대기",
      rate: "0.0127033",
      source: mirae,
    },
    {
      id: "mirae-nxt-auction",
      label: "미래에셋 · 신규 다이렉트 / NXT 단일가",
      rate: "0.0129433",
      source: mirae,
    },
    { id: "custom", label: "다른 증권사 / 내 우대 수수료 직접 입력", rate: "" },
    { id: "none", label: "수수료 없음 (0%)", rate: "0" },
  ];
  const api = Object.freeze(
    presets.map((preset) =>
      Object.freeze({
        minimum: "0",
        fixed: "0",
        rounding: "ceil-won",
        ...orderGuides[preset.id.split("-")[0]],
        ...preset,
      }),
    ),
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BrokerPresets = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
