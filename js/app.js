import {
  calculatePlan,
  comparePlans,
  defaultCompany,
  defaultEstimates,
  defaultPlans,
  officialExample,
  sensitivity
} from "./model.js";

const STORAGE_KEY = "pork-garlic-year2-decision-v1";
const clone = (value) => structuredClone(value);

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.company && saved?.plans && saved?.estimates) return saved;
  } catch {
    // A clean example is safer than partially parsed saved state.
  }
  return { company: clone(defaultCompany), plans: clone(defaultPlans), estimates: clone(defaultEstimates) };
}

let state = loadState();
let results = [];

const byId = (id) => document.getElementById(id);
const number = (value) => Number(value) || 0;
const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const formatMoney = (value) => {
  const amount = Math.round(Number(value) || 0);
  return amount < 0 ? `Sh (${Math.abs(amount).toLocaleString("en-US")})` : `Sh ${amount.toLocaleString("en-US")}`;
};
const signedMoney = (value) => {
  const amount = Math.round(Number(value) || 0);
  if (amount === 0) return "Sh 0";
  return `${amount > 0 ? "+" : "−"} Sh ${Math.abs(amount).toLocaleString("en-US")}`;
};
const option = (value, label, selected) => `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${label}</option>`;
const machineOptions = (selected, includeNone = true) => `${includeNone ? option("", "None", selected) : ""}${Object.keys(state.estimates.machines).map((key) => option(key, `Machine ${key}`, selected)).join("")}`;
const premiseOptions = (selected) => `${option("", "No premise", selected)}${Object.keys(state.estimates.premises).map((key) => option(key, `Premise ${key}`, selected)).join("")}`;
const assignmentOptions = (selected) => [
  option("idle", "Idle / not installed", selected),
  option("p1", "Install at premise 1", selected),
  option("p2", "Install at premise 2", selected)
].join("");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function inputField({ label, value, bind, step = 1, min = 0, type = "number", suffix = "" }) {
  return `<label class="field"><span>${label}${suffix}</span><input type="${type}" value="${value}" min="${min}" step="${step}" data-bind="${bind}"></label>`;
}

function renderCompany() {
  const machineRows = state.company.ownedMachines.map((machine, index) => {
    const spec = state.estimates.machines[machine.type];
    const note = spec ? `${formatNumber(spec.capacity)} units capacity · ${formatMoney(spec.maintenance)} maintenance/season` : "Leave as None if no second machine is owned";
    return `<div class="machine-position">
      <div class="row-title">Owned machine ${index + 1}<span class="row-note">${note}</span></div>
      <label class="compact-field"><span>Machine type</span><select data-bind="company.ownedMachines.${index}.type">${machineOptions(machine.type)}</select></label>
      <label class="compact-field"><span>Remaining life (seasons)</span><input type="number" min="0" max="8" step="1" value="${machine.remainingLife}" data-bind="company.ownedMachines.${index}.remainingLife"></label>
    </div>`;
  }).join("");

  byId("company-position").innerHTML = `<div class="field-grid">
    ${inputField({ label: "Closing cash after Y1 autumn (Sh)", value: state.company.closingCash, bind: "company.closingCash", step: 1000 })}
    ${inputField({ label: "Year 1 annual profit (Sh)", value: state.company.year1AnnualProfit, bind: "company.year1AnnualProfit", step: 1000, min: -9999999 })}
    ${inputField({ label: "Unused tax losses (Sh)", value: state.company.taxLossPool, bind: "company.taxLossPool", step: 1000 })}
    ${inputField({ label: "Unpaid loans (Sh)", value: state.company.unpaidLoanPrincipal, bind: "company.unpaidLoanPrincipal", step: 1000 })}
    ${inputField({ label: "Existing principal due this season (Sh)", value: state.company.existingPrincipalPayment, bind: "company.existingPrincipalPayment", step: 1000 })}
  </div>${machineRows}`;
}

