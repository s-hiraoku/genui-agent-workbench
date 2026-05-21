export type SalesSummary = {
  period: string;
  revenue: number;
  revenueDelta: number;
  grossMargin: number;
  conversionRate: number;
  averageOrderValue: number;
  pipelineValue: number;
};

export type SalesRow = {
  segment: string;
  owner: string;
  revenue: number;
  target: number;
  forecast: number;
  risk: "low" | "medium" | "high";
  nextAction: string;
};

export function getSalesSummary(): SalesSummary {
  return {
    period: "2026 Q2 month-to-date",
    revenue: 12840000,
    revenueDelta: 8.7,
    grossMargin: 0.61,
    conversionRate: 0.184,
    averageOrderValue: 142000,
    pipelineValue: 36400000,
  };
}

export function getSalesRows(): SalesRow[] {
  return [
    {
      segment: "Enterprise",
      owner: "Ito",
      revenue: 5420000,
      target: 6100000,
      forecast: 7200000,
      risk: "medium",
      nextAction: "Close two legal-review deals before month end",
    },
    {
      segment: "Mid Market",
      owner: "Sato",
      revenue: 3860000,
      target: 3400000,
      forecast: 4300000,
      risk: "low",
      nextAction: "Expand top 12 accounts with dashboard add-ons",
    },
    {
      segment: "SMB",
      owner: "Tanaka",
      revenue: 2160000,
      target: 2800000,
      forecast: 2450000,
      risk: "high",
      nextAction: "Run churn-save campaign for renewal cohort",
    },
    {
      segment: "Partner",
      owner: "Kobayashi",
      revenue: 1400000,
      target: 1200000,
      forecast: 1650000,
      risk: "low",
      nextAction: "Prioritize co-sell enablement for APAC partners",
    },
  ];
}
