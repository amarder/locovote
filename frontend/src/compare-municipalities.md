# Compare Municipalities

```js
import {searchCheckbox} from "./components/search-select.js"
import * as Plot from "npm:@observablehq/plot";
import * as Inputs from "npm:@observablehq/inputs";
```

```js
const arrowData = FileAttachment("./data/municipalities.arrow").arrow();
```

```js
const data = [...arrowData];
const names = [...new Set(data.map(d => d.Municipality))].sort();
```

```js
const selected = view(searchCheckbox(names, { urlParam: "municipalities" }));
```

```js
// Filter data for selected municipalities
const filteredData = data.filter(d => selected.includes(d.Municipality));

// Population Over Time (by municipality)
const populationChart = Plot.plot({
  title: "Population Over Time by Municipality",
  width: 830,
  height: 400,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Population (Thousands)",
    grid: true,
    tickFormat: d => d / 1000
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    Plot.line(filteredData, {
      x: "Fiscal Year",
      y: "pop_Population",
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\n${d["Fiscal Year"]}: ${d.pop_Population?.toLocaleString() || 'N/A'}`
    }),
    Plot.dot(filteredData, {
      x: "Fiscal Year",
      y: "pop_Population",
      fill: "Municipality",
      r: 3,
      title: d => `${d.Municipality}\n${d["Fiscal Year"]}: ${d.pop_Population?.toLocaleString() || 'N/A'}`
    })
  ]
});
display(populationChart);

// Budget Surplus Over Time (by municipality)
const budgetData = filteredData.map(d => {
  const revenueFields = Object.keys(d).filter(key => key.startsWith('gf_rev_'));
  const expenditureFields = Object.keys(d).filter(key => key.startsWith('gf_exp_'));
  const totalRevenue = revenueFields.reduce((sum, field) => sum + (typeof d[field] === 'bigint' ? Number(d[field]) : Number(d[field]) || 0), 0);
  const totalExpenditures = expenditureFields.reduce((sum, field) => sum + (typeof d[field] === 'bigint' ? Number(d[field]) : Number(d[field]) || 0), 0);
  const budgetSurplus = totalRevenue - totalExpenditures;
  return {
    Municipality: d.Municipality,
    "Fiscal Year": d["Fiscal Year"],
    "Budget Surplus": budgetSurplus,
    "Total Revenue": totalRevenue,
    "Total Expenditures": totalExpenditures
  };
}).filter(d => d["Total Revenue"] > 0);

const surplusChart = Plot.plot({
  title: "Budget Surplus Over Time by Municipality",
  width: 830,
  height: 400,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Budget Surplus (Millions $)",
    grid: true,
    tickFormat: d => d / 1_000_000
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    Plot.ruleY([0], {stroke: "gray", strokeDasharray: "3,3"}),
    Plot.line(budgetData, {
      x: "Fiscal Year",
      y: "Budget Surplus",
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\n${d["Fiscal Year"]}: ${d["Budget Surplus"]}`
    }),
    Plot.dot(budgetData, {
      x: "Fiscal Year",
      y: "Budget Surplus",
      fill: "Municipality",
      r: 3,
      title: d => {
        const surplus = d["Budget Surplus"];
        const type = surplus >= 0 ? "Surplus" : "Deficit";
        return `${d.Municipality}\n${d["Fiscal Year"]}: ${type} of $${Math.abs(surplus / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M`;
      }
    })
  ]
});
display(surplusChart);

// Tax Rates Over Time (by municipality, all rate types)
const rateTypes = [
  { field: 'rate_Residential', label: 'Residential' },
  { field: 'rate_Commercial', label: 'Commercial' },
  { field: 'rate_Industrial', label: 'Industrial' },
  { field: 'rate_Personal Property', label: 'Personal Property' },
  { field: 'rate_Open Space', label: 'Open Space' }
];
const taxRateData = filteredData.flatMap(d =>
  rateTypes
    .filter(rate => d[rate.field] != null)
    .map(rate => ({
      Municipality: d.Municipality,
      "Fiscal Year": d["Fiscal Year"],
      "Rate Type": rate.label,
      "Tax Rate": d[rate.field]
    }))
);
const rateChart = Plot.plot({
  title: "Tax Rates Over Time by Municipality",
  width: 830,
  height: 400,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Tax Rate ($ per $1,000 assessed value)",
    grid: true
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  facet: {
    data: taxRateData,
    x: "Rate Type"
  },
  marks: [
    Plot.line(taxRateData, {
      x: "Fiscal Year",
      y: "Tax Rate",
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\n${d["Rate Type"]}\n${d["Fiscal Year"]}: $${d["Tax Rate"]?.toFixed(2) || 'N/A'} per $1,000`
    }),
    Plot.dot(taxRateData, {
      x: "Fiscal Year",
      y: "Tax Rate",
      fill: "Municipality",
      r: 2.5,
      title: d => `${d.Municipality}\n${d["Rate Type"]}\n${d["Fiscal Year"]}: $${d["Tax Rate"]?.toFixed(2) || 'N/A'} per $1,000`
    })
  ]
});
display(rateChart);
```