function renderPremiseRow(planIndex, rowIndex, row, result) {
  const capacity = result?.premiseCapacity?.[rowIndex] || 0;
  const machineCount = result?.premiseMachineCount?.[rowIndex] || 0;
  return `<div class="premise-row">
    <label class="compact-field"><span>Premise ${rowIndex + 1}</span><select data-bind="plans.${planIndex}.premises.${rowIndex}.code">${premiseOptions(row.code)}</select></label>
    <label class="compact-field"><span>Production · cap ${formatNumber(capacity)}</span><input type="number" min="0" step="10000" value="${row.production}" data-bind="plans.${planIndex}.premises.${rowIndex}.production"></label>
    <label class="compact-field"><span>Actual sales allocated</span><input type="number" min="0" step="10000" value="${row.actualSales}" data-bind="plans.${planIndex}.premises.${rowIndex}.actualSales"></label>
    <span class="row-note">${machineCount} installed machine${machineCount === 1 ? "" : "s"}</span>
  </div>`;
}

function breakdownTable(result) {
  const rows = [
    ["Revenue", result.revenue],
    ["Milk purchased", -result.milkCost],
    ["Machine maintenance", -result.maintenance],
    ["Depreciation", -result.depreciation],
    ["Gross profit", result.grossProfit, "total"],
    ["Transport", -result.transport],
    ["Market investment", -result.marketInvestment],
    ["Bonus", -result.bonus],
    ["Salaries", -result.salary],
    ["Premise rent", -result.rent],
    ["Loan interest", -result.interest],
    ["Profit before tax", result.profitBeforeTax, "total"],
    ["Game tax", -result.tax],
    ["Net profit / (loss)", result.netProfit, "total"]
  ];
  return `<table class="data-table"><thead><tr><th>Profit and loss</th><th>Sh</th></tr></thead><tbody>${rows.map(([label, value, kind]) => `<tr class="${kind || ""}"><td>${label}</td><td class="${value < 0 ? "negative" : value > 0 && kind ? "positive" : ""}">${signedMoney(value)}</td></tr>`).join("")}</tbody></table>
  <table class="data-table"><thead><tr><th>Cash checkpoint</th><th>Sh</th></tr></thead><tbody>
    <tr><td>Opening cash + new loan</td><td>${formatMoney(result.openingFunds)}</td></tr>
    <tr><td>After machine purchase</td><td>${formatMoney(result.cashAfterMachine)}</td></tr>
    <tr><td>After milk purchase</td><td>${formatMoney(result.cashAfterMilk)}</td></tr>
    <tr><td>After market investment</td><td>${formatMoney(result.cashAfterMarket)}</td></tr>
    <tr><td>Bank payment at season end</td><td>${formatMoney(result.bankPayment)}</td></tr>
    <tr class="total"><td>Closing cash</td><td>${formatMoney(result.closingCash)}</td></tr>
  </tbody></table>`;
}

function renderPlan(plan, planIndex, result) {
  const ownedAssignments = state.company.ownedMachines.map((machine, index) => {
    const machineName = machine.type ? `Owned machine ${index + 1} · Type ${machine.type}` : `Owned machine ${index + 1} · None`;
    return `<div class="assignment-row"><div class="machine-label">${machineName}</div><label class="compact-field"><span>Use</span><select data-bind="plans.${planIndex}.ownedAssignments.${index}" ${machine.type ? "" : "disabled"}>${assignmentOptions(plan.ownedAssignments[index])}</select></label></div>`;
  }).join("");
  const issueHtml = result.issues.length
    ? result.issues.map((issue) => `<li class="issue ${issue.level}">${issue.message}</li>`).join("")
    : `<li class="issue success">Plan passes the operating, debt and cash checks.</li>`;

  return `<article class="plan-card">
    <div class="plan-header"><span class="plan-letter">${planIndex === 0 ? "A" : "B"}</span><input class="name-input" aria-label="Plan ${planIndex === 0 ? "A" : "B"} name" type="text" value="${plan.name}" data-bind="plans.${planIndex}.name"></div>
    <div class="subsection"><p class="subsection-title">Premises, production and trainer allocation</p>${plan.premises.map((row, rowIndex) => renderPremiseRow(planIndex, rowIndex, row, result)).join("")}</div>
    <div class="subsection"><p class="subsection-title">Machine use</p>${ownedAssignments}
      <div class="assignment-row"><label class="compact-field"><span>New machine estimate</span><select data-bind="plans.${planIndex}.newMachineType">${machineOptions(plan.newMachineType)}</select></label><label class="compact-field"><span>Install</span><select data-bind="plans.${planIndex}.newMachineAssignment" ${plan.newMachineType ? "" : "disabled"}>${assignmentOptions(plan.newMachineAssignment)}</select></label></div>
    </div>
    <div class="subsection"><p class="subsection-title">Season inputs</p><div class="small-fields three">
      ${inputField({ label: "Milk (tons)", value: plan.milkTons, bind: `plans.${planIndex}.milkTons`, step: 1 })}
      ${inputField({ label: "Sales request (units)", value: plan.salesRequest, bind: `plans.${planIndex}.salesRequest`, step: 10000 })}
      ${inputField({ label: "Market investment (Sh)", value: plan.marketInvestment, bind: `plans.${planIndex}.marketInvestment`, step: 1000 })}
      ${inputField({ label: "New borrowing (Sh)", value: plan.newBorrowing, bind: `plans.${planIndex}.newBorrowing`, step: 1000 })}
      <label class="field"><span>Repayment term (seasons)</span><input type="number" min="1" max="8" step="1" value="${plan.loanTerm}" data-bind="plans.${planIndex}.loanTerm"></label>
    </div></div>
    <div class="result-strip">
      <div class="result-card"><span>Net profit / loss</span><strong>${formatMoney(result.netProfit)}</strong></div>
      <div class="result-card"><span>Closing cash</span><strong>${formatMoney(result.closingCash)}</strong></div>
      <div class="result-card light"><span>Lowest advance cash</span><strong>${formatMoney(result.minimumAdvanceCash)}</strong></div>
      <div class="result-card light"><span>Closing debt</span><strong>${formatMoney(result.closingDebt)}</strong></div>
    </div>
    <ul class="issue-list">${issueHtml}</ul>
    <details class="breakdown"><summary>Show profit and cash detail</summary>${breakdownTable(result)}</details>
  </article>`;
}

