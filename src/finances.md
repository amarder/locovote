---
title: Taxes and Spending
---

```js
const municipalities = FileAttachment("./data/municipalities.csv").csv({typed: true})
```

```js
const towns = municipalities.map(obj => obj.Municipality);
const uniqueTowns = [...new Set(towns)];
const sortedUniqueTowns = uniqueTowns.sort();
const selected_town = view(Inputs.select(sortedUniqueTowns, {label: "Municipality: ", value: "Boston"}));
```

```js
const selected_municipality = municipalities.filter(obj => obj.Municipality === selected_town)[0];
```

```js
const levy_cols = ["Residential Levy", "Open Space Levy", "Commercial Levy", "Industrial Levy", "Personal Prop Levy"];
const revenue_cols = ["State Aid", "Local Receipts", "Enterprise & CPA Funds", "Other Revenue"];
const spending_cols = ["General Government", "Police", "Fire", "Other Public Safety", "Education", "Public Works", "Human Services", "Culture and Recreation", "Fixed Costs", "Intergovernmental Assessments", "Other Expenditures", "Debt Service"];

const spending_data = spending_cols.map(key => ({key: key, value: selected_municipality[key]}));
const rev_data = [...levy_cols, ...revenue_cols].map(key => ({key: key, value: selected_municipality[key]}))

function my_hist(title, data) {
  return Plot.plot({
  title: title,
  grid: true,
  marks: [
    Plot.barX(data, {
      y: "key",
      x: "value",
      sort: {y: "x", order: "descending"},
      tip: "y"
    }),
  ],
  x: {
    transform: (d) => d / 1e6,
    label: "Amount (millions)"
  },
  y: {
    label: ""
},
  marginLeft: 200
});
}
```

<div class="grid grid-cols-2">
<div class="card">${my_hist("FY2022 Expenditures", spending_data)}</div>
<div class="card">${my_hist("FY2023 Revenues", rev_data)}</div>
</div>

This visualization has a few objectives:

- Where is the municipality spending money?
- Where does the municipality (city or town) get its revenue?
- How big are these dollar amounts (totals and per resident)? percentages