---
title: Population
---

# Population

<div class="tip" label="Key Questions">

- How many people live in my town?
- How has this evolved over time?
- How does my town compare to neighboring communities?

</div>

## Time Trends

```js
const data = FileAttachment("/data/population.arrow").arrow()
```

```js
// Convert Arrow table to JavaScript array
const dataArray = Array.from(data);
```

```js
// Get unique municipalities and sort them
const uniqueMunicipalities = Array.from(new Set(dataArray.map(d => d.Municipality))).sort();
```

```js
// Create a multi-select input for municipalities
const selectedMunicipalities = view(
  Inputs.select(
    uniqueMunicipalities,
    {
      label: "Select municipalities:",
      value: ["Boston"],
      multiple: true,
      sort: false // Already sorted above
    }
  )
);
```

```js
// Filter data based on selected municipalities
const filteredData = dataArray.filter(d => selectedMunicipalities.includes(d.Municipality));
```

```js
// Create the population vs year chart
Plot.plot({
  title: "Population Over Time by Municipality",
  width: 800,
  height: 500,
  x: {
    label: "Year",
    type: "linear",
    tickFormat: d => d.toString() // Remove comma formatting from years
  },
  y: {
    label: "Population (thousands)",
    type: "linear"
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    // Line chart
    Plot.line(filteredData, {
      x: "Year",
      y: d => Number(d.Population) / 1000, // Convert BigInt to number, then to thousands
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\nYear: ${d.Year}\nPopulation: ${Number(d.Population).toLocaleString()}`
    }),
    // Points
    Plot.dot(filteredData, {
      x: "Year",
      y: d => Number(d.Population) / 1000, // Convert BigInt to number, then to thousands
      fill: "Municipality",
      r: 3,
      title: d => `${d.Municipality}\nYear: ${d.Year}\nPopulation: ${Number(d.Population).toLocaleString()}`
    })
  ]
})
```

## About the Data

This population data is sourced from the Massachusetts Department of Revenue's Division of Local Services, which reports official population estimates based on US Census Bureau data. These estimates provide a reliable foundation for understanding demographic trends across Massachusetts municipalities.

The interactive chart above allows you to compare population changes over time across different communities, helping you identify growth patterns, demographic shifts, and how your town compares to its neighbors.

**Data Source:** [Massachusetts DOR Division of Local Services](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Socioeconomic.Population.Population&rdSubReport=True)

For additional socioeconomic data and context, visit the [Massachusetts Socioeconomic Data portal](https://www.mass.gov/info-details/socioeconomic-data).
