---
title: Map
draft: true
---

# Map

```js
import * as topojson from "npm:topojson-client";
const ma = FileAttachment("data/TOWNSSURVEY_POLYM_GENCOAST.json").json();
```

```js
const mesh = topojson.mesh(ma, ma.objects.TOWNSSURVEY_POLYM_GENCOAST);

// https://observablehq.com/plot/marks/geo#geo-mark
const p = Plot.plot({
  // projection: "identity",
  width: 975,
  height: 610,
  axis: null,
  marks: [
    Plot.geo(mesh, {strokeOpacity: 0.5})
  ]
});

display(p);
```