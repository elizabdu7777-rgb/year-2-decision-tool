import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePlan,
  defaultCompany,
  defaultEstimates,
  defaultPlans,
  officialExample
} from "../js/model.js";

test("official Year 1 example reconciles to the rulebook", () => {
  const result = officialExample();
  assert.equal(result.netProfit, -3560);
  assert.equal(result.closingCash, 71940);
  assert.equal(result.grossProfit, 35200);
  assert.equal(result.bonus, 1760);
  assert.equal(result.feasible, true);
});

test("tax loss is used before game tax", () => {
  const estimates = structuredClone(defaultEstimates);
  estimates.premises.B.rent = 0;
  estimates.premises.B.transport = 0;
  estimates.salary = 0;
  estimates.bonusRate = 0;
  estimates.machines[5].maintenance = 0;
  estimates.machines[5].price = 0;
  const company = structuredClone(defaultCompany);
  company.closingCash = 100000;
  company.taxLossPool = 50000;
  company.ownedMachines = [{ type: "5", remainingLife: 4 }, { type: "", remainingLife: 0 }];
  const plan = structuredClone(defaultPlans[0]);
  plan.milkTons = 1;
  plan.premises[0].production = 20000;
  plan.premises[0].actualSales = 20000;
  plan.salesRequest = 20000;
  plan.marketInvestment = 1000;

  const result = calculatePlan(company, plan, estimates);
  assert.equal(result.profitBeforeTax, 19000);
  assert.equal(result.lossPoolUsed, 19000);
  assert.equal(result.tax, 0);
  assert.equal(result.closingTaxLoss, 31000);
});

test("a plan is blocked when advance payments make cash negative", () => {
  const company = structuredClone(defaultCompany);
  company.closingCash = 10000;
  const plan = structuredClone(defaultPlans[1]);
  plan.newBorrowing = 0;

  const result = calculatePlan(company, plan);
  assert.ok(result.minimumAdvanceCash < 0);
  assert.equal(result.feasible, false);
  assert.ok(result.issues.some((issue) => issue.message.includes("advance payments")));
});

test("actual sales cannot exceed the eligible request", () => {
  const plan = structuredClone(defaultPlans[0]);
  plan.salesRequest = 30000;
  plan.premises[0].actualSales = 40000;

  const result = calculatePlan(defaultCompany, plan);
  assert.equal(result.feasible, false);
  assert.ok(result.issues.some((issue) => issue.message.includes("eligible sales request")));
});

test("new borrowing cannot run beyond eight seasons", () => {
  const plan = structuredClone(defaultPlans[0]);
  plan.loanTerm = 9;
  plan.newBorrowing = 10000;

  const result = calculatePlan(defaultCompany, plan);
  assert.equal(result.feasible, false);
  assert.ok(result.issues.some((issue) => issue.message.includes("eight seasons")));
});
