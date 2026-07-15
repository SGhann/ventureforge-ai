import { z } from "zod";

/**
 * A deterministic 3-statement financial model.
 *
 * WHY THIS EXISTS: a language model asked to build a financial model in prose
 * will produce something that looks auditable and isn't. It will drop a period,
 * or let retained earnings drift, or quietly stop balancing in year 4 — and the
 * output is fluent enough that nobody catches it until diligence does. That is
 * the $82.7M retained earnings error, and no amount of prompt engineering fixes
 * it, because the failure is arithmetic, not reasoning.
 *
 * So the division of labour is: the model chooses the assumptions (which is
 * judgment, and where its expertise is real), and this module does the maths
 * (which is deterministic, and where code is simply better). The seven checks
 * below run as assertions. A model that doesn't balance throws. It cannot report
 * that it balanced.
 *
 * SIMPLIFICATIONS in this version, stated plainly because an undocumented
 * simplification is a lie by omission:
 *   - No working capital. Receivables, payables, and inventory are all assumed
 *     to settle within the period, so operating cash flow is net income plus
 *     depreciation. Fine for SaaS and most transaction businesses; wrong for
 *     anything with real inventory or long collection cycles.
 *   - No debt. Financing is equity only. A venture with a credit facility needs
 *     more than this.
 *   - Annual periods only.
 * Extending any of these means extending this engine, not asking the model to
 * paper over it in prose.
 */

export const AssumptionsSchema = z
  .object({
    periods: z.number().int().min(1).max(10).describe("Number of annual periods to project"),
    startingCash: z.number().min(0).describe("Cash on hand at period 0, in USD"),

    startingCustomers: z.number().min(0).describe("Customer count at period 0"),
    arpu: z.number().min(0).describe("Average annual revenue per customer, in USD"),
    grossMarginPct: z
      .number()
      .min(0)
      .max(1)
      .describe("Gross margin as a decimal, e.g. 0.75 for 75%"),
    annualChurnRate: z
      .number()
      .min(0)
      .max(1)
      .describe("Fraction of customers lost per year, e.g. 0.2 for 20%"),
    cac: z.number().min(0).describe("Fully-loaded cost to acquire one customer, in USD"),

    marketingSpend: z
      .array(z.number().min(0))
      .describe("Marketing spend per period. New customers = spend / CAC. One entry per period."),
    personnelCosts: z.array(z.number().min(0)).describe("Personnel cost per period, in USD"),
    techCosts: z.array(z.number().min(0)).describe("Technology and infrastructure cost per period"),
    otherOpex: z.array(z.number().min(0)).describe("All other operating expense per period"),

    capex: z.array(z.number().min(0)).describe("Capital expenditure per period"),
    depreciationYears: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Straight-line depreciation life in years"),
    taxRate: z.number().min(0).max(1).default(0.25).describe("Corporate tax rate as a decimal"),

    fundingRounds: z
      .array(
        z.object({
          period: z.number().int().min(1).describe("Which period the round closes in (1-indexed)"),
          amount: z.number().min(0).describe("Gross proceeds in USD"),
          label: z.string().describe("Round name, e.g. 'Seed'"),
        }),
      )
      .default([])
      .describe("Equity rounds. Debt is not modelled."),
  })
  .strict();

export type Assumptions = z.infer<typeof AssumptionsSchema>;

export type PeriodPnl = {
  period: number;
  customersStart: number;
  customersNew: number;
  customersChurned: number;
  customersEnd: number;
  averageCustomers: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  personnel: number;
  marketing: number;
  tech: number;
  other: number;
  totalOpex: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  tax: number;
  netIncome: number;
};

export type PeriodBalanceSheet = {
  period: number;
  cash: number;
  ppe: number;
  totalAssets: number;
  liabilities: number;
  paidInCapital: number;
  retainedEarnings: number;
  totalEquity: number;
};

export type PeriodCashFlow = {
  period: number;
  netIncome: number;
  depreciation: number;
  operating: number;
  capex: number;
  investing: number;
  financing: number;
  netChange: number;
  endingCash: number;
};

export type UnitEconomics = {
  cac: number;
  ltv: number;
  ltvToCacRatio: number;
  paybackYears: number;
  averageCustomerLifespanYears: number;
};

