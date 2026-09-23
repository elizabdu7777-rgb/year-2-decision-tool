export const defaultEstimates = {
  revenuePerUnit: 2,
  milkPrice: 20000,
  yieldPerTon: 20000,
  salary: 10000,
  bonusRate: 0.05,
  taxRate: 0.1,
  interestRate: 0.1,
  minimumMarketInvestment: 1000,
  year2WinterForecast: 410000,
  marketSwing: 0.2,
  premises: {
    A: { slots: 1, transport: 0.3, rent: 12000, storageEstimate: true },
    B: { slots: 1, transport: 0.4, rent: 10000, storageEstimate: true },
    C: { slots: 1, transport: 0.3, rent: 12000, storageEstimate: false },
    D: { slots: 1, transport: 0.1, rent: 17000, storageEstimate: false },
    E: { slots: 2, transport: 0.2, rent: 15000, storageEstimate: false },
    F: { slots: 3, transport: 0.2, rent: 16000, storageEstimate: true }
  },
  machines: {
    1: { capacity: 72000, price: 35000, maintenance: 1800 },
    2: { capacity: 120000, price: 95000, maintenance: 2900 },
    3: { capacity: 68000, price: 38000, maintenance: 2100 },
    4: { capacity: 95000, price: 70000, maintenance: 2900 },
    5: { capacity: 45000, price: 28000, maintenance: 1300 },
    6: { capacity: 110000, price: 90000, maintenance: 2900 }
  }
};

export const defaultCompany = {
  closingCash: 71940,
  year1AnnualProfit: -3560,
  taxLossPool: 3560,
  unpaidLoanPrincipal: 0,
  existingPrincipalPayment: 0,
  ownedMachines: [
    { type: "5", remainingLife: 4 },
    { type: "", remainingLife: 0 }
  ]
};

export const defaultPlans = [
  {
    name: "Lean winter",
    premises: [
      { code: "B", production: 40000, actualSales: 40000 },
      { code: "", production: 0, actualSales: 0 }
    ],
    ownedAssignments: ["p1", "idle"],
    newMachineType: "",
    newMachineAssignment: "idle",
    milkTons: 2,
    salesRequest: 40000,
    marketInvestment: 1000,
    newBorrowing: 0,
    loanTerm: 4
  },
  {
    name: "Capacity bet",
    premises: [
      { code: "E", production: 100000, actualSales: 90000 },
      { code: "", production: 0, actualSales: 0 }
    ],
    ownedAssignments: ["p1", "idle"],
    newMachineType: "1",
    newMachineAssignment: "p1",
    milkTons: 5,
    salesRequest: 100000,
    marketInvestment: 10000,
    newBorrowing: 80000,
    loanTerm: 4
  }
];

const whole = (value) => Math.round(Number(value) || 0);
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const numeric = (value) => Number(value) || 0;

function machineRecord(type, remainingLife, estimates, isNew = false) {
  const spec = estimates.machines[String(type)];
  if (!spec || (!isNew && numeric(remainingLife) <= 0)) return null;
  return {
    type: String(type),
    capacity: numeric(spec.capacity),
    price: numeric(spec.price),
    maintenance: numeric(spec.maintenance),
    depreciation: numeric(spec.price) / 8,
    isNew
  };
}

function addIssue(issues, level, message) {
  issues.push({ level, message });
}

