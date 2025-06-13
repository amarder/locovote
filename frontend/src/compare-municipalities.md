---
title: Compare Municipalities
toc: true
---

# Compare Municipalities

This tool allows you to compare the financial health and tax burden of different Massachusetts municipalities over time. Use the search box below to select municipalities and explore how they differ in spending priorities, revenue sources, tax rates, and budget management.

<div class="tip" label="Key Questions This Tool Answers">

- **What does my municipality spend its money on?** See the breakdown of expenditures by category and how priorities have changed over time.
- **Where does my municipality get its money from?** Understand the revenue mix, including property taxes, state aid, and other sources.
- **How much does it cost to live in my municipality?** Compare residential property tax rates across communities.
- **Is my municipality balancing its budget?** Track budget surpluses and deficits to assess financial stability.
- **How many people live there?** View population trends that affect per-capita spending and revenue needs.

</div>

### Select Municipalities to Compare

Choose multiple municipalities to compare their financial profiles. Popular comparisons include similar-sized communities, neighboring towns, or places you're considering moving to.

```js
import {searchCheckbox} from "./components/search-select.js"
import * as Plot from "npm:@observablehq/plot";
import * as Inputs from "npm:@observablehq/inputs";
import * as aq from "npm:arquero";
```

```js
const arrowData = FileAttachment("./data/municipalities.arrow").arrow();
```

```js
const data = [...arrowData].filter(d => {
  const fiscalYear = Number(d["Fiscal Year"]);
  return fiscalYear >= 2003 && fiscalYear <= 2024;
});
const names = [...new Set(data.map(d => d.Municipality))].sort();
```

```js
const selected = view(searchCheckbox(names, { urlParam: "municipalities", value: ["Boston", "Cambridge"]}));
```

```js
// Filter data for selected municipalities
const filteredData = data.filter(d => selected.includes(d.Municipality));

// Population Over Time (by municipality)
const populationChart = filteredData.length > 0 ? Plot.plot({
  title: "Population",
  width: 830,
  height: 400,
  x: {
    label: "Year",
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
}) : html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
  <p style="color: #666; margin: 0;">Select municipalities to view population trends</p>
</div>`;

// Helper function to safely convert values
const convertValue = (value) => {
  if (typeof value === 'bigint') return Number(value);
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
};

// Convert data to Arquero table and calculate revenue percentages
const revenueTable = filteredData.length > 0 ? aq.from(filteredData)
  .derive({
    // Calculate total revenue for each row
    total_revenue: aq.escape(d => Object.keys(d)
      .filter(key => key.startsWith('gf_rev_'))
      .reduce((sum, key) => sum + (typeof d[key] === 'bigint' ? Number(d[key]) : Number(d[key]) || 0), 0))
  })
  .filter(d => d.total_revenue > 0) : aq.table({});

// Get all revenue field names
const allRevenueFields = Object.keys(filteredData[0] || {}).filter(key => key.startsWith('gf_rev_'));

// Get all levy field names
const allLevyFields = Object.keys(filteredData[0] || {}).filter(key => key.startsWith('levy_'));

// Create long-form revenue data with percentages
const percentageRevenueData = [];
revenueTable.objects().forEach(row => {
  const levyFields = allLevyFields.filter(field => convertValue(row[field]) > 0);
  
  if (levyFields.length > 0) {
    // Has levy data - break down taxes into components
    
    // Add non-tax revenue fields
    allRevenueFields
      .filter(field => field !== 'gf_rev_Taxes')
      .forEach(field => {
        const value = convertValue(row[field]);
        if (value > 0) {
          const label = field.replace('gf_rev_', '').replace(/_/g, ' ');
          percentageRevenueData.push({
            Municipality: row.Municipality,
            "Fiscal Year": row["Fiscal Year"],
            Category: label,
            Value: value,
            Percentage: (value / row.total_revenue) * 100
          });
        }
      });
    
    // Add individual levy fields
    levyFields.forEach(field => {
      const value = convertValue(row[field]);
      const label = field.replace('levy_', '').replace(/_/g, ' ');
      percentageRevenueData.push({
        Municipality: row.Municipality,
        "Fiscal Year": row["Fiscal Year"],
        Category: label,
        Value: value,
        Percentage: (value / row.total_revenue) * 100
      });
    });
    
    // Calculate and add "Other Taxes" if there's a difference
    const totalTaxes = convertValue(row['gf_rev_Taxes']);
    const totalLevies = levyFields.reduce((sum, field) => sum + convertValue(row[field]), 0);
    const otherTaxes = totalTaxes - totalLevies;
    
    if (otherTaxes > 0) {
      percentageRevenueData.push({
        Municipality: row.Municipality,
        "Fiscal Year": row["Fiscal Year"],
        Category: "Non-Levy Taxes",
        Value: otherTaxes,
        Percentage: (otherTaxes / row.total_revenue) * 100
      });
    }
    
  } else {
    // No levy data - use all gf_rev_ fields as-is
    allRevenueFields.forEach(field => {
      const value = convertValue(row[field]);
      if (value > 0) {
        const label = field.replace('gf_rev_', '').replace(/_/g, ' ');
        percentageRevenueData.push({
          Municipality: row.Municipality,
          "Fiscal Year": row["Fiscal Year"],
          Category: label,
          Value: value,
          Percentage: (value / row.total_revenue) * 100
        });
      }
    });
  }
});

