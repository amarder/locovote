---
title: Municipalities
---

# Municipalities

<div class="tip" label="Key Questions">

- Is my municipality balancing its budget?
- What does my municipality spend its money on?
- Where does my municipality get its money from?
- What are the property tax rates?
- How many people live there?
- How have things changed over time?

</div>

```js
import {sankey, sankeyLinkHorizontal} from "npm:d3-sankey@0.12"
import {SankeyChart} from "./components/sankey.js"
```

```js
const data = FileAttachment("./data/municipalities.arrow").arrow();
```

```js
// Convert Arrow table to JavaScript array
const municipalityData = [...data];
```

```js
// Get unique municipalities for the dropdown
const municipalities = [...new Set(municipalityData.map(d => d.Municipality))].sort()
```

```js
// Get unique fiscal years for the dropdown (only years with tax revenue data, 2003-2024)
const fiscalYears = [...new Set(municipalityData
  .filter(d => d.gf_rev_Taxes != null && d.gf_rev_Taxes !== 0)
  .map(d => Number(d["Fiscal Year"]))
  .filter(year => year >= 2003 && year <= 2024)
)].sort((a, b) => b - a)
```

```js
// Read URL parameters for initial values
const urlParams = new URL(location).searchParams;
const initialMunicipality = urlParams.get("name") || "Boston";
const initialFiscalYear = parseInt(urlParams.get("year")) || fiscalYears[0];
```

```js
// Create municipality input with URL sync
const selectedMunicipality = view(Inputs.select(municipalities, {
  label: "Select Municipality:",
  value: municipalities.includes(initialMunicipality) ? initialMunicipality : "Boston"
}))
```

```js
// Create fiscal year input with URL sync
const fiscalYearSelect = Inputs.select(fiscalYears, {
  label: "Select Fiscal Year:",
  value: fiscalYears.includes(initialFiscalYear) ? initialFiscalYear : fiscalYears[0],
  format: d => d.toString()
});

const selectedFiscalYear = view(fiscalYearSelect);
```



```js
// Update URL when inputs change
{
  const url = new URL(location);
  url.searchParams.set("name", selectedMunicipality);
  url.searchParams.set("year", selectedFiscalYear);
  history.replaceState(null, "", url);
}
```

```js
// Filter data based on selected municipality and year range (2003-2024)
const filteredData = municipalityData.filter(d => 
  d.Municipality === selectedMunicipality && 
  Number(d["Fiscal Year"]) >= 2003 && 
  Number(d["Fiscal Year"]) <= 2024
)
```

```js
// Get the specific row for selected municipality and fiscal year
const snapshotData = municipalityData.find(d => 
  d.Municipality === selectedMunicipality && 
  Number(d["Fiscal Year"]) === selectedFiscalYear
)
```

```js
// Helper function to safely convert values
const convertValue = (value) => {
  if (typeof value === 'bigint') return Number(value);
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
};
```

```js
// Calculate totals and surplus/deficit
let totalRevenue = 0;
let totalExpenditures = 0;
let surplus = 0;

if (snapshotData) {
  const revenueFields = Object.keys(snapshotData).filter(key => key.startsWith('gf_rev_'));
  const expenditureFields = Object.keys(snapshotData).filter(key => key.startsWith('gf_exp_'));

  const validRevenueFields = revenueFields.filter(field => convertValue(snapshotData[field]) > 0);
  const validExpenditureFields = expenditureFields.filter(field => convertValue(snapshotData[field]) > 0);

  totalRevenue = validRevenueFields.reduce((sum, field) => sum + convertValue(snapshotData[field]), 0);
  totalExpenditures = validExpenditureFields.reduce((sum, field) => sum + convertValue(snapshotData[field]), 0);
  surplus = totalRevenue - totalExpenditures;
}
```

