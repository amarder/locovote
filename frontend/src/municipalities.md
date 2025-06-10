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

## Snapshot

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

---

```js
// Display the filtered data in a table
Inputs.table(filteredData)
```