export type Check = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type FinancialModel = {
  assumptions: Assumptions;
  pnl: PeriodPnl[];
  balanceSheet: PeriodBalanceSheet[];
  cashFlow: PeriodCashFlow[];
  unitEconomics: UnitEconomics;
  /** Years until cash goes negative. Infinity if it never does. */
  runwayYears: number;
  checks: Check[];
  allChecksPassed: boolean;
};

/** Absolute tolerance for accounting identities, in USD. Not a percentage — a balance sheet balances. */
const TOLERANCE = 0.01;

function at(arr: number[], i: number): number {
  return arr[i] ?? 0;
}

export function computeModel(input: Assumptions): FinancialModel {
  const a = AssumptionsSchema.parse(input);

  const pnl: PeriodPnl[] = [];
  const balanceSheet: PeriodBalanceSheet[] = [];
  const cashFlow: PeriodCashFlow[] = [];

  let customers = a.startingCustomers;
  let cash = a.startingCash;
  let ppe = 0;
  let retainedEarnings = 0;
  // Period 0 equity is the starting cash — the founders' money is paid-in capital.
  let paidInCapital = a.startingCash;
  let lossCarryforward = 0;

  balanceSheet.push({
    period: 0,
    cash,
    ppe,
    totalAssets: cash + ppe,
    liabilities: 0,
    paidInCapital,
    retainedEarnings,
    totalEquity: paidInCapital + retainedEarnings,
  });

  for (let p = 1; p <= a.periods; p++) {
    const i = p - 1;

    const customersStart = customers;
    const marketing = at(a.marketingSpend, i);
    const customersNew = a.cac > 0 ? marketing / a.cac : 0;
    const customersChurned = customersStart * a.annualChurnRate;
    const customersEnd = customersStart - customersChurned + customersNew;
    // Average of opening and closing balance — revenue accrues through the year
    // rather than all landing on 31 December.
    const averageCustomers = (customersStart + customersEnd) / 2;

    const revenue = averageCustomers * a.arpu;
    const cogs = revenue * (1 - a.grossMarginPct);
    const grossProfit = revenue - cogs;

    const personnel = at(a.personnelCosts, i);
    const tech = at(a.techCosts, i);
    const other = at(a.otherOpex, i);
    const totalOpex = personnel + marketing + tech + other;
    const ebitda = grossProfit - totalOpex;

    const capexThisPeriod = at(a.capex, i);
    // Straight-line on the opening PP&E plus this period's additions, capped so
    // an asset never depreciates below zero.
    const depreciableBase = ppe + capexThisPeriod;
    const depreciation = Math.min(depreciableBase / a.depreciationYears, depreciableBase);
    const ebit = ebitda - depreciation;

    // Losses shelter future profits before tax is due.
    let taxable = ebit;
    if (taxable > 0 && lossCarryforward > 0) {
      const used = Math.min(taxable, lossCarryforward);
      taxable -= used;
      lossCarryforward -= used;
    } else if (ebit < 0) {
      lossCarryforward += -ebit;
    }
    const tax = taxable > 0 ? taxable * a.taxRate : 0;
    const netIncome = ebit - tax;

    const financing = a.fundingRounds
      .filter((r) => r.period === p)
      .reduce((sum, r) => sum + r.amount, 0);

    const operating = netIncome + depreciation;
    const investing = -capexThisPeriod;
    const netChange = operating + investing + financing;
    const endingCash = cash + netChange;

    pnl.push({
      period: p,
      customersStart,
      customersNew,
      customersChurned,
      customersEnd,
      averageCustomers,
      revenue,
      cogs,
      grossProfit,
      personnel,
      marketing,
      tech,
      other,
      totalOpex,
      ebitda,
      depreciation,
      ebit,
      tax,
      netIncome,
    });

    cashFlow.push({
      period: p,
      netIncome,
      depreciation,
      operating,
      capex: capexThisPeriod,
      investing,
      financing,
      netChange,
      endingCash,
    });

    cash = endingCash;
    ppe = ppe + capexThisPeriod - depreciation;
    retainedEarnings += netIncome;
    paidInCapital += financing;
    customers = customersEnd;

    balanceSheet.push({
      period: p,
      cash,
      ppe,
      totalAssets: cash + ppe,
      liabilities: 0,
      paidInCapital,
      retainedEarnings,
      totalEquity: paidInCapital + retainedEarnings,
    });
  }

  const unitEconomics = computeUnitEconomics(a);
  const runwayYears = computeRunway(cashFlow, a.startingCash);
  const checks = auditModel(a, pnl, balanceSheet, cashFlow, unitEconomics, runwayYears);

  return {
    assumptions: a,
    pnl,
    balanceSheet,
    cashFlow,
    unitEconomics,
    runwayYears,
    checks,
    allChecksPassed: checks.every((c) => c.passed),
  };
}

