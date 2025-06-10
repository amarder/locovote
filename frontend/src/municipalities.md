---
title: Municipalities
---

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
// Get unique fiscal years for the dropdown
const fiscalYears = [...new Set(municipalityData.map(d => Number(d["Fiscal Year"])))].sort((a, b) => b - a)
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
const selectedFiscalYear = view(Inputs.select(fiscalYears, {
  label: "Select Fiscal Year:",
  value: fiscalYears.includes(initialFiscalYear) ? initialFiscalYear : fiscalYears[0],
  format: d => d.toString()
}))
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
// Filter data based on selected municipality
const filteredData = municipalityData.filter(d => d.Municipality === selectedMunicipality)
```

```js
// Get the specific row for selected municipality and fiscal year
const snapshotData = municipalityData.find(d => 
  d.Municipality === selectedMunicipality && 
  Number(d["Fiscal Year"]) === selectedFiscalYear
)
```

## Snapshot

```js
display(snapshotData);

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
// Display summary
if (snapshotData && totalRevenue > 0) {
  display(html`
    <div class="grid grid-cols-4" style="margin: 20px 0;">
      <div class="card">
        <strong>${selectedMunicipality}</strong><br>
        ${selectedFiscalYear}
      </div>
      <div class="card">
        <strong>Total Revenue</strong><br>
        $${(totalRevenue / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
      </div>
      <div class="card">
        <strong>Total Expenditures</strong><br>
        $${(totalExpenditures / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
      </div>
      <div class="card">
        <strong>${surplus >= 0 ? 'Budget Surplus' : 'Budget Deficit'}</strong><br>
        <span style="color: ${surplus >= 0 ? 'green' : 'red'}">
          $${Math.abs(surplus / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M
        </span>
      </div>
    </div>
  `);
} else {
  display(html`
    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #ffc107;">
      <strong>No general fund data available</strong> for ${selectedMunicipality} in ${selectedFiscalYear}
    </div>
  `);
}
```

```js
// Sankey diagram
if (snapshotData && sankeyData.nodes.length > 0 && totalRevenue > 0) {
  display(SankeyChart(
    {
      nodes: sankeyData.nodes,
      links: sankeyData.links
    },
    {
      width: 800,
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
  ));
}
```

## Time Trends

```js
// Create population trend chart
Plot.plot({
  title: `Population Trend for ${selectedMunicipality}`,
  x: {
    label: "Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Population (thousands)",
    grid: true,
    tickFormat: d => (d / 1000).toFixed(0)
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
})
```

```js
// Create residential tax rate trend chart
Plot.plot({
  title: `Residential Tax Rate Trend for ${selectedMunicipality}`,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString(),
    domain: d3.extent(filteredData.filter(d => d.rate_Residential != null), d => d["Fiscal Year"])
  },
  y: {
    label: "Residential Tax Rate",
    grid: true
  },
  marks: [
    Plot.line(filteredData, {
      x: "Fiscal Year",
      y: "rate_Residential",
      stroke: "darkgreen",
      strokeWidth: 2
    }),
    Plot.dot(filteredData, {
      x: "Fiscal Year", 
      y: "rate_Residential",
      fill: "darkgreen",
      r: 4,
      title: d => `${d["Fiscal Year"]}: $${d.rate_Residential?.toFixed(2) || 'N/A'}`
    })
  ]
})
```
