---
title: Revenues and Expenditures
---

```js
import {sankey, sankeyLinkHorizontal} from "npm:d3-sankey@0.12"
import {SankeyChart} from "./components/sankey.js"
```

# Revenues and Expenditures

<div class="tip" label="Key Questions">

- What does my town spend money on and where does the funding come from?
- Does the town balance its budget or run a surplus/deficit?
- How have spending patterns and revenue sources evolved over time?
- How does my town compare to neighboring communities?

</div>

This page explores municipal finances by examining how Massachusetts cities and towns generate revenue and allocate spending through their general funds. The general fund represents the primary operating budget that covers most day-to-day municipal services and is controlled through the normal town meeting or city council appropriation process.

## Money Flows

The diagram below visualizes how money flows through a municipality's general fund. Revenue sources (like taxes, state aid, and fees) flow into the total revenue pool, which then funds various expenditure categories (such as education, public safety, and infrastructure). When revenues exceed expenditures, the municipality runs a budget surplus; when expenditures exceed revenues, it runs a deficit.

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

// Create a category lookup map
const nodeCategoryMap = {};

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

  // 1. Define nodes and populate category map
  sankeyData.nodes.push({ id: "Total Revenue", category: "total" });
  nodeCategoryMap["Total Revenue"] = "total";
  
  sankeyData.nodes.push({ id: "Total Expenditures", category: "total" });
  nodeCategoryMap["Total Expenditures"] = "total";
  
  validRevenueFields.forEach(field => {
    const label = field.replace('rev_', '').replace(/_/g, ' ');
    sankeyData.nodes.push({ id: label, category: "revenue" });
    nodeCategoryMap[label] = "revenue";
  });

  validExpenditureFields.forEach(field => {
    const label = field.replace('exp_', '').replace(/_/g, ' ');
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
    <div class="grid grid-cols-4" style="margin: 20px 0;">
      <div class="card">
        <strong>${selectedMunicipalityForSankey}</strong><br>
        ${selectedYear}
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
}
```

```js
// Sankey diagram
if (municipalityYearData && sankeyData.nodes.length > 0) {
  display(SankeyChart(
    {
      nodes: sankeyData.nodes,
      links: sankeyData.links
    },
    {
      width: 1000,
      height: 600,
      nodeGroup: d => d.category,
      nodeSort: (a, b) => {
        // Custom sorting logic
        const getNodeValue = (node) => {
          let value = 0;
          const nodeCategory = nodeCategoryMap[node.id];
          
          if (nodeCategory === 'revenue') {
            // For revenue sources, use the outgoing value (what they contribute to Total Revenue)
            value = sankeyData.links
              .filter(link => link.source === node.id)
              .reduce((sum, link) => sum + link.value, 0);
          } else if (nodeCategory === 'expenditure') {
            // For expenditure categories, use the incoming value (what they receive from Total Expenditures)
            value = sankeyData.links
              .filter(link => link.target === node.id)
              .reduce((sum, link) => sum + link.value, 0);
          } else {
            // For other nodes, use the max of incoming/outgoing
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
        
        // Define sort order for different categories
        const categoryOrder = {
          'revenue': 1,
          'total': 2,
          'expenditure': 3,
          'deficit': 1.5,  // Place deficit after revenue sources
          'surplus': 3.5   // Place surplus after expenditure categories
        };
        
        const aCategory = nodeCategoryMap[a.id];
        const bCategory = nodeCategoryMap[b.id];
        const aOrder = categoryOrder[aCategory] || 2;
        const bOrder = categoryOrder[bCategory] || 2;
        
        // First sort by category order
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        
        // Within same category, sort by value (descending)
        if (aCategory === bCategory && (aCategory === 'revenue' || aCategory === 'expenditure')) {
          const aValue = getNodeValue(a);
          const bValue = getNodeValue(b);
          return bValue - aValue;
        }
        
        // Default: maintain existing order
        return 0;
      },
      colors: ["#3b82f6", "#3b82f6", "#3b82f6", "#22c55e", "#ef4444"], // Blue for most, green for surplus, red for deficit
      linkColor: "source-target",
      format: "~s"
    }
  ));
} else if (!municipalityYearData) {
  display(html`<p style="color: #666; font-style: italic;">Please select a municipality and year to view the budget flow diagram.</p>`);
}
```

## Time Trends

Track how municipal finances have changed over time by exploring trends in specific revenue sources or expenditure categories. This analysis helps identify patterns such as growing education costs, changes in state funding, or the impact of economic cycles on local budgets. You can compare multiple municipalities to see how similar communities manage their finances differently.

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
    
    const processedData = {
      ...d,
      'Fiscal Year': convertValue(d['Fiscal Year']),
      ...Object.fromEntries(
        Object.entries(d).map(([key, value]) => 
          key.startsWith('exp_') || key.startsWith('rev_') ? [key, convertValue(value)] : [key, value]
        )
      )
    };
    
    // Calculate Budget Surplus
    const revenueFields = Object.keys(processedData).filter(key => key.startsWith('rev_'));
    const expenditureFields = Object.keys(processedData).filter(key => key.startsWith('exp_'));
    
    const totalRevenue = revenueFields.reduce((sum, field) => sum + convertValue(processedData[field]), 0);
    const totalExpenditures = expenditureFields.reduce((sum, field) => sum + convertValue(processedData[field]), 0);
    
    processedData['Budget Surplus'] = totalRevenue - totalExpenditures;
    
    return processedData;
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
  .filter(key => key.startsWith('exp_') || key.startsWith('rev_') || key === 'Budget Surplus')
  .map(key => ({
    id: key,
    label: key === 'Budget Surplus' ? 'Budget Surplus' : key.replace('exp_', 'Expenditure: ').replace('rev_', 'Revenue: ')
  }))
  .sort((a, b) => {
    // Put Budget Surplus at the end
    if (a.id === 'Budget Surplus') return 1;
    if (b.id === 'Budget Surplus') return -1;
    // Sort all others alphabetically
    return a.label.localeCompare(b.label);
  });
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

## About the Data

All financial data presented here comes from the Massachusetts Department of Revenue's Division of Local Services through their [General Fund Report](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund). This report provides standardized financial information for all Massachusetts municipalities, ensuring consistent and comparable data across communities.

### Understanding General Fund Finances

The general fund represents a municipality's primary operating budget and accounts for most financial resources and activities governed by the normal town meeting or city council appropriation process. This includes:

**Common Revenue Sources:**
- Property taxes (typically the largest source)
- State aid and grants
- Local receipts (fees, permits, fines)
- Motor vehicle excise taxes
- Investment income

**Major Expenditure Categories:**
- Education
- Public safety (police, fire, emergency services)
- Public works (roads, maintenance, utilities)
- General government (administration, town clerk, assessor)
- Health and human services
- Culture and recreation
- Debt service

### Data Limitations

The general fund data excludes some municipal activities that are tracked in separate funds, such as water and sewer enterprises, capital projects, and certain grant-funded programs. For a complete picture of municipal finances, these other funds would need to be considered alongside general fund data. See the broader category of [Schedule A Reports](https://www.mass.gov/lists/schedule-a-reports-revenues-expenditures-and-more).
