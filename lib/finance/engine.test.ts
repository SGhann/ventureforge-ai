import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type Assumptions, auditModel, computeModel } from "./engine";

/**
 * A plausible seed-stage fintech: 500 customers, $120/yr, 75% margin, 20% churn,
 * $40 CAC, raising $2M in year 2.
 */
function baseAssumptions(overrides: Partial<Assumptions> = {}): Assumptions {
  return {
    periods: 5,
    startingCash: 250_000,
    startingCustomers: 500,
    arpu: 120,
    grossMarginPct: 0.75,
    annualChurnRate: 0.2,
    cac: 40,
    marketingSpend: [50_000, 200_000, 400_000, 600_000, 800_000],
    personnelCosts: [180_000, 600_000, 1_200_000, 2_000_000, 3_000_000],
    techCosts: [30_000, 80_000, 150_000, 250_000, 400_000],
    otherOpex: [20_000, 60_000, 100_000, 160_000, 240_000],
    capex: [10_000, 25_000, 40_000, 60_000, 80_000],
    depreciationYears: 5,
    taxRate: 0.25,
    fundingRounds: [{ period: 2, amount: 2_000_000, label: "Seed" }],
    ...overrides,
  };
}

describe("computeModel — accounting identities", () => {
  it("balances the balance sheet in every period", () => {
    const model = computeModel(baseAssumptions());
    for (const period of model.balanceSheet) {
      assert.ok(
        Math.abs(period.totalAssets - (period.liabilities + period.totalEquity)) < 0.01,
        `period ${period.period}: assets ${period.totalAssets} != L+E ${period.liabilities + period.totalEquity}`,
      );
    }
    assert.equal(model.checks.find((c) => c.id === "balance_sheet_balances")?.passed, true);
  });

  it("rolls retained earnings forward continuously", () => {
    const model = computeModel(baseAssumptions());
    for (let i = 1; i < model.balanceSheet.length; i++) {
      const prior = model.balanceSheet[i - 1]!;
      const current = model.balanceSheet[i]!;
      const income = model.pnl.find((p) => p.period === current.period)!.netIncome;
      assert.ok(Math.abs(current.retainedEarnings - (prior.retainedEarnings + income)) < 0.01);
    }
  });

  it("ties cash flow ending cash to the balance sheet", () => {
    const model = computeModel(baseAssumptions());
    for (const flow of model.cashFlow) {
      const sheet = model.balanceSheet.find((b) => b.period === flow.period)!;
      assert.ok(Math.abs(sheet.cash - flow.endingCash) < 0.01);
    }
  });

  it("holds all identities across a wide range of inputs", () => {
    // Cheap stand-in for property-based testing: sweep the parameter space and
    // assert the identities never break. This is what would have caught the
    // $82.7M error before it reached a data room.
    for (let churn = 0; churn <= 0.9; churn += 0.1) {
      for (const margin of [0.1, 0.4, 0.75, 0.95]) {
        for (const periods of [1, 3, 10]) {
          const model = computeModel(
            baseAssumptions({
              periods,
              annualChurnRate: churn,
              grossMarginPct: margin,
              marketingSpend: Array(periods).fill(100_000),
              personnelCosts: Array(periods).fill(500_000),
              techCosts: Array(periods).fill(50_000),
              otherOpex: Array(periods).fill(50_000),
              capex: Array(periods).fill(20_000),
            }),
          );
          for (const b of model.balanceSheet) {
            assert.ok(
              Math.abs(b.totalAssets - (b.liabilities + b.totalEquity)) < 0.01,
              `churn=${churn} margin=${margin} periods=${periods} period=${b.period} out of balance`,
            );
          }
          assert.equal(
            model.checks.find((c) => c.id === "retained_earnings_continuity")?.passed,
            true,
          );
        }
      }
    }
  });
});

describe("auditModel — catches corrupted statements", () => {
  // The checks must be able to fail. If they only ever run on data our own engine
  // produced, they prove nothing. So: corrupt a good model and confirm each check
  // actually fires.

  it("catches an unbalanced balance sheet", () => {
    const model = computeModel(baseAssumptions());
    const corrupted = structuredClone(model.balanceSheet);
    corrupted[3]!.cash += 82_700_000; // the $82.7M error, injected on purpose

    const checks = auditModel(
      model.assumptions,
      model.pnl,
      corrupted,
      model.cashFlow,
      model.unitEconomics,
      model.runwayYears,
    );
    const check = checks.find((c) => c.id === "balance_sheet_balances")!;
    assert.equal(check.passed, false);
    assert.match(check.detail, /82700000\.00|Out of balance/);
  });

  it("catches a retained earnings discontinuity", () => {
    const model = computeModel(baseAssumptions());
    const corrupted = structuredClone(model.balanceSheet);
    corrupted[2]!.retainedEarnings += 1_000_000;

    const checks = auditModel(
      model.assumptions,
      model.pnl,
      corrupted,
      model.cashFlow,
      model.unitEconomics,
      model.runwayYears,
    );
    assert.equal(checks.find((c) => c.id === "retained_earnings_continuity")!.passed, false);
  });

  it("catches cash that does not reconcile", () => {
    const model = computeModel(baseAssumptions());
    const corrupted = structuredClone(model.cashFlow);
    corrupted[1]!.endingCash += 500;

    const checks = auditModel(
      model.assumptions,
      model.pnl,
      model.balanceSheet,
      corrupted,
      model.unitEconomics,
      model.runwayYears,
    );
    assert.equal(checks.find((c) => c.id === "cash_reconciles")!.passed, false);
  });

  it("catches revenue that does not tie to its drivers", () => {
    const model = computeModel(baseAssumptions());
    const corrupted = structuredClone(model.pnl);
    corrupted[0]!.revenue *= 1.5; // hockey stick applied by hand

    const checks = auditModel(
      model.assumptions,
      corrupted,
      model.balanceSheet,
      model.cashFlow,
      model.unitEconomics,
      model.runwayYears,
    );
    assert.equal(checks.find((c) => c.id === "revenue_consistency")!.passed, false);
  });
});

