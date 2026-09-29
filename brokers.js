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
        ...preset,
      }),
    ),
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BrokerPresets = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
