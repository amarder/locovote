---
title: General Fund
---

# General Fund

The Massachusetts Department of Revenue's Division of Local Services maintains detailed financial data for all municipalities in the state through Schedule A reports. These reports track both revenues and expenditures across major categories in each municipality's general fund.

```js
import {sankey, sankeyLinkHorizontal} from "npm:d3-sankey@0.12"
import {SankeyChart} from "./components/sankey.js"
```

The general fund data includes annual expenditures broken down into categories like:
- General Government
- Public Safety
- Education 
- Public Works
- Human Services
- Culture and Recreation
- Fixed Costs
- Intergov Assessments
- Other Expenditures
- Debt Service

And revenue sources including:
- Taxes
- Service Charges 
- Licenses and Permits
- Federal Revenue
- State Revenue
- Revenue from Other Governments
- Special Assessments
- Fines and Forfeitures
- Miscellaneous
- Other Financing Sources
- Transfers

This data allows us to analyze spending patterns and revenue sources across Massachusetts cities and towns over time. Select a variable and municipalities below to explore the trends.

## Expenditure and Revenue Trends

```js
// Global helper function to safely convert BigInt to Number
const safeNumber = (value) => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value) || 0;
};
```

```js
const municipalities = FileAttachment("./data/general-fund.arrow").arrow().then(data => 
  Array.from(data).map(d => {
    const convertValue = (value) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (value === null || value === undefined) {
        return 0;
      }
      return Number(value);
    };
    
    return {
      ...d,
      'Fiscal Year': convertValue(d['Fiscal Year']),
      ...Object.fromEntries(
        Object.entries(d).map(([key, value]) => 
          key.startsWith('exp_') || key.startsWith('rev_') ? [key, convertValue(value)] : [key, value]
        )
      )
    };
  })
)
```

```js
const towns = [...new Set((await municipalities).map(d => d.Municipality))];
```

```js
// Get all expenditure and revenue variables
const data = await municipalities;
const variables = Object.keys(data[0])
  .filter(key => key.startsWith('exp_') || key.startsWith('rev_'))
  .map(key => ({
    id: key,
    label: key.replace('exp_', 'Expenditure: ').replace('rev_', 'Revenue: ')
  }))
  .sort((a, b) => a.label.localeCompare(b.label));
```

```js
const selectedVariable = view(Inputs.select(
  variables,
  {
    label: "Select Variable",
    value: variables.find(v => v.id === 'exp_Education'),
    format: v => v.label
  }
))
```

```js
const selectedMunicipalities = view(Inputs.select(
  towns, 
  {
    label: "Select Municipalities", 
    multiple: true, 
    value: ["Weston", "Wayland"],
    sort: true
  }
))
```

```js
const filteredMunicipalities = data.filter(d => selectedMunicipalities.includes(d.Municipality));
```

```js
Plot.plot({
  width: 1000,
  height: 600,
  y: {
    grid: true,
    label: selectedVariable.label,
    domain: [0, d3.max(filteredMunicipalities, d => safeNumber(d[selectedVariable.id])) / 1_000_000],
    transform: d => safeNumber(d) / 1_000_000, // Convert to millions
    tickFormat: "~s"
  },
  x: {
    label: "Fiscal Year",
    tickFormat: d => d.toString()
  },
  marks: [
    Plot.line(filteredMunicipalities, {
      x: "Fiscal Year",
      y: d => safeNumber(d[selectedVariable.id]),
      stroke: "Municipality",
      strokeWidth: 1.5
    }),
    Plot.dot(filteredMunicipalities, {
      x: "Fiscal Year",
      y: d => safeNumber(d[selectedVariable.id]),
      stroke: "Municipality",
      fill: "white",
      tip: true,
      title: d => `${d.Municipality}
