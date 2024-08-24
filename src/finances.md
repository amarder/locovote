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
const selected_flows = flows.filter(obj => obj.town === selected_town);
```

```js
import {SankeyChart} from "./components/sankey.js";

const sorted_flows = selected_flows.sort((a, b) => a.target.localeCompare(b.target));
const chart = SankeyChart({
  links: sorted_flows
}, {
  nodeGroup: d => d.id.split(/\W/)[0], // take first word for color
  nodeAlign: "justify", // e.g., d3.sankeyJustify; set by input above
  linkColor: "#aaa", // e.g., "source" or "target"; set by input above
  format: (f => d => `${f(d)}`)(d3.format("$,.0~f")),
  width,
  height: 600
})
```

<div class="grid grid-cols-1">
<div class="card">${chart}</div>
</div>

This visualization has a few objectives:

- Where does the municipality (city or town) get its revenue?
- Where is the municipality spending money?
- How big are these dollar amounts (totals and per resident)?