```js
// Prepare Sankey data
const sankeyData = {
  nodes: [],
  links: []
};

// Create a category lookup map
const nodeCategoryMap = {};

if (snapshotData && totalRevenue > 0) {
  const revenueFields = Object.keys(snapshotData).filter(key => key.startsWith('gf_rev_'));
  const expenditureFields = Object.keys(snapshotData).filter(key => key.startsWith('gf_exp_'));
  const levyFields = Object.keys(snapshotData).filter(key => key.startsWith('levy_'));

  const validExpenditureFields = expenditureFields.filter(field => convertValue(snapshotData[field]) > 0);
  const validLevyFields = levyFields.filter(field => convertValue(snapshotData[field]) > 0);
  
  // If we have detailed levy data, exclude gf_rev_Taxes to avoid double-counting
  const validRevenueFields = revenueFields.filter(field => {
    if (validLevyFields.length > 0 && field === 'gf_rev_Taxes') {
      return false; // Skip gf_rev_Taxes when we have detailed levy breakdown
    }
    return convertValue(snapshotData[field]) > 0;
  });

  // 1. Define nodes and populate category map
  sankeyData.nodes.push({ id: "Total Revenue", category: "total" });
  nodeCategoryMap["Total Revenue"] = "total";
  
  sankeyData.nodes.push({ id: "Total Expenditures", category: "total" });
  nodeCategoryMap["Total Expenditures"] = "total";
  
  // Add Taxes node if we have levy data
  if (validLevyFields.length > 0) {
    sankeyData.nodes.push({ id: "Taxes", category: "taxes" });
    nodeCategoryMap["Taxes"] = "taxes";
  }
  
  validRevenueFields.forEach(field => {
    const label = field.replace('gf_rev_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "revenue" });
    nodeCategoryMap[label] = "revenue";
  });

  validLevyFields.forEach(field => {
    const label = field.replace('levy_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "levy" });
    nodeCategoryMap[label] = "levy";
  });

  // Add "Other Taxes" node if there's a difference between gf_rev_Taxes and levy sum
  const totalLevies = validLevyFields.reduce((sum, field) => sum + convertValue(snapshotData[field]), 0);
  const gfRevTaxes = convertValue(snapshotData['gf_rev_Taxes']) || 0;
  const otherTaxes = gfRevTaxes - totalLevies;
  
  if (validLevyFields.length > 0 && otherTaxes > 0) {
    sankeyData.nodes.push({ id: "Other Taxes", category: "levy" });
    nodeCategoryMap["Other Taxes"] = "levy";
  }

  validExpenditureFields.forEach(field => {
    const label = field.replace('gf_exp_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "expenditure" });
    nodeCategoryMap[label] = "expenditure";
  });

  if (surplus > 0) {
    sankeyData.nodes.push({ id: "Budget Surplus", category: "surplus" });
    nodeCategoryMap["Budget Surplus"] = "surplus";
  } else if (surplus < 0) {
    sankeyData.nodes.push({ id: "Budget Deficit", category: "deficit" });
    nodeCategoryMap["Budget Deficit"] = "deficit";
  }

  // 2. Define links
  // Levy sources flow into Taxes
  validLevyFields.forEach(field => {
    const label = field.replace('levy_', '').replace(/_/g, ' ');
    sankeyData.links.push({
      source: label,
      target: "Taxes",
      value: convertValue(snapshotData[field])
    });
  });

  // Other Taxes flow into Taxes (if there's a difference)
  if (validLevyFields.length > 0 && otherTaxes > 0) {
    sankeyData.links.push({
      source: "Other Taxes",
      target: "Taxes",
      value: otherTaxes
    });
  }

  // Taxes flows into Total Revenue
  if (validLevyFields.length > 0) {
    // Use gf_rev_Taxes total to ensure accuracy
    const totalTaxesToRevenue = convertValue(snapshotData['gf_rev_Taxes']) || 0;
    if (totalTaxesToRevenue > 0) {
      sankeyData.links.push({
        source: "Taxes",
        target: "Total Revenue",
        value: totalTaxesToRevenue
      });
    }
  }

  // Other revenue sources flow directly into Total Revenue
  validRevenueFields.forEach(field => {
    const label = field.replace('gf_rev_', '').replace(/_/g, ' ');
    sankeyData.links.push({
      source: label,
      target: "Total Revenue",
      value: convertValue(snapshotData[field])
    });
  });

  // Flow from Total Revenue to Total Expenditures
  const flowToExpenditures = Math.min(totalRevenue, totalExpenditures);
  if (flowToExpenditures > 0) {
    sankeyData.links.push({
      source: "Total Revenue",
      target: "Total Expenditures",
      value: flowToExpenditures
    });
  }

  // Handle surplus
  if (surplus > 0) {
    sankeyData.links.push({
      source: "Total Revenue",
      target: "Budget Surplus",
      value: surplus
    });
  }

  // Handle deficit
  if (surplus < 0) {
    sankeyData.links.push({
      source: "Budget Deficit",
      target: "Total Expenditures",
      value: Math.abs(surplus)
    });
  }

  // Flow from Total Expenditures to each expenditure type
  validExpenditureFields.forEach(field => {
    const label = field.replace('gf_exp_', '').replace(/_/g, ' ');
    sankeyData.links.push({
      source: "Total Expenditures",
      target: label,
      value: convertValue(snapshotData[field])
    });
  });
}
```

