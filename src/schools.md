---
title: Schools
---

```js
const db = await DuckDBClient.of({base: FileAttachment("./data/mcas.db")});
```

```js
const districts = await db.query("SELECT DISTINCT district FROM base.mcas ORDER BY district");
```

```js
const first_district = districts.get(1);
```

Select a district to view MCAS results:

```js
const selection = view(Inputs.table(districts, {
    required: true,
    multiple: false
}));
```

```js
const ss = {district: "Boston"};
if (selection === null) {
    console.log("skip");
}
else {
    ss.district = selection.district;
}
// debugger;
```

```js
const data = db.sql`SELECT *, 100 * (n_e / n) AS p_e FROM base.mcas WHERE district = ${ss.district}`
```

Below is a plot of the data for this district.

```js
Plot.plot({
  title: ss.district,
  y: {domain: [0, 100], label: "Exceeding expectations (%)"},
  x: {domain: [3, 10], label: "Grade"},
  facet: {data: data, y: "year", x: "Subject"},
  inset: 10,
  marks: [
    Plot.frame(),
    Plot.line(data, {
        x: "grade",
        y: "p_e",
        stroke: "school",
        z: "school",
    }),
    Plot.dot(data, {
      x: "grade",
      y: "p_e",
      fill: "school",
      tip: true
    })
  ]
})
```