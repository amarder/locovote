---
title: Schools
---

```js
const db = await DuckDBClient.of({base: FileAttachment("./data/mcas.db")});
```

```js
const data = db.sql`SELECT * FROM base.mcas WHERE district = 'Wayland'`
```

```js
Plot.plot({
  marks: [
    Plot.dot(data, {
      x: "No. of Students Included",
      y: "E #",
    })
  ]
})
```