describe("business checks — correct maths, wrong plan", () => {
  it("flags unit economics below 3:1 without claiming an arithmetic error", () => {
    // ARPU $120, 75% margin, 20% churn → LTV = 120 * 0.75 * 5 = $450.
    // CAC $200 → ratio 2.25:1. Real business problem, correct maths.
    const model = computeModel(baseAssumptions({ cac: 200 }));
    const check = model.checks.find((c) => c.id === "unit_economics_sane")!;

    assert.equal(check.passed, false);
    assert.match(check.detail, /2\.3:1|2\.2:1/);
    assert.match(check.detail, /business model is the problem/);
    // The arithmetic checks must still pass — the model is right, the plan isn't.
    assert.equal(model.checks.find((c) => c.id === "balance_sheet_balances")!.passed, true);
  });

  it("computes LTV and payback from the assumptions", () => {
    const model = computeModel(baseAssumptions());
    assert.equal(model.unitEconomics.averageCustomerLifespanYears, 5);
    assert.equal(model.unitEconomics.ltv, 450); // 120 * 0.75 * 5
    assert.equal(model.unitEconomics.ltvToCacRatio, 11.25); // 450 / 40
    assert.ok(Math.abs(model.unitEconomics.paybackYears - 0.444) < 0.01); // 40 / 90
  });

  it("reports runway when the venture runs out of cash", () => {
    const model = computeModel(
      baseAssumptions({
        periods: 3,
        startingCash: 100_000,
        personnelCosts: [500_000, 500_000, 500_000],
        fundingRounds: [],
      }),
    );
    assert.ok(model.runwayYears < 1, `expected < 1 year of runway, got ${model.runwayYears}`);
    assert.equal(model.checks.find((c) => c.id === "runway_calculated")!.passed, true);
    assert.equal(model.checks.find((c) => c.id === "equity_positive")!.passed, false);
  });

  it("reports infinite runway when cash never goes negative", () => {
    const model = computeModel(
      baseAssumptions({
        periods: 2,
        startingCash: 50_000_000,
        marketingSpend: [1000, 1000],
        personnelCosts: [1000, 1000],
        techCosts: [0, 0],
        otherOpex: [0, 0],
        capex: [0, 0],
        fundingRounds: [],
      }),
    );
    assert.equal(model.runwayYears, Infinity);
    assert.match(model.checks.find((c) => c.id === "runway_calculated")!.detail, /never goes negative/);
  });
});

describe("tax treatment", () => {
  it("shelters profit with prior-period losses before charging tax", () => {
    const model = computeModel(baseAssumptions());
    // Early years lose money; those losses must offset the first profitable year
    // rather than the venture paying tax on gross profit while carrying a deficit.
    const firstProfitable = model.pnl.find((p) => p.ebit > 0);
    if (firstProfitable) {
      const cumulativeLossBefore = model.pnl
        .filter((p) => p.period < firstProfitable.period && p.ebit < 0)
        .reduce((sum, p) => sum + -p.ebit, 0);
      if (cumulativeLossBefore > firstProfitable.ebit) {
        assert.equal(firstProfitable.tax, 0, "profit fully sheltered by carryforward should not be taxed");
      }
    }
  });

  it("never charges tax on a loss", () => {
    const model = computeModel(baseAssumptions());
    for (const p of model.pnl) {
      if (p.ebit < 0) assert.equal(p.tax, 0, `period ${p.period} taxed a loss`);
    }
  });
});

describe("input validation", () => {
  it("rejects an impossible margin rather than silently clamping", () => {
    assert.throws(() => computeModel(baseAssumptions({ grossMarginPct: 1.5 })));
  });

  it("rejects unknown fields so a typo'd assumption is never silently dropped", () => {
    assert.throws(() =>
      computeModel({ ...baseAssumptions(), grossMargin: 0.8 } as unknown as Assumptions),
    );
  });
});