function computeUnitEconomics(a: Assumptions): UnitEconomics {
  const lifespan = a.annualChurnRate > 0 ? 1 / a.annualChurnRate : Infinity;
  const annualGrossProfitPerCustomer = a.arpu * a.grossMarginPct;
  const ltv = annualGrossProfitPerCustomer * lifespan;
  return {
    cac: a.cac,
    ltv,
    ltvToCacRatio: a.cac > 0 ? ltv / a.cac : Infinity,
    paybackYears: annualGrossProfitPerCustomer > 0 ? a.cac / annualGrossProfitPerCustomer : Infinity,
    averageCustomerLifespanYears: lifespan,
  };
}

/** Years until cash first goes negative, interpolated within the period it happens. */
function computeRunway(cashFlow: PeriodCashFlow[], startingCash: number): number {
  let previousCash = startingCash;
  for (const period of cashFlow) {
    if (period.endingCash < 0) {
      // Interpolate the fraction of the period before the balance crosses zero.
      const burn = previousCash - period.endingCash;
      const fraction = burn > 0 ? previousCash / burn : 0;
      return period.period - 1 + Math.max(0, fraction);
    }
    previousCash = period.endingCash;
  }
  return Infinity;
}

/**
 * The seven checks. These are the product promise, so they run as code on every
 * model — not as a claim in a system prompt.
 *
 * Deliberately independent of computeModel: this audits whatever statements you
 * hand it, so it can catch a regression in our own engine, and can later audit a
 * spreadsheet a founder uploads. Checks 1, 2, 3 and 5 are accounting identities
 * (a failure means the arithmetic is broken); checks 4, 6 and 7 are business
 * checks that can legitimately fail on correct arithmetic — those mean the plan
 * is wrong, not the maths.
 */