// Convert data to Arquero table and calculate expenditure percentages
const expenditureTable = filteredData.length > 0 ? aq.from(filteredData)
  .derive({
    // Calculate total expenditures for each row
    total_expenditures: aq.escape(d => Object.keys(d)
      .filter(key => key.startsWith('gf_exp_'))
      .reduce((sum, key) => sum + (typeof d[key] === 'bigint' ? Number(d[key]) : Number(d[key]) || 0), 0))
  })
  .filter(d => d.total_expenditures > 0) : aq.table({});

// Get all expenditure field names
const allExpenditureFields = Object.keys(filteredData[0] || {}).filter(key => key.startsWith('gf_exp_'));

// Create long-form expenditure data with percentages
const percentageExpenditureData = [];
expenditureTable.objects().forEach(row => {
  allExpenditureFields.forEach(field => {
    const value = convertValue(row[field]);
    if (value > 0) {
      const label = field.replace('gf_exp_', '').replace(/_/g, ' ');
      percentageExpenditureData.push({
        Municipality: row.Municipality,
        "Fiscal Year": row["Fiscal Year"],
        Category: label,
        Value: value,
        Percentage: (value / row.total_expenditures) * 100
      });
    }
  });
});

// Debug: Verify percentages sum to 100% using Arquero
const revenueCheck = percentageRevenueData.length > 0 ? 
  aq.from(percentageRevenueData)
    .groupby('Municipality', 'Fiscal Year')
    .rollup({ 
      total_percentage: d => aq.op.sum(d.Percentage),
      categories: d => aq.op.array_agg(d.Category)
    })
    .filter(d => Math.abs(d.total_percentage - 100) > 0.1) :
  aq.table({});

const expenditureCheck = percentageExpenditureData.length > 0 ?
  aq.from(percentageExpenditureData)
    .groupby('Municipality', 'Fiscal Year')
    .rollup({ 
      total_percentage: d => aq.op.sum(d.Percentage),
      categories: d => aq.op.array_agg(d.Category)
    })
    .filter(d => Math.abs(d.total_percentage - 100) > 0.1) :
  aq.table({});

/*
console.log("=== ARQUERO REVENUE PERCENTAGE DEBUG ===");
if (revenueCheck.numRows() > 0) {
  console.log("Revenue percentages not summing to 100%:");
  console.log(revenueCheck.objects());
} else {
  console.log("All revenue percentages sum to ~100% ✓");
}

console.log("=== ARQUERO EXPENDITURE PERCENTAGE DEBUG ===");
if (expenditureCheck.numRows() > 0) {
  console.log("Expenditure percentages not summing to 100%:");
  console.log(expenditureCheck.objects());
} else {
  console.log("All expenditure percentages sum to ~100% ✓");
}
*/

// Calculate top 5 revenue categories by total value
const revenueTotals = {};
percentageRevenueData.forEach(d => {
  if (!revenueTotals[d.Category]) revenueTotals[d.Category] = 0;
  revenueTotals[d.Category] += d.Value;
});
const top5RevenueCategories = Object.entries(revenueTotals)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([category,]) => category);