function renderPlans() {
  results = state.plans.map((plan) => calculatePlan(state.company, plan, state.estimates));
  byId("plan-grid").innerHTML = state.plans.map((plan, index) => renderPlan(plan, index, results[index])).join("");
}

function metricClass(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "";
}

function downsideResult(plan, index) {
  const reduced = clone(plan);
  reduced.premises = reduced.premises.map((row) => ({ ...row, actualSales: Math.round(number(row.actualSales) * 0.8) }));
  return calculatePlan(state.company, reduced, state.estimates);
}

function chartSvg() {
  const maxRequest = Math.max(...state.plans.map((plan) => number(plan.salesRequest)), 40000);
  const levels = Array.from({ length: 6 }, (_, index) => Math.round((maxRequest * index) / 5 / 10000) * 10000);
  const series = state.plans.map((plan) => sensitivity(plan, state.company, state.estimates, levels));
  const allValues = series.flatMap((rows) => rows.map((row) => row.netProfit));
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const range = max - min || 1;
  const x = (index) => 50 + (index / (levels.length - 1)) * 410;
  const y = (value) => 165 - ((value - min) / range) * 125;
  const colors = ["#2f6255", "#c96c36"];
  const paths = series.map((rows, seriesIndex) => `<polyline fill="none" stroke="${colors[seriesIndex]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${rows.map((row, index) => `${x(index)},${y(row.netProfit)}`).join(" ")}"/>${rows.map((row, index) => `<circle cx="${x(index)}" cy="${y(row.netProfit)}" r="4" fill="${colors[seriesIndex]}"/>`).join("")}`).join("");
  const zeroY = y(0);
  return `<svg viewBox="0 0 500 210" role="img" aria-label="Net profit sensitivity by trainer sales allocation">
    <line x1="50" x2="460" y1="${zeroY}" y2="${zeroY}" stroke="#9aa7a1" stroke-dasharray="4 5"/>
    <line x1="50" x2="50" y1="35" y2="165" stroke="#c9d1cc"/>
    <line x1="50" x2="460" y1="165" y2="165" stroke="#c9d1cc"/>
    <text x="50" y="24" fill="#60706a" font-size="12">Net profit</text>
    <text x="455" y="195" text-anchor="end" fill="#60706a" font-size="12">Actual sales</text>
    <text x="42" y="${Math.max(45, Math.min(162, zeroY + 4))}" text-anchor="end" fill="#60706a" font-size="10">0</text>
    ${levels.map((level, index) => `<text x="${x(index)}" y="182" text-anchor="middle" fill="#60706a" font-size="10">${formatNumber(level / 1000)}k</text>`).join("")}
    ${paths}
  </svg>`;
}