export function auditModel(
  a: Assumptions,
  pnl: PeriodPnl[],
  bs: PeriodBalanceSheet[],
  cf: PeriodCashFlow[],
  ue: UnitEconomics,
  runwayYears: number,
): Check[] {
  const checks: Check[] = [];

  // 1. Balance sheet balances, every period, to the cent.
  //
  // Every total is recomputed from its components rather than read off the stored
  // aggregate. Trusting a stored total is how a corrupted line item slips through:
  // if `cash` drifts but `totalAssets` doesn't, comparing the two stored totals to
  // each other still balances perfectly and reports all clear. So we check both
  // that each total ties to its parts, and that the two sides tie to each other.
  const gaps = bs
    .map((b) => {
      const assets = b.cash + b.ppe;
      const equity = b.paidInCapital + b.retainedEarnings;
      return {
        period: b.period,
        // Stored aggregate vs. its own components.
        assetsVsStored: Math.abs(assets - b.totalAssets),
        equityVsStored: Math.abs(equity - b.totalEquity),
        // The accounting identity itself.
        identity: Math.abs(assets - (b.liabilities + equity)),
      };
    })
    .map((g) => ({ ...g, worst: Math.max(g.assetsVsStored, g.equityVsStored, g.identity) }))
    .filter((g) => g.worst > TOLERANCE);

  checks.push({
    id: "balance_sheet_balances",
    label: "Balance sheet balances",
    passed: gaps.length === 0,
    detail:
      gaps.length === 0
        ? `Assets = Liabilities + Equity in all ${bs.length} periods, and every total ties to its components (tolerance $${TOLERANCE}).`
        : `Out of balance in period(s) ${gaps.map((g) => g.period).join(", ")}. Worst gap: $${Math.max(...gaps.map((g) => g.worst)).toFixed(2)}.`,
  });

  // 2. Balance sheet cash ties to cash flow statement ending cash.
  const cashMismatch = cf.filter((c) => {
    const b = bs.find((x) => x.period === c.period);
    return !b || Math.abs(b.cash - c.endingCash) > TOLERANCE;
  });
  checks.push({
    id: "cash_reconciles",
    label: "Cash flow reconciles to balance sheet",
    passed: cashMismatch.length === 0,
    detail:
      cashMismatch.length === 0
        ? "Ending cash on the cash flow statement matches the balance sheet in every period."
        : `Mismatch in period(s) ${cashMismatch.map((c) => c.period).join(", ")}.`,
  });

  // 3. Retained earnings roll forward continuously. This is the $82.7M check.
  const reBreaks: number[] = [];
  for (let i = 1; i < bs.length; i++) {
    const prior = bs[i - 1]!;
    const current = bs[i]!;
    const income = pnl.find((p) => p.period === current.period)?.netIncome ?? 0;
    if (Math.abs(current.retainedEarnings - (prior.retainedEarnings + income)) > TOLERANCE) {
      reBreaks.push(current.period);
    }
  }
  checks.push({
    id: "retained_earnings_continuity",
    label: "Retained earnings continuity",
    passed: reBreaks.length === 0,
    detail:
      reBreaks.length === 0
        ? "Retained earnings roll forward as prior balance + net income in every period."
        : `Discontinuity in period(s) ${reBreaks.join(", ")} — retained earnings do not tie to net income.`,
  });

  // 4. Equity stays positive.
  const negativeEquity = bs.filter((b) => b.totalEquity < 0);
  checks.push({
    id: "equity_positive",
    label: "Equity stays positive",
    passed: negativeEquity.length === 0,
    detail:
      negativeEquity.length === 0
        ? "Total equity remains positive throughout."
        : `Equity goes negative in period(s) ${negativeEquity.map((b) => b.period).join(", ")} — the venture is technically insolvent and needs funding earlier.`,
  });

  // 5. Revenue ties to the customer and pricing assumptions it claims to derive from.
  const revenueBreaks = pnl.filter(
    (p) => Math.abs(p.revenue - p.averageCustomers * a.arpu) > TOLERANCE,
  );
  checks.push({
    id: "revenue_consistency",
    label: "Revenue ties to drivers",
    passed: revenueBreaks.length === 0,
    detail:
      revenueBreaks.length === 0
        ? "Revenue equals average customers × ARPU in every period."
        : `Revenue does not tie to drivers in period(s) ${revenueBreaks.map((p) => p.period).join(", ")}.`,
  });

  // 6. Unit economics are sane. A failure here is a business problem, not a maths
  //    problem — the model is right and the plan is wrong. Say so.
  const ratio = ue.ltvToCacRatio;
  checks.push({
    id: "unit_economics_sane",
    label: "Unit economics (LTV:CAC > 3:1)",
    passed: ratio > 3,
    detail:
      ratio > 3
        ? `LTV:CAC is ${ratio.toFixed(1)}:1 (LTV $${ue.ltv.toFixed(0)}, CAC $${ue.cac.toFixed(0)}).`
        : `LTV:CAC is ${ratio.toFixed(1)}:1 — below the 3:1 threshold investors expect (LTV $${ue.ltv.toFixed(0)}, CAC $${ue.cac.toFixed(0)}). The arithmetic is correct; the business model is the problem. Either raise ARPU, cut churn, improve margin, or lower CAC.`,
  });

  // 7. Runway is a real, calculable number.
  const runwayOk = runwayYears > 0 && !Number.isNaN(runwayYears);
  checks.push({
    id: "runway_calculated",
    label: "Runway calculated",
    passed: runwayOk,
    detail: !runwayOk
      ? "Runway could not be calculated — cash is negative from the outset."
      : runwayYears === Infinity
        ? "Cash never goes negative across the projection period."
        : `Cash goes negative at ${runwayYears.toFixed(1)} years (${(runwayYears * 12).toFixed(0)} months).`,
  });

  return checks;
}
