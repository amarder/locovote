---
title: Tax Rates by Class
---


# Tax Rates by Class

Understanding how Massachusetts municipalities set property tax rates across different property classes provides crucial insight into local fiscal policy and the relative tax burden on different types of properties.

<div class="tip" label="Key Questions">

- How much is property taxed in each municipality?
- How have these rates changed over time?

</div>

### What Are Tax Rate Classes?

Massachusetts property tax law divides all taxable property into five distinct classes, each with its own tax rate:

- **Residential Rate**: Single-family homes, condominiums, and small apartment buildings (up to 3 units)
- **Commercial Rate**: Office buildings, retail stores, restaurants, hotels, and other business properties
- **Industrial Rate**: Manufacturing facilities, warehouses, and industrial complexes
- **Personal Property Rate**: Business equipment, machinery, and other movable business assets
- **Open Space Rate**: Land designated for recreational, conservation, or agricultural use

## Time Trends

Select one or more municipalities and a tax rate type to compare how rates have changed over time. The chart shows the selected rate type for your chosen municipalities, making it easy to compare trends.

```js
const data = FileAttachment("./data/tax-rates.arrow").arrow()
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
// Define rate types
const rateTypes = [
  "Residential",
  "Open Space",
  "Commercial", 
  "Industrial",
  "Personal Property"
];
```

```js
// Create a selector for rate type
const selectedRateType = view(
  Inputs.select(
    rateTypes,
    {
      label: "Select rate type:",
      value: "Residential"
    }
  )
);
```

```js
// Filter data based on selected municipalities
const processedData = dataArray
  .filter(d => selectedMunicipalities.includes(d.Municipality))
  .map(d => ({
    Municipality: d.Municipality,
    "Fiscal Year": d["Fiscal Year"],
    "Tax Rate": Number(d[selectedRateType]) || 0
  }));
```

```js
// Create the tax rates chart
Plot.plot({
  title: `${selectedRateType} Tax Rate (per $1,000 of assessed value)`,
  width: 800,
  height: 500,
  x: {
    label: "Fiscal Year",
    type: "linear",
    tickFormat: d => d.toString()
  },
  y: {
    label: "Tax Rate (per $1,000)",
    type: "linear"
  },
  color: {
    legend: true,
    scheme: "category10"
  },
  marks: [
    // Line chart
    Plot.line(processedData, {
      x: "Fiscal Year",
      y: "Tax Rate",
      stroke: "Municipality",
      strokeWidth: 2,
      title: d => `${d.Municipality}\nFiscal Year: ${d["Fiscal Year"]}\n${selectedRateType} Rate: $${d["Tax Rate"].toFixed(2)} per $1,000`
    }),
    // Points
    Plot.dot(processedData, {
      x: "Fiscal Year",
      y: "Tax Rate",
      fill: "Municipality",
      r: 3,
      title: d => `${d.Municipality}\nFiscal Year: ${d["Fiscal Year"]}\n${selectedRateType} Rate: $${d["Tax Rate"].toFixed(2)} per $1,000`
    })
  ]
})
```

## About the Data

This analysis uses official tax rate data from the Massachusetts Division of Local Services (DLS), which tracks property tax rates for all 351 cities and towns in the Commonwealth. Tax rates are expressed as dollars per $1,000 of assessed value, showing how much property owners pay in taxes for each $1,000 their property is worth.

**Data Source**: [Massachusetts Division of Local Services Tax Rates by Class Report](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=PropertyTaxInformation.taxratesbyclass.taxratesbyclass&rdSubReport=True&rdResizeFrame=True)

**Additional Resources**: Explore all [Division of Local Services Databank Reports](https://www.mass.gov/collections/DLS-databank-reports) for comprehensive municipal finance data.