function renderComparison() {
  const decision = comparePlans(results);
  const winnerName = decision.winner === null ? "Revise the plans" : state.plans[decision.winner].name;
  const assumption = decision.winner === null
    ? "Main assumption: both plans still need valid operating and cash inputs."
    : `Main assumption: the trainer allocates ${formatNumber(results[decision.winner].actualSales)} sales to ${winnerName}; a lower allocation reduces revenue immediately while milk and market spending stay fixed.`;
  const downside = state.plans.map(downsideResult);
  const bridgeRows = [
    ["Actual sales", "actualSales", false],
    ["Spoiled units", "spoiledUnits", false],
    ["Revenue", "revenue", true],
    ["Milk cost", "milkCost", true],
    ["Machine purchase", "purchaseCost", true],
    ["Rent", "rent", true],
    ["Transport", "transport", true],
    ["Market investment", "marketInvestment", true],
    ["Interest", "interest", true],
    ["Net profit", "netProfit", true],
    ["Closing cash", "closingCash", true]
  ];
  byId("comparison").innerHTML = `<div class="recommendation">
    <div class="recommendation-icon" aria-hidden="true">✓</div>
    <div><p class="eyebrow">Recommendation</p><h3>${winnerName}</h3><p>${decision.message}</p><p class="assumption">${assumption}</p></div>
  </div>
  <div class="comparison-grid">
    <div class="comparison-panel"><h3>What changes between the plans</h3><p class="panel-intro">Positive differences mean Plan B is higher than Plan A.</p>
      <table class="data-table"><thead><tr><th>Line</th><th>${state.plans[0].name}</th><th>${state.plans[1].name}</th><th>B − A</th></tr></thead><tbody>${bridgeRows.map(([label, key, monetary]) => {
        const a = results[0][key]; const b = results[1][key]; const delta = b - a;
        return `<tr class="${key === "netProfit" || key === "closingCash" ? "total" : ""}"><td>${label}</td><td>${monetary ? formatMoney(a) : formatNumber(a)}</td><td>${monetary ? formatMoney(b) : formatNumber(b)}</td><td class="${metricClass(delta)}">${monetary ? signedMoney(delta) : (delta > 0 ? "+" : "") + formatNumber(delta)}</td></tr>`;
      }).join("")}</tbody></table>
    </div>
    <div class="comparison-panel"><h3>If the trainer allocates 20% fewer sales</h3><p class="panel-intro">All advance choices remain fixed; only actual sales allocations fall.</p>
      <div class="downside-grid">${downside.map((result, index) => `<div class="downside-card"><span>${state.plans[index].name}</span><strong>${formatMoney(result.netProfit)} profit</strong><span>${formatMoney(result.closingCash)} closing cash</span></div>`).join("")}</div>
      <div class="chart-wrap">${chartSvg()}</div>
      <div class="chart-legend"><span><i class="legend-dot" style="background:#2f6255"></i>${state.plans[0].name}</span><span><i class="legend-dot" style="background:#c96c36"></i>${state.plans[1].name}</span></div>
    </div>
  </div>`;
}

function renderReference() {
  const example = officialExample(state.estimates);
  const matches = Math.round(example.netProfit) === -3560 && Math.round(example.closingCash) === 71940;
  byId("reference-example").innerHTML = `<div class="reference-card">
    <div class="reference-story"><p class="eyebrow">Entered Year 1 season</p><h3>Official winter example</h3><p>Start with Sh 100,000; buy Machine 5; rent Premise B; buy 2 tons of milk; produce and sell 40,000 units; invest Sh 1,000; take no loan.</p>
      <table class="data-table"><tbody><tr><td>Gross profit</td><td>${formatMoney(example.grossProfit)}</td></tr><tr><td>Net profit / (loss)</td><td>${formatMoney(example.netProfit)}</td></tr><tr><td>Closing cash</td><td>${formatMoney(example.closingCash)}</td></tr><tr><td>Tax-loss pool created</td><td>${formatMoney(example.closingTaxLoss)}</td></tr></tbody></table>
    </div>
    <div class="validation-stamp"><p class="eyebrow">${matches ? "Reconciled" : "Check estimates"}</p><strong>${matches ? "Matches the rulebook" : "Assumptions changed"}</strong><p>${matches ? "Net loss Sh 3,560 · Closing cash Sh 71,940" : "Reset the example estimates to reproduce the official result."}</p></div>
  </div>`;
}

