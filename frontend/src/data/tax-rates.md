---
title: Tax Rates by Class
---

# Tax Rates by Class

<div class="tip" label="Key Questions">

- How much is property taxed in each municipality?
- How have these rates changed over time?

</div>

## About Tax Rate Classes

Massachusetts property tax law divides all taxable property into five distinct classes, each with its own tax rate:

- **Residential**: Single-family homes, condominiums, and small apartment buildings (up to 3 units)
- **Commercial**: Office buildings, retail stores, restaurants, hotels, and other business properties
- **Industrial**: Manufacturing facilities, warehouses, and industrial complexes
- **Personal Property**: Business equipment, machinery, and other movable business assets
- **Open Space**: Land designated for recreational, conservation, or agricultural use

## Time Trends

Compare tax rates across municipalities over time by selecting locations and a property class below. The interactive chart helps visualize how different communities set their tax rates and how these rates have changed through the years.

```js
const data = FileAttachment("/data/tax-rates.arrow").arrow()
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
      label: "Select property class:",
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

This analysis uses official tax rate data from the Massachusetts Division of Local Services (DLS), which tracks property tax rates for all 351 cities and towns across the Commonwealth. 

Tax rates are expressed as dollars per $1,000 of assessed value—showing exactly how much property owners pay in taxes for each $1,000 their property is worth according to municipal assessments.

**Data Source**: [Massachusetts Division of Local Services Tax Rates by Class Report](https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=PropertyTaxInformation.taxratesbyclass.taxratesbyclass&rdSubReport=True&rdResizeFrame=True)
