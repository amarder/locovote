---
title: General Fund
---

# General Fund

The Massachusetts Department of Revenue's Division of Local Services maintains detailed financial data for all municipalities in the state through Schedule A reports. These reports track both revenues and expenditures across major categories in each municipality's general fund.

```js
import {sankey, sankeyLinkHorizontal} from "npm:d3-sankey@0.12"
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
// Prepare Sankey data
const revenueFields = Object.keys(municipalityYearData || {}).filter(key => key.startsWith('rev_'));
const expenditureFields = Object.keys(municipalityYearData || {}).filter(key => key.startsWith('exp_'));

// Helper function to convert BigInt to Number
const convertValue = (value) => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
};

const totalRevenue = revenueFields.reduce((sum, field) => sum + convertValue(municipalityYearData?.[field] || 0), 0);
const totalExpenditures = expenditureFields.reduce((sum, field) => sum + convertValue(municipalityYearData?.[field] || 0), 0);

const surplus = totalRevenue - totalExpenditures;

const sankeyData = {
  nodes: [],
  links: []
};

if (municipalityYearData) {
  // Collect valid revenue and expenditure fields with data
  const validRevenueFields = revenueFields.filter(field => convertValue(municipalityYearData[field]) > 0);
  const validExpenditureFields = expenditureFields.filter(field => convertValue(municipalityYearData[field]) > 0);
  
  // Add nodes
  sankeyData.nodes.push(
    { id: "Total Revenue", category: "total" },
    { id: "Total Expenditures", category: "total" }
  );
  
  // Add revenue source nodes (only for fields with values > 0)
  validRevenueFields.forEach(field => {
    const label = field.replace('rev_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "revenue" });
  });
  
  // Add expenditure type nodes (only for fields with values > 0)
  validExpenditureFields.forEach(field => {
    const label = field.replace('exp_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "expenditure" });
  });
  
  // Add surplus/deficit node if needed
  if (Math.abs(surplus) > 1000) { // Only show if surplus/deficit is significant (> $1000)
    if (surplus > 0) {
      sankeyData.nodes.push({ id: "Budget Surplus", category: "surplus" });
    } else {
      sankeyData.nodes.push({ id: "Budget Deficit", category: "deficit" });
    }
  }
  
  // Add links from revenue sources to Total Revenue (only for valid fields)
  validRevenueFields.forEach(field => {
    const value = convertValue(municipalityYearData[field]);
    const label = field.replace('rev_', '').replace(/_/g, ' ');
    sankeyData.links.push({
      source: label,
      target: "Total Revenue",
      value: value
    });
  });
  
  // Add links from Total Expenditures to expenditure types (only for valid fields)
  validExpenditureFields.forEach(field => {
    const value = convertValue(municipalityYearData[field]);
    const label = field.replace('exp_', '').replace(/_/g, ' ');
    sankeyData.links.push({
      source: "Total Expenditures",
      target: label,
      value: value
    });
  });
  
  // Handle surplus/deficit flow
  if (Math.abs(surplus) > 1000) {
    if (surplus > 0) {
      // Surplus flows out of Total Revenue
      sankeyData.links.push({
        source: "Total Revenue",
        target: "Budget Surplus",
        value: surplus
      });
      // Total Revenue minus surplus flows to Total Expenditures
      sankeyData.links.push({
        source: "Total Revenue",
        target: "Total Expenditures",
        value: totalExpenditures
      });
    } else {
      // Deficit flows into Total Expenditures
      sankeyData.links.push({
        source: "Budget Deficit",
        target: "Total Expenditures",
        value: Math.abs(surplus)
      });
      // All revenue flows to Total Expenditures
      sankeyData.links.push({
        source: "Total Revenue",
        target: "Total Expenditures",
        value: totalRevenue
      });
    }
  } else {
    // Balanced budget or very small difference
    sankeyData.links.push({
      source: "Total Revenue", 
      target: "Total Expenditures",
      value: Math.min(totalRevenue, totalExpenditures)
    });
  }
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
  
  // Validate that all link sources and targets exist as nodes
  const nodeIds = new Set(sankeyData.nodes.map(n => n.id));
  const invalidLinks = sankeyData.links.filter(l => !nodeIds.has(l.source) || !nodeIds.has(l.target));
  if (invalidLinks.length > 0) {
    console.error("Invalid links found:", invalidLinks);
  }

  // Create a mapping from node ID to index
  const nodeIndexMap = new Map();
  sankeyData.nodes.forEach((node, index) => {
    nodeIndexMap.set(node.id, index);
  });

  // Convert link sources and targets from strings to indices
  const processedLinks = sankeyData.links.map(link => ({
    source: nodeIndexMap.get(link.source),
    target: nodeIndexMap.get(link.target),
    value: link.value
  }));

  const sankeyGenerator = sankey()
    .nodeWidth(15)
    .nodePadding(10)
    .extent([[1, 1], [1000 - 1, 600 - 1]]);

  const graph = sankeyGenerator({
    nodes: sankeyData.nodes.map(d => ({...d})),
    links: processedLinks
  });

  display(Plot.plot({
    width: 1000,
    height: 600,
    style: {
      background: "white"
    },
    marks: [
      // Links
      Plot.link(graph.links, {
        x1: d => d.source.x1,
        y1: d => d.source.y0 + (d.source.y1 - d.source.y0) * (d.sy0 + d.sy1) / 2 / (d.source.y1 - d.source.y0),
        x2: d => d.target.x0,
        y2: d => d.target.y0 + (d.target.y1 - d.target.y0) * (d.ty0 + d.ty1) / 2 / (d.target.y1 - d.target.y0),
        stroke: d => {
          if (d.target.id === "Budget Surplus") return "#22c55e";
          if (d.source.id === "Budget Deficit") return "#ef4444";
          return "#94a3b8";
        },
        strokeWidth: d => Math.max(1, d.width),
        strokeOpacity: 0.6,
        curve: "bump-x"
      }),
      // Nodes
      Plot.rect(graph.nodes, {
        x1: d => d.x0,
        x2: d => d.x1,
        y1: d => d.y0,
        y2: d => d.y1,
        fill: d => {
          if (d.category === "revenue") return "#3b82f6";
          if (d.category === "expenditure") return "#f59e0b";
          if (d.category === "total") return "#6b7280";
          if (d.category === "surplus") return "#22c55e";
          if (d.category === "deficit") return "#ef4444";
          return "#94a3b8";
        }
      }),
      // Labels
      Plot.text(graph.nodes, {
        x: d => d.x0 < 500 ? d.x1 + 6 : d.x0 - 6,
        y: d => (d.y1 + d.y0) / 2,
        text: d => d.id,
        textAnchor: d => d.x0 < 500 ? "start" : "end",
        fontSize: 12,
        fill: "black"
      })
    ],
    caption: `Budget flow for ${selectedMunicipalityForSankey}, Fiscal Year ${selectedYear}. Revenue sources (blue) flow into Total Revenue, which flows to Total Expenditures, which flows out to expenditure categories (orange). ${surplus >= 0 ? 'Budget surplus (green) flows out of Total Revenue.' : 'Budget deficit (red) flows into Total Expenditures.'}`
  }));
} else if (!municipalityYearData) {
  display(html`<p style="color: #666; font-style: italic;">Please select a municipality and year to view the budget flow diagram.</p>`);
}
```
