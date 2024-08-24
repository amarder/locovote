---
title: Taxes and Spending
---

```js
const flows = FileAttachment("./data/flows.csv").csv({typed: true})
```

```js
const towns = flows.map(obj => obj.town);
const uniqueTowns = [...new Set(towns)];
const sortedUniqueTowns = uniqueTowns.sort();
const selected_town = view(Inputs.select(sortedUniqueTowns, {label: "Municipality: ", value: "Boston"}));
```

```js
const selected_flows = flows.filter(obj => obj.town === selected_town).filter(obj => obj.value > 0);
```

```js
import {SankeyChart} from "./components/sankey.js";

const sorted_flows = selected_flows.sort((a, b) => a.target.localeCompare(b.target));
const levy_cols = ["Residential Levy", "Open Space Levy", "Commercial Levy", "Industrial Levy", "Personal Prop Levy"];
const revenue_cols = ["Tax Levy", "State Aid", "Local Receipts", "Enterprise & CPA Funds", "Other Revenue"];
const spending_cols = ["General Government", "Police", "Fire", "Other Public Safety", "Education", "Public Works", "Human Services", "Culture and Recreation", "Fixed Costs", "Intergovernmental Assessments", "Other Expenditures", "Debt Service"];
const all_cols = [...levy_cols, ...revenue_cols, "Total Revenue", "Total Spending", "Budget Surplus", "Budget Defecit", ...spending_cols];

function node_sort(a, b) {
  all_cols.indexOf(a) > all_cols.indexOf(b);
}

function create_sankey(width) {
return SankeyChart({
  links: sorted_flows
}, {
  nodeGroup: d => d.id, // color group
  nodeAlign: "justify", // e.g., d3.sankeyJustify; set by input above
  linkColor: "#aaa", // e.g., "source" or "target"; set by input above
  format: (f => d => `${f(d)}`)(d3.format("$,.0~f")),
  width: width,
  height: 600,
  nodeSort: node_sort
});
}
```

<div class="grid grid-cols-1">
<div class="card">${resize(create_sankey)}</div>
</div>

This visualization has a few objectives:

- Where does the municipality (city or town) get its revenue?
- Where is the municipality spending money?
- How big are these dollar amounts (totals and per resident)?