export function calculatePlan(company, plan, estimates = defaultEstimates) {
  const issues = [];
  const selectedPremises = plan.premises.map((row) => estimates.premises[row.code] || null);
  const selectedCodes = plan.premises.map((row) => row.code).filter(Boolean);

  if (new Set(selectedCodes).size !== selectedCodes.length) {
    addIssue(issues, "error", "A premise can only be selected once.");
  }

  const owned = company.ownedMachines
    .map((row, index) => {
      const record = machineRecord(row.type, row.remainingLife, estimates);
      return record ? { ...record, assignment: plan.ownedAssignments[index] || "idle" } : null;
    })
    .filter(Boolean);
  const purchased = machineRecord(plan.newMachineType, 8, estimates, true);
  const allMachines = purchased
    ? [...owned, { ...purchased, assignment: plan.newMachineAssignment || "idle" }]
    : owned;

  const premiseCapacity = [0, 0];
  const premiseMachineCount = [0, 0];
  allMachines.forEach((machine) => {
    const premiseIndex = machine.assignment === "p1" ? 0 : machine.assignment === "p2" ? 1 : -1;
    if (premiseIndex >= 0) {
      premiseCapacity[premiseIndex] += machine.capacity;
      premiseMachineCount[premiseIndex] += 1;
    }
  });

  plan.premises.forEach((row, index) => {
    const premise = selectedPremises[index];
    const production = numeric(row.production);
    const sales = numeric(row.actualSales);
    if (!premise && (production > 0 || sales > 0 || premiseMachineCount[index] > 0)) {
      addIssue(issues, "error", `Plan ${index + 1}: choose a premise before assigning machines or volume.`);
    }
    if (premise && premiseMachineCount[index] > numeric(premise.slots)) {
      addIssue(issues, "error", `Premise ${row.code} has ${premise.slots} machine slot${premise.slots === 1 ? "" : "s"}.`);
    }
    if (production > premiseCapacity[index]) {
      addIssue(issues, "error", `Production at premise ${row.code || index + 1} exceeds installed capacity.`);
    }
    if (sales > production) {
      addIssue(issues, "error", `Sales allocated to premise ${row.code || index + 1} exceed its production.`);
    }
  });

  const production = whole(plan.premises.reduce((sum, row) => sum + numeric(row.production), 0));
  const actualSales = whole(plan.premises.reduce((sum, row) => sum + numeric(row.actualSales), 0));
  const installedCapacity = whole(premiseCapacity.reduce((sum, value) => sum + value, 0));
  const milkTons = numeric(plan.milkTons);
  const milkCapacity = whole(milkTons * numeric(estimates.yieldPerTon));
  const salesRequest = whole(plan.salesRequest);
  const marketInvestment = whole(plan.marketInvestment);
  const borrowing = whole(plan.newBorrowing);
  const loanTerm = Math.max(1, whole(plan.loanTerm));

  if (milkTons < 1) addIssue(issues, "error", "At least one ton of milk is required every season.");
  if (marketInvestment < numeric(estimates.minimumMarketInvestment)) {
    addIssue(issues, "error", `Market investment must be at least Sh ${whole(estimates.minimumMarketInvestment).toLocaleString()}.`);
  }
  if (production > milkCapacity) addIssue(issues, "error", "Production exceeds the ice cream yield from milk purchased.");
  if (production > installedCapacity) addIssue(issues, "error", "Production exceeds total installed machine capacity.");
  if (salesRequest % 10000 !== 0) addIssue(issues, "error", "Sales requests must use 10,000-unit blocks.");
  if (salesRequest > production) addIssue(issues, "error", "Sales requested exceed planned production.");
  if (actualSales > salesRequest) addIssue(issues, "error", "Actual sales allocated exceed the eligible sales request.");
  if (loanTerm > 8) addIssue(issues, "error", "A new loan may run for no more than eight seasons.");
  if (numeric(company.unpaidLoanPrincipal) + borrowing > 200000) {
    addIssue(issues, "error", "Outstanding principal immediately after borrowing exceeds Sh 200,000.");
  }

  const activeProduction = plan.premises.map((row) => numeric(row.production));
  if (actualSales > 0 && production > 0 && activeProduction.filter((value) => value > 0).length > 1) {
    let allocatedSoFar = 0;
    plan.premises.forEach((row, index) => {
      const expected = index === plan.premises.length - 1
        ? actualSales - allocatedSoFar
        : Math.round((actualSales * activeProduction[index]) / production);
      allocatedSoFar += expected;
      if (Math.abs(numeric(row.actualSales) - expected) > 1) {
        addIssue(issues, "error", "Sales across premises must follow the actual production ratio; place any rounding residual in premise 2.");
      }
    });
  }

  const revenue = money(actualSales * numeric(estimates.revenuePerUnit));
  const milkCost = money(milkTons * numeric(estimates.milkPrice));
  const maintenance = money(allMachines.reduce((sum, machine) => sum + machine.maintenance, 0));
  const depreciation = money(allMachines.reduce((sum, machine) => sum + machine.depreciation, 0));
  const purchaseCost = purchased ? money(purchased.price) : 0;
  const rent = money(selectedPremises.reduce((sum, premise) => sum + (premise ? numeric(premise.rent) : 0), 0));
  const transport = money(
    plan.premises.reduce((sum, row, index) => {
      const premise = selectedPremises[index];
      return sum + numeric(row.actualSales) * (premise ? numeric(premise.transport) : 0);
    }, 0)
  );
  const grossProfit = money(revenue - milkCost - maintenance - depreciation);
  const bonus = money(Math.max(0, grossProfit) * numeric(estimates.bonusRate));
  const existingInterest = money(numeric(company.unpaidLoanPrincipal) * numeric(estimates.interestRate));
  const newInterest = money(borrowing * numeric(estimates.interestRate));
  const interest = money(existingInterest + newInterest);
  const profitBeforeTax = money(
    grossProfit - transport - marketInvestment - bonus - numeric(estimates.salary) - rent - interest
  );
  const lossPoolUsed = money(Math.min(Math.max(0, profitBeforeTax), numeric(company.taxLossPool)));
  const taxableProfit = money(Math.max(0, profitBeforeTax - lossPoolUsed));
  const tax = money(taxableProfit * numeric(estimates.taxRate));
  const netProfit = money(profitBeforeTax - tax);
  const closingTaxLoss = money(
    profitBeforeTax < 0
      ? numeric(company.taxLossPool) + Math.abs(profitBeforeTax)
      : Math.max(0, numeric(company.taxLossPool) - profitBeforeTax)
  );

  const existingPrincipalPayment = money(
    Math.min(numeric(company.existingPrincipalPayment), numeric(company.unpaidLoanPrincipal))
  );
  const newPrincipalPayment = money(borrowing / loanTerm);
  const bankPayment = money(existingPrincipalPayment + newPrincipalPayment + interest);
  const openingFunds = money(numeric(company.closingCash) + borrowing);
  const cashAfterMachine = money(openingFunds - purchaseCost);
  const cashAfterMilk = money(cashAfterMachine - milkCost);
  const cashAfterMarket = money(cashAfterMilk - marketInvestment);
  const minimumAdvanceCash = Math.min(openingFunds, cashAfterMachine, cashAfterMilk, cashAfterMarket);
  const seasonEndCosts = money(
    rent + maintenance + transport + numeric(estimates.salary) + bonus + bankPayment + tax
  );
  const closingCash = money(cashAfterMarket + revenue - seasonEndCosts);
  const closingDebt = money(
    numeric(company.unpaidLoanPrincipal) - existingPrincipalPayment + borrowing - newPrincipalPayment
  );

  if (minimumAdvanceCash < 0) {
    addIssue(issues, "error", "Cash falls below zero during advance payments.");
  }
  if (closingCash < 0) addIssue(issues, "error", "Closing cash is negative.");
  if (actualSales < production) addIssue(issues, "warning", `${whole(production - actualSales).toLocaleString()} units spoil at season end.`);
  if (milkTons - production / numeric(estimates.yieldPerTon) > 0.00001) {
    addIssue(issues, "warning", "Unused milk spoils at season end; its cost is already included once.");
  }

  return {
    production,
    actualSales,
    salesRequest,
    installedCapacity,
    milkCapacity,
    unusedMilkTons: money(Math.max(0, milkTons - production / numeric(estimates.yieldPerTon))),
    spoiledUnits: whole(Math.max(0, production - actualSales)),
    revenue,
    milkCost,
    maintenance,
    depreciation,
    purchaseCost,
    rent,
    transport,
    marketInvestment,
    grossProfit,
    bonus,
    salary: money(estimates.salary),
    interest,
    profitBeforeTax,
    lossPoolUsed,
    taxableProfit,
    tax,
    netProfit,
    closingTaxLoss,
    borrowing,
    bankPayment,
    closingDebt,
    openingFunds,
    cashAfterMachine,
    cashAfterMilk,
    cashAfterMarket,
    minimumAdvanceCash,
    closingCash,
    premiseCapacity,
    premiseMachineCount,
    issues,
    feasible: !issues.some((issue) => issue.level === "error")
  };
}

