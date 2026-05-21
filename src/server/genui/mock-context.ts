import { getSalesRows, getSalesSummary } from "../tools/mock-sales";
import { getSupportSummary, getSupportTickets } from "../tools/mock-support";
import type { GenUIMockDataMode } from "./types";

export function selectMockDataMode(prompt: string, requested: GenUIMockDataMode = "auto"): GenUIMockDataMode {
  if (requested !== "auto") {
    return requested;
  }

  const wantsSales = /sales|revenue|kpi|dashboard|売上|ダッシュボード|商談|KPI/i.test(prompt);
  const wantsSupport = /support|ticket|sla|customer|サポート|問い合わせ|未対応|緊急|顧客/i.test(prompt);

  if (wantsSales && !wantsSupport) {
    return "sales";
  }

  if (wantsSupport && !wantsSales) {
    return "support";
  }

  return "sales";
}

export function getMockData(mode: GenUIMockDataMode, prompt: string): Record<string, unknown> | undefined {
  const selected = selectMockDataMode(prompt, mode);

  if (selected === "none") {
    return undefined;
  }

  if (selected === "support") {
    return {
      support: {
        summary: getSupportSummary(),
        tickets: getSupportTickets(),
      },
    };
  }

  return {
    sales: {
      summary: getSalesSummary(),
      rows: getSalesRows(),
    },
  };
}
