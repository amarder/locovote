---
title: Tax Levies by Class
---

# Tax Levy Breakdown by Type

```js
const data = FileAttachment("./data/tax-levies.arrow").arrow()
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
// Define levy types
const levyTypes = [
  "Residential Levy",
  "Open Space Levy", 
  "Commercial Levy",
  "Industrial Levy",
  "Personal Property Levy"
];
```

```js
// Create a selector for levy type
const selectedLevyType = view(
  Inputs.select(
    levyTypes,
    {
      label: "Select levy type:",
      value: "Residential Levy"
    }
  )
);
```

```js
// Filter data based on selected municipalities and calculate percentages
const processedData = dataArray
  .filter(d => selectedMunicipalities.includes(d.Municipality))
  .map(d => {
    // Calculate total levy for this municipality/year
    const totalLevy = Number(d["Residential Levy"]) + 
                     Number(d["Open Space Levy"]) + 
                     Number(d["Commercial Levy"]) + 
                     Number(d["Industrial Levy"]) + 
                     Number(d["Personal Property Levy"]);
    
    // Calculate percentage for selected levy type
    const selectedLevyAmount = Number(d[selectedLevyType]);
    const percentage = totalLevy > 0 ? (selectedLevyAmount / totalLevy) * 100 : 0;
    
    return {
      ...d,
      TotalLevy: totalLevy,
      SelectedLevyAmount: selectedLevyAmount,
      Percentage: percentage
    };
  });
```

```js
// Create the percentage chart over time
Plot.plot({
  title: `${selectedLevyType} as Percentage of Total Tax Levy`,
  width: 800,
  height: 500,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Percentage of Total Levy (%)",
    type: "linear",
    domain: [0, 100]
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    // Line chart
    Plot.line(processedData, {
      x: "Fiscal Year",
      y: "Percentage",
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\nFiscal Year: ${d["Fiscal Year"]}\n${selectedLevyType}: ${d.Percentage.toFixed(1)}%\nAmount: $${Number(d.SelectedLevyAmount).toLocaleString()}\nTotal Levy: $${Number(d.TotalLevy).toLocaleString()}`
    }),
    // Points
    Plot.dot(processedData, {
      x: "Fiscal Year",
      y: "Percentage",
      fill: "Municipality",
      r: 3,
      title: d => `${d.Municipality}\nFiscal Year: ${d["Fiscal Year"]}\n${selectedLevyType}: ${d.Percentage.toFixed(1)}%\nAmount: $${Number(d.SelectedLevyAmount).toLocaleString()}\nTotal Levy: $${Number(d.TotalLevy).toLocaleString()}`
    })
  ]
})
```