export function officialExample(estimates = defaultEstimates) {
  const company = {
    closingCash: 100000,
    year1AnnualProfit: 0,
    taxLossPool: 0,
    unpaidLoanPrincipal: 0,
    existingPrincipalPayment: 0,
    ownedMachines: [
      { type: "", remainingLife: 0 },
      { type: "", remainingLife: 0 }
    ]
  };
  const plan = {
    name: "Official worked example",
    premises: [
      { code: "B", production: 40000, actualSales: 40000 },
      { code: "", production: 0, actualSales: 0 }
    ],
    ownedAssignments: ["idle", "idle"],
    newMachineType: "5",
    newMachineAssignment: "p1",
    milkTons: 2,
    salesRequest: 40000,
    marketInvestment: 1000,
    newBorrowing: 0,
    loanTerm: 4
  };
  return calculatePlan(company, plan, estimates);
}

export function comparePlans(results) {
  const [a, b] = results;
  if (!a || !b) return { winner: null, message: "Enter both plans to compare them." };
  if (a.feasible && !b.feasible) {
    return { winner: 0, message: "Lean winter is the only plan that passes the cash and operating checks." };
  }
  if (!a.feasible && b.feasible) {
    return { winner: 1, message: "Capacity bet is the only plan that passes the cash and operating checks." };
  }
  if (!a.feasible && !b.feasible) {
    return { winner: null, message: "Neither plan is financeable yet. Repair the red checks before choosing." };
  }
  const winner = b.netProfit > a.netProfit ? 1 : 0;
  const other = winner === 0 ? 1 : 0;
  const profitGap = Math.abs(results[winner].netProfit - results[other].netProfit);
  const cashGap = results[winner].closingCash - results[other].closingCash;
  const winnerName = winner === 0 ? "Lean winter" : "Capacity bet";
  return {
    winner,
    message: `${winnerName} produces Sh ${whole(profitGap).toLocaleString()} more net profit under the entered sales allocation and closes with ${cashGap >= 0 ? "Sh " + whole(cashGap).toLocaleString() + " more cash" : "Sh " + whole(Math.abs(cashGap)).toLocaleString() + " less cash"}.`
  };
}

export function sensitivity(plan, company, estimates = defaultEstimates, salesLevels = [0, 20000, 40000, 60000, 80000, 100000]) {
  const productionByPremise = plan.premises.map((row) => numeric(row.production));
  const totalProduction = productionByPremise.reduce((sum, value) => sum + value, 0);
  return salesLevels.map((level) => {
    let remaining = Math.min(level, totalProduction, numeric(plan.salesRequest));
    const premises = plan.premises.map((row, index) => {
      const share = totalProduction > 0 ? productionByPremise[index] / totalProduction : 0;
      const allocated = index === plan.premises.length - 1 ? remaining : Math.min(remaining, Math.round(level * share));
      remaining -= allocated;
      return { ...row, actualSales: Math.max(0, allocated) };
    });
    const result = calculatePlan(company, { ...plan, premises }, estimates);
    return { sales: Math.min(level, totalProduction, numeric(plan.salesRequest)), netProfit: result.netProfit, closingCash: result.closingCash };
  });
}
