export type SupportSummary = {
  openTickets: number;
  urgentTickets: number;
  breachedSla: number;
  medianFirstResponseMinutes: number;
  customerSatisfaction: number;
  backlogDelta: number;
};

export type SupportTicket = {
  id: string;
  customer: string;
  topic: string;
  urgency: "critical" | "high" | "normal";
  status: "new" | "waiting-on-agent" | "waiting-on-customer";
  ageHours: number;
  recommendedAction: string;
};

export function getSupportSummary(): SupportSummary {
  return {
    openTickets: 47,
    urgentTickets: 9,
    breachedSla: 3,
    medianFirstResponseMinutes: 22,
    customerSatisfaction: 0.91,
    backlogDelta: -6,
  };
}

export function getSupportTickets(): SupportTicket[] {
  return [
    {
      id: "SUP-1842",
      customer: "Northstar Retail",
      topic: "Checkout failure after pricing sync",
      urgency: "critical",
      status: "waiting-on-agent",
      ageHours: 5.4,
      recommendedAction: "Escalate to payments owner and send 30-minute update",
    },
    {
      id: "SUP-1839",
      customer: "Aoba Logistics",
      topic: "Invoice export missing tax column",
      urgency: "high",
      status: "new",
      ageHours: 2.1,
      recommendedAction: "Confirm schema version and provide export workaround",
    },
    {
      id: "SUP-1827",
      customer: "Mira Health",
      topic: "SSO group mapping mismatch",
      urgency: "high",
      status: "waiting-on-agent",
      ageHours: 17.8,
      recommendedAction: "Attach identity logs and schedule admin pairing session",
    },
    {
      id: "SUP-1816",
      customer: "Kumo Foods",
      topic: "Dashboard filter saved view request",
      urgency: "normal",
      status: "waiting-on-customer",
      ageHours: 31.6,
      recommendedAction: "Send concise confirmation with two supported options",
    },
  ];
}
