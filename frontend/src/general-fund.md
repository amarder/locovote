---
title: General Fund
---

# General Fund

The Massachusetts Department of Revenue's Division of Local Services maintains detailed financial data for all municipalities in the state through Schedule A reports. These reports track both revenues and expenditures across major categories in each municipality's general fund.

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

---

```js
const municipalities = FileAttachment("./data/general-fund.arrow").arrow().then(data => 
  Array.from(data).map(d => ({
    ...d,
    'Fiscal Year': Number(d['Fiscal Year']),
    ...Object.fromEntries(
      Object.entries(d).map(([key, value]) => 
        key.startsWith('exp_') || key.startsWith('rev_') ? [key, Number(value)] : [key, value]
      )
    )
  }))
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
    value: ["Abington", "Boston", "Cambridge"],
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
    transform: d => d / 1_000_000, // Convert to millions
    tickFormat: "~s"
  },
  x: {
    label: "Fiscal Year",
    tickFormat: d => d.toString()
  },
  marks: [
    Plot.line(filteredMunicipalities, {
      x: "Fiscal Year",
      y: selectedVariable.id,
      stroke: "Municipality",
      strokeWidth: 1.5
    }),
    Plot.dot(filteredMunicipalities, {
      x: "Fiscal Year",
      y: selectedVariable.id,
      stroke: "Municipality",
      fill: "white",
      tip: true,
      title: d => `${d.Municipality}
Fiscal Year: ${d['Fiscal Year']}
${selectedVariable.label}: $${(d[selectedVariable.id] / 1_000_000).toLocaleString(undefined, {maximumFractionDigits: 2})}M`
    })
  ],
  color: {
    legend: true
  },
  caption: `${selectedVariable.label} by municipality over time (in millions of dollars)`
})