```js
// Create budget summary variable
const budgetSummary = snapshotData && totalRevenue > 0 ? 
  html`
    <div class="grid grid-cols-3" style="margin: 20px 0;">
      <div class="card" style="background-color: #1e1e1e">
        <strong>Total Revenue</strong><br>
        $${(totalRevenue / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
      </div>
      <div class="card" style="background-color: #1e1e1e">
        <strong>Total Expenditures</strong><br>
        $${(totalExpenditures / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
      </div>
      <div class="card" style="background-color: #1e1e1e">
        <strong>${surplus >= 0 ? 'Budget Surplus' : 'Budget Deficit'}</strong><br>
        <span style="color: ${surplus >= 0 ? 'green' : 'red'}">
          $${Math.abs(surplus / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
        </span>
      </div>
    </div>
  ` :
  html`
    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #ffc107;">
      <strong>No general fund data available</strong> for ${selectedMunicipality} in ${selectedFiscalYear}
    </div>
  `;
```

```js
// Create Sankey diagram variable
const sankeyDiagram = (snapshotData && sankeyData.nodes.length > 0 && totalRevenue > 0) ?
  SankeyChart(
    {
      nodes: sankeyData.nodes,
      links: sankeyData.links
    },
    {
      width: 830,
      height: 500,
      nodeGroup: d => d.category,
    nodeSort: (a, b) => {
      // Custom sorting logic
      const getNodeValue = (node) => {
        let value = 0;
        const nodeCategory = nodeCategoryMap[node.id];
        
        if (nodeCategory === 'revenue') {
          value = sankeyData.links
            .filter(link => link.source === node.id)
            .reduce((sum, link) => sum + link.value, 0);
        } else if (nodeCategory === 'expenditure') {
          value = sankeyData.links
            .filter(link => link.target === node.id)
            .reduce((sum, link) => sum + link.value, 0);
        } else {
          const incomingValue = sankeyData.links
            .filter(link => link.target === node.id)
            .reduce((sum, link) => sum + link.value, 0);
          const outgoingValue = sankeyData.links
            .filter(link => link.source === node.id)
            .reduce((sum, link) => sum + link.value, 0);
          value = Math.max(incomingValue, outgoingValue);
        }
        return value;
      };
      
      const categoryOrder = {
        'levy': 0.5,
        'taxes': 1.5,
        'revenue': 1,
        'total': 2,
        'expenditure': 3,
        'deficit': 1.2,
        'surplus': 3.5
      };
      
      const aCategory = nodeCategoryMap[a.id];
      const bCategory = nodeCategoryMap[b.id];
      const aOrder = categoryOrder[aCategory] || 2;
      const bOrder = categoryOrder[bCategory] || 2;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      if (aCategory === bCategory && (aCategory === 'revenue' || aCategory === 'expenditure')) {
        const aValue = getNodeValue(a);
        const bValue = getNodeValue(b);
        return bValue - aValue;
      }
      
      return 0;
    },
    colors: ["#6366f1", "#6366f1", "#3b82f6", "#3b82f6", "#3b82f6", "#22c55e", "#ef4444"],
    linkColor: "#6366f1",
              format: "~s"
    }
  ) :
  html``;
```

<div class="card">
${fiscalYearSelect}
<figure style="max-width: initial;">
      <h2>${selectedMunicipality} ${selectedFiscalYear}: Revenues and Expenditures</h2>
${budgetSummary}
${sankeyDiagram}
</figure>
</div>

<div class="card">${revenueChart}</div>
<div class="card">${expenditureChart}</div>
<div class="card">${surplusChart}</div>
<div class="card">${populationChart}</div>
<div class="card">${rateChart}</div>

```js
// Create population trend chart
const populationChart = Plot.plot({
  title: `${selectedMunicipality}: Population Over Time`,
  width: 830,
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
  marks: [
    Plot.line(filteredData, {
      x: "Fiscal Year",
      y: "pop_Population",
      stroke: "steelblue",
      strokeWidth: 2
    }),
    Plot.dot(filteredData, {
      x: "Fiscal Year", 
      y: "pop_Population",
      fill: "steelblue",
      r: 4,
      title: d => `${d["Fiscal Year"]}: ${d.pop_Population?.toLocaleString() || 'N/A'}`
    })
  ]
});
```

```js
// Calculate budget surplus/deficit for each year
const budgetData = filteredData.map(d => {
  const revenueFields = Object.keys(d).filter(key => key.startsWith('gf_rev_'));
  const expenditureFields = Object.keys(d).filter(key => key.startsWith('gf_exp_'));
  
  const totalRevenue = revenueFields.reduce((sum, field) => sum + convertValue(d[field]), 0);
  const totalExpenditures = expenditureFields.reduce((sum, field) => sum + convertValue(d[field]), 0);
  const budgetSurplus = totalRevenue - totalExpenditures;
  
  return {
    "Fiscal Year": d["Fiscal Year"],
    "Budget Surplus": budgetSurplus,
    "Total Revenue": totalRevenue,
    "Total Expenditures": totalExpenditures
  };
}).filter(d => d["Total Revenue"] > 0); // Only include years with revenue data
```

```js
// Create budget surplus trend chart
const surplusChart = Plot.plot({
  title: `${selectedMunicipality}: Budget Surplus Over Time`,
  width: 830,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Budget Surplus (Millions $)",
    grid: true,
    tickFormat: d => d / 1_000_000
    // tickFormat: d => `$${(d / 1000000).toFixed(1)}M`
  },
  marks: [
    // Zero line
    Plot.ruleY([0], {stroke: "gray", strokeDasharray: "3,3"}),
    // Line chart
    Plot.line(budgetData, {
      x: "Fiscal Year",
      y: "Budget Surplus",
      stroke: "steelblue",
      strokeWidth: 2
    }),
    // Points
    Plot.dot(budgetData, {
      x: "Fiscal Year", 
      y: "Budget Surplus",
      fill: "steelblue",
      r: 4,
      title: d => {
        const surplus = d["Budget Surplus"];
        const type = surplus >= 0 ? "Surplus" : "Deficit";
        return `${d["Fiscal Year"]}: ${type} of $${Math.abs(surplus / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M`;
      }
    })
  ]
});
```

```js
// Prepare tax rate data for multi-line chart
const taxRateData = filteredData.flatMap(d => {
  const rateTypes = [
    { field: 'rate_Residential', label: 'Residential' },
    { field: 'rate_Commercial', label: 'Commercial' },
    { field: 'rate_Industrial', label: 'Industrial' },
    { field: 'rate_Personal Property', label: 'Personal Property' },
    { field: 'rate_Open Space', label: 'Open Space' }
  ];
  
  return rateTypes
    .filter(rate => d[rate.field] != null) // Include all rates as long as they're not null, even if 0
    .map(rate => ({
      "Fiscal Year": d["Fiscal Year"],
      "Rate Type": rate.label,
      "Tax Rate": d[rate.field]
    }));
});
```

```js
// Check if municipality uses uniform tax rates
const hasUniformRates = taxRateData.length > 0 && (() => {
  const ratesByYear = {};
  taxRateData.forEach(d => {
    if (!ratesByYear[d["Fiscal Year"]]) ratesByYear[d["Fiscal Year"]] = new Set();
    ratesByYear[d["Fiscal Year"]].add(d["Tax Rate"]);
  });
  return Object.values(ratesByYear).every(rates => rates.size === 1);
})();
```

```js
// Create tax rates trend chart using facets for each property class
const rateChart = Plot.plot({
  title: `${selectedMunicipality}: Tax Rates Over Time`,
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
  fx: {
    label: "",
    domain: [...new Set(taxRateData.map(d => d["Rate Type"]))].sort()
  },
  marks: [
    Plot.line(taxRateData, {
      x: "Fiscal Year",
      y: "Tax Rate",
      fx: "Rate Type",
      stroke: "steelblue",
      strokeWidth: 2
    }),
    Plot.dot(taxRateData, {
      x: "Fiscal Year", 
      y: "Tax Rate",
      fx: "Rate Type",
      fill: "steelblue",
      r: 2.5,
      title: d => `${d["Rate Type"]}\n${d["Fiscal Year"]}: $${d["Tax Rate"]?.toFixed(2) || 'N/A'} per $1,000`
    })
  ]
});
```

```js
// Prepare data for stacked charts
const revenueFields = Object.keys(municipalityData[0])
  .filter(key => key.startsWith('gf_rev_') && key !== 'gf_rev_Taxes') // Exclude Taxes, we'll handle it separately
  .map(key => ({
    id: key,
    label: key.replace('gf_rev_', '').replace(/_/g, ' ')
  }));

const levyFields = Object.keys(municipalityData[0])
  .filter(key => key.startsWith('levy_'))
  .map(key => ({
    id: key,
    label: key.replace('levy_', '').replace(/_/g, ' ')
  }));

const expenditureFields = Object.keys(municipalityData[0])
  .filter(key => key.startsWith('gf_exp_'))
  .map(key => ({
    id: key,
    label: key.replace('gf_exp_', '').replace(/_/g, ' ')
  }));
```

```js
// Transform data for stacked charts
const revenueData = filteredData.flatMap(d => {
  const dataPoints = [];
  
  // Add non-tax revenue fields
  revenueFields
    .filter(field => convertValue(d[field.id]) > 0)
    .forEach(field => {
      dataPoints.push({
        "Fiscal Year": d["Fiscal Year"],
        Category: field.label,
        Value: convertValue(d[field.id])
      });
    });
  
  // Add levy fields
  levyFields
    .filter(field => convertValue(d[field.id]) > 0)
    .forEach(field => {
      dataPoints.push({
        "Fiscal Year": d["Fiscal Year"],
        Category: field.label,
        Value: convertValue(d[field.id])
      });
    });
  
  // Calculate Other Taxes = Taxes - sum of all levies
  const totalTaxes = convertValue(d['gf_rev_Taxes']);
  const totalLevies = levyFields.reduce((sum, field) => sum + convertValue(d[field.id]), 0);
  const otherTaxes = totalTaxes - totalLevies;
  
  if (otherTaxes > 0) {
    dataPoints.push({
      "Fiscal Year": d["Fiscal Year"],
      Category: "Other Taxes",
      Value: otherTaxes
    });
  }
  
  return dataPoints;
});

const expenditureData = filteredData.flatMap(d => 
  expenditureFields
    .filter(field => convertValue(d[field.id]) > 0)
    .map(field => ({
      "Fiscal Year": d["Fiscal Year"],
      Category: field.label,
      Value: convertValue(d[field.id])
    }))
);
```

```js
// Revenue stacked chart
const revenueChart = Plot.plot({
  title: `${selectedMunicipality}: Revenues Over Time`,
  width: 830,
  height: 400,
  x: {
    label: "Fiscal Year",
    type: "band",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Revenues (Millions $)",
    grid: true,
    tickFormat: d => d / 1_000_000
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    Plot.rectY(revenueData, {
      x: "Fiscal Year",
      y: "Value",
      fill: "Category",
      title: d => `${d.Category}\nFiscal Year: ${d["Fiscal Year"]}\nValue: $${(d.Value / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M`
    })
  ]
});
```

```js
const expenditureChart = Plot.plot({
  title: `${selectedMunicipality}: Expenditures Over Time`,
  width: 830,
  height: 400,
  x: {
    label: "Fiscal Year",
    type: "band",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Expenditures (Millions $)",
    grid: true,
    tickFormat: d => d / 1_000_000
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    Plot.rectY(expenditureData, {
      x: "Fiscal Year",
      y: "Value",
      fill: "Category",
      title: d => `${d.Category}\nFiscal Year: ${d["Fiscal Year"]}\nValue: $${(d.Value / 1000000).toLocaleString(undefined, {maximumFractionDigits: 2})}M`
    })
  ]
});
```

For debugging purposes, I've include a table of raw data below.

```js
// Raw data table
html`<div class="card">
  <h2>${selectedMunicipality}: Raw Data</h2>
  ${Inputs.table(filteredData, {
    sort: "Fiscal Year",
    reverse: true
  })}
</div>`
```