Fiscal Year: ${d['Fiscal Year']}
${selectedVariable.label}: $${(safeNumber(d[selectedVariable.id]) / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M`
    })
  ],
  color: {
    legend: true
  },
  caption: `${selectedVariable.label} by municipality over time (in millions of dollars)`
})
```

## Budget Surplus / Deficit

```js
const selectedMunicipalityForSankey = view(Inputs.select(
  towns, 
  {
    label: "Select Municipality for Budget Flow", 
    value: "Weston",
    sort: true
  }
))
```

```js
const availableYears = [...new Set((await municipalities)
  .filter(d => d.Municipality === selectedMunicipalityForSankey)
  .map(d => safeNumber(d['Fiscal Year'])))]
  .sort((a, b) => safeNumber(b) - safeNumber(a));
```

```js
const selectedYear = view(Inputs.select(
  availableYears,
  {
    label: "Select Fiscal Year",
    value: availableYears.length > 0 ? availableYears[0] : null,
    format: d => d.toString()
  }
))
```

```js
const municipalityYearData = data.find(d => 
  d.Municipality === selectedMunicipalityForSankey && 
  safeNumber(d['Fiscal Year']) === safeNumber(selectedYear)
);
```

```js
// Calculate totals and surplus/deficit outside of Sankey data prep
let totalRevenue = 0;
let totalExpenditures = 0;
let surplus = 0;

if (municipalityYearData) {
  // Helper function to convert BigInt to Number
  const convertValue = (value) => {
    if (typeof value === 'bigint') return Number(value);
    if (value === null || value === undefined) return 0;
    return Number(value) || 0;
  };

  const revenueFields = Object.keys(municipalityYearData).filter(key => key.startsWith('rev_'));
  const expenditureFields = Object.keys(municipalityYearData).filter(key => key.startsWith('exp_'));

  const validRevenueFields = revenueFields.filter(field => convertValue(municipalityYearData[field]) > 0);
  const validExpenditureFields = expenditureFields.filter(field => convertValue(municipalityYearData[field]) > 0);

  totalRevenue = validRevenueFields.reduce((sum, field) => sum + convertValue(municipalityYearData[field]), 0);
  totalExpenditures = validExpenditureFields.reduce((sum, field) => sum + convertValue(municipalityYearData[field]), 0);
  surplus = totalRevenue - totalExpenditures;
}
```

```js
// Prepare Sankey data
const sankeyData = {
  nodes: [],
  links: []
};

if (municipalityYearData) {
  // Helper function to convert BigInt to Number
  const convertValue = (value) => {
    if (typeof value === 'bigint') return Number(value);
    if (value === null || value === undefined) return 0;
    return Number(value) || 0;
  };

  const revenueFields = Object.keys(municipalityYearData).filter(key => key.startsWith('rev_'));
  const expenditureFields = Object.keys(municipalityYearData).filter(key => key.startsWith('exp_'));

  const validRevenueFields = revenueFields.filter(field => convertValue(municipalityYearData[field]) > 0);
  const validExpenditureFields = expenditureFields.filter(field => convertValue(municipalityYearData[field]) > 0);

  // 1. Define nodes
  sankeyData.nodes.push({ id: "Total Revenue", category: "total" });
  sankeyData.nodes.push({ id: "Total Expenditures", category: "total" });
  
  validRevenueFields.forEach(field => {
    const label = field.replace('rev_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "revenue" });
  });

  validExpenditureFields.forEach(field => {
    const label = field.replace('exp_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "expenditure" });
  });

  if (surplus > 0) {
    sankeyData.nodes.push({ id: "Budget Surplus", category: "surplus" });
  } else if (surplus < 0) {
    sankeyData.nodes.push({ id: "Budget Deficit", category: "deficit" });
  }

  // 2. Define links based on the rules
  // Rule 1: All revenue sources flow into Total Revenue
  validRevenueFields.forEach(field => {
    const label = field.replace('rev_', '').replace(/_/g, ' ');
    sankeyData.links.push({
      source: label,
      target: "Total Revenue",
      value: convertValue(municipalityYearData[field])
    });
  });

  // Rule 2: Flow from Total Revenue to Total Expenditures
  const flowToExpenditures = Math.min(totalRevenue, totalExpenditures);
  if (flowToExpenditures > 0) {
    sankeyData.links.push({
      source: "Total Revenue",
      target: "Total Expenditures",
      value: flowToExpenditures
    });
  }

  // Rule 3: Handle surplus
  if (surplus > 0) {
    sankeyData.links.push({
      source: "Total Revenue",
      target: "Budget Surplus",
      value: surplus
    });
  }

  // Rule 4: Handle deficit
  if (surplus < 0) {
    sankeyData.links.push({
      source: "Budget Deficit",
      target: "Total Expenditures",
      value: Math.abs(surplus)
    });
  }

  // Rule 5: Flow from Total Expenditures to each expenditure type
  validExpenditureFields.forEach(field => {
    const label = field.replace('exp_', '').replace(/_/g, ' ');
    sankeyData.links.push({
      source: "Total Expenditures",
      target: label,
      value: convertValue(municipalityYearData[field])
    });
  });
}
```

```js
// Display summary
if (municipalityYearData) {
  display(html`
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3>${selectedMunicipalityForSankey} - Fiscal Year ${selectedYear}</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 15px;">
        <div>
          <strong>Total Revenue:</strong><br>
          $${(totalRevenue / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
        </div>
        <div>
          <strong>Total Expenditures:</strong><br>
          $${(totalExpenditures / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
        </div>
        <div>
          <strong>${surplus >= 0 ? 'Budget Surplus:' : 'Budget Deficit:'}</strong><br>
          <span style="color: ${surplus >= 0 ? 'green' : 'red'}">
            $${Math.abs(surplus / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
          </span>
        </div>
      </div>
    </div>
  `);
}
```

```js
// Sankey diagram
if (municipalityYearData && sankeyData.nodes.length > 0) {
  // Debug logging
  console.log("Sankey Nodes:", sankeyData.nodes.map(n => n.id));
  console.log("Sankey Links:", sankeyData.links.map(l => `${l.source} -> ${l.target} (${l.value})`));
  
  display(SankeyChart(
    {
      nodes: sankeyData.nodes,
      links: sankeyData.links
    },
    {
      width: 1000,
      height: 600,
      nodeGroup: d => d.category,
      colors: ["#3b82f6", "#f59e0b", "#6b7280", "#22c55e", "#ef4444"],
      linkColor: "source-target",
      format: "~s"
    }
  ));
} else if (!municipalityYearData) {
  display(html`<p style="color: #666; font-style: italic;">Please select a municipality and year to view the budget flow diagram.</p>`);
}
```