function renderEstimates() {
  const e = state.estimates;
  byId("estimate-editor").innerHTML = `<div class="estimate-section"><h3>Finance and market</h3><div class="field-grid">
    ${inputField({ label: "Sales price (Sh/unit)", value: e.revenuePerUnit, bind: "estimates.revenuePerUnit", step: 0.1 })}
    ${inputField({ label: "Milk price (Sh/ton)", value: e.milkPrice, bind: "estimates.milkPrice", step: 1000 })}
    ${inputField({ label: "Yield (units/ton)", value: e.yieldPerTon, bind: "estimates.yieldPerTon", step: 1000 })}
    ${inputField({ label: "Salary (Sh/season)", value: e.salary, bind: "estimates.salary", step: 1000 })}
    ${inputField({ label: "Minimum market spend (Sh)", value: e.minimumMarketInvestment, bind: "estimates.minimumMarketInvestment", step: 1000 })}
    ${inputField({ label: "Bonus rate", value: e.bonusRate, bind: "estimates.bonusRate", step: 0.01 })}
    ${inputField({ label: "Tax rate", value: e.taxRate, bind: "estimates.taxRate", step: 0.01 })}
    ${inputField({ label: "Interest per season", value: e.interestRate, bind: "estimates.interestRate", step: 0.01 })}
    ${inputField({ label: "Y2 winter forecast", value: e.year2WinterForecast, bind: "estimates.year2WinterForecast", step: 10000 })}
    ${inputField({ label: "Market swing", value: e.marketSwing, bind: "estimates.marketSwing", step: 0.05 })}
  </div></div>
  <div class="estimate-section"><h3>Premise estimates</h3><table class="estimate-table"><thead><tr><th>Premise</th><th>Slots</th><th>Transport Sh/unit</th><th>Rent Sh/season</th></tr></thead><tbody>${Object.entries(e.premises).map(([code, premise]) => `<tr><td>${code}${premise.storageEstimate ? " · P" : ""}</td><td><input type="number" min="1" step="1" value="${premise.slots}" data-bind="estimates.premises.${code}.slots"></td><td><input type="number" min="0" step="0.1" value="${premise.transport}" data-bind="estimates.premises.${code}.transport"></td><td><input type="number" min="0" step="1000" value="${premise.rent}" data-bind="estimates.premises.${code}.rent"></td></tr>`).join("")}</tbody></table></div>
  <div class="estimate-section"><h3>Machine estimates</h3><table class="estimate-table"><thead><tr><th>Machine</th><th>Capacity</th><th>Purchase Sh</th><th>Maintenance Sh</th></tr></thead><tbody>${Object.entries(e.machines).map(([type, machine]) => `<tr><td>${type}</td><td><input type="number" min="0" step="1000" value="${machine.capacity}" data-bind="estimates.machines.${type}.capacity"></td><td><input type="number" min="0" step="1000" value="${machine.price}" data-bind="estimates.machines.${type}.price"></td><td><input type="number" min="0" step="100" value="${machine.maintenance}" data-bind="estimates.machines.${type}.maintenance"></td></tr>`).join("")}</tbody></table></div>`;
}

function renderForecast() {
  const forecast = number(state.estimates.year2WinterForecast);
  const swing = number(state.estimates.marketSwing);
  byId("forecast-value").textContent = formatNumber(forecast);
  byId("forecast-low").textContent = `${formatNumber(forecast * (1 - swing))} low`;
  byId("forecast-high").textContent = `${formatNumber(forecast * (1 + swing))} high`;
}

function renderAll() {
  renderForecast();
  renderCompany();
  renderPlans();
  renderComparison();
  renderReference();
  renderEstimates();
  saveState();
}

function setPath(path, value) {
  const parts = path.split(".");
  let target = state;
  parts.slice(0, -1).forEach((part) => { target = target[part]; });
  const key = parts.at(-1);
  target[key] = typeof target[key] === "number" ? number(value) : value;
}

document.addEventListener("change", (event) => {
  const field = event.target.closest("[data-bind]");
  if (!field) return;
  setPath(field.dataset.bind, field.value);
  renderAll();
});

byId("reset-button").addEventListener("click", () => {
  state = { company: clone(defaultCompany), plans: clone(defaultPlans), estimates: clone(defaultEstimates) };
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

renderAll();
