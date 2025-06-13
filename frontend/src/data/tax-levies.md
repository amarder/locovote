---
title: Tax Levies by Class
---

# Tax Levies by Class

Understanding how Massachusetts municipalities generate property tax revenue across different property classes provides crucial insight into local fiscal health and economic composition.

<div class="tip" label="Key Questions">

- How does the tax burden distribute between residential and commercial properties?
- Which municipalities rely more heavily on business taxes versus residential taxes?
- How have these patterns changed over time?

</div>

### What Are Tax Levy Classes?

Massachusetts property tax law divides all taxable property into five distinct classes, each with its own tax rate:

- **Residential Levy**: Single-family homes, condominiums, and small apartment buildings (up to 3 units)
- **Commercial Levy**: Office buildings, retail stores, restaurants, hotels, and other business properties
- **Industrial Levy**: Manufacturing facilities, warehouses, and industrial complexes
- **Personal Property Levy**: Business equipment, machinery, and other movable business assets
- **Open Space Levy**: Land designated for recreational, conservation, or agricultural use

## Time Trends

Select one or more municipalities from the dropdown to compare their tax composition. Choose different levy types to see how each contributes to the total tax revenue over time. The chart shows each levy type as a percentage of the municipality's total property tax levy, helping you understand the relative importance of different property classes.

```js
const data = FileAttachment("/data/tax-levies.arrow").arrow()
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

## About the Data

This analysis uses official tax levy data from the Massachusetts Division of Local Services (DLS), which tracks property tax information for all 351 cities and towns in the Commonwealth. The data shows how much tax revenue each municipality collects from different property classes, providing insight into local economic composition and fiscal strategies.

**Data Source**: [Massachusetts Division of Local services Tax Levies by Class Report](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=PropertyTaxInformation.TaxLevies.LeviesByClass&rdSubReport=True&rdResizeFrame=True)

**Additional Resources**: Explore all [Division of Local Services Databank Reports](https://www.mass.gov/collections/DLS-databank-reports) for comprehensive municipal finance data.