const filteredRevenueData = percentageRevenueData.filter(d => top5RevenueCategories.includes(d.Category));
const revenuePercentageChart = filteredRevenueData.length > 0 ? Plot.plot({
  title: "Revenue Composition - Top 5 Categories",
  width: 830,
  height: 400,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Percentage of Total Revenue (%)",
    grid: true,
    domain: [0, 100]
  },
  fx: {
    label: "",
    domain: top5RevenueCategories
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    Plot.line(filteredRevenueData, {
      x: "Fiscal Year",
      y: "Percentage",
      fx: "Category",
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\n${d.Category}\n${d["Fiscal Year"]}: ${d.Percentage.toFixed(1)}% ($${(d.Value / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M)`
    }),
    Plot.dot(filteredRevenueData, {
      x: "Fiscal Year",
      y: "Percentage",
      fx: "Category",
      fill: "Municipality",
      r: 3,
      title: d => `${d.Municipality}\n${d.Category}\n${d["Fiscal Year"]}: ${d.Percentage.toFixed(1)}% ($${(d.Value / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M)`
    })
  ]
}) : html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
  <p style="color: #666; margin: 0;">Select municipalities to view revenue composition</p>
</div>`;

// Calculate top 5 expenditure categories by total value
const expenditureTotals = {};
percentageExpenditureData.forEach(d => {
  if (!expenditureTotals[d.Category]) expenditureTotals[d.Category] = 0;
  expenditureTotals[d.Category] += d.Value;
});
const top5ExpenditureCategories = Object.entries(expenditureTotals)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([category,]) => category);

const filteredExpenditureData = percentageExpenditureData.filter(d => top5ExpenditureCategories.includes(d.Category));
const expenditurePercentageChart = filteredExpenditureData.length > 0 ? Plot.plot({
  title: "Expenditure Composition - Top 5 Categories",
  width: 830,
  height: 400,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Percentage of Total Expenditures (%)",
    grid: true,
    domain: [0, 100]
  },
  fx: {
    label: "",
    domain: top5ExpenditureCategories
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    Plot.line(filteredExpenditureData, {
      x: "Fiscal Year",
      y: "Percentage",
      fx: "Category",
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\n${d.Category}\n${d["Fiscal Year"]}: ${d.Percentage.toFixed(1)}% ($${(d.Value / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M)`
    }),
    Plot.dot(filteredExpenditureData, {
      x: "Fiscal Year",
      y: "Percentage",
      fx: "Category",
      fill: "Municipality",
      r: 3,
      title: d => `${d.Municipality}\n${d.Category}\n${d["Fiscal Year"]}: ${d.Percentage.toFixed(1)}% ($${(d.Value / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M)`
    })
  ]
}) : html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
  <p style="color: #666; margin: 0;">Select municipalities to view expenditure composition</p>
</div>`;

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

const surplusChart = budgetData.length > 0 ? Plot.plot({
  title: "Budget Surplus",
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
}) : html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
  <p style="color: #666; margin: 0;">Select municipalities to view budget surplus</p>
</div>`;

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
const rateChart = taxRateData.length > 0 ? Plot.plot({
  title: "Tax Rates",
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
    x: "Rate Type",
    label: ""
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
}) : html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
  <p style="color: #666; margin: 0;">Select municipalities to view tax rates</p>
</div>`;
```

## Spending Priorities

The chart below shows what percentage of each municipality's budget goes to different spending categories. Education typically represents the largest expense for most communities. Notice how priorities can vary significantly between communities of different sizes and characteristics.

<div class="card">${expenditurePercentageChart}</div>

## Revenue Sources

This chart breaks down how municipalities fund their operations. Property taxes usually make up the largest share, but the mix varies considerably. Communities with more commercial and industrial property typically have lower residential tax rates.

<div class="card">${revenuePercentageChart}</div>

## Cost of Living

Property tax rates show how much residents pay per $1,000 of their home's assessed value. These rates reflect both the community's spending levels and the strength of its tax base. A community with expensive commercial property or high property values can often maintain lower residential tax rates while still funding quality services.

**Note:** Rates shown include residential, commercial, industrial, personal property, and open space categories. Many communities use the same rate for all property types, while others set different rates to shift tax burden between residential and commercial properties.

<div class="card">${rateChart}</div>

## Financial Health

This chart shows whether municipalities are running budget surpluses (spending less than they take in) or deficits (spending more than their revenue). Consistent deficits may indicate financial stress, while large surpluses might suggest opportunities for increased services or tax relief. Small fluctuations are normal, but dramatic swings can signal budget management challenges.

<div class="card">${surplusChart}</div>

## Population Trends

Population growth or decline affects municipal finances in multiple ways. Growing communities often face pressure to expand services and infrastructure, while shrinking communities may struggle with fixed costs spread across fewer residents. Understanding population trends helps explain changes in per-capita spending and revenue needs.

<div class="card">${populationChart}</div>

## Next Steps

Want to dive deeper into a specific municipality's finances? Visit our [detailed municipal profiles page](/municipalities) to see comprehensive financial data, including historical trends, debt levels, and detailed budget breakdowns for individual communities.
