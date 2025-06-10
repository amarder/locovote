---
title: Municipalities
---

```js
const data = FileAttachment("./data/municipalities.arrow").arrow();
```

```js
// Convert Arrow table to JavaScript array
const municipalityData = [...data];
```

```js
display(municipalityData);
```

```js
// Get unique municipalities for the dropdown
const municipalities = [...new Set(municipalityData.map(d => d.Municipality))].sort()
```

```js
// Create dropdown input for municipality selection
const selectedMunicipality = view(Inputs.select(municipalities, {
  label: "Select Municipality:",
  value: "Boston"
}))
```

```js
// Filter data based on selected municipality
const filteredData = municipalityData.filter(d => d.Municipality === selectedMunicipality)
```

```js
// Display the filtered data in a table
Inputs.table(filteredData)
```

## Population

```js
// Create population trend chart
Plot.plot({
  title: `Population Trend for ${selectedMunicipality}`,
  x: {
    label: "Fiscal Year",
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

