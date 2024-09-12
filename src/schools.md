---
title: Schools
---

```js
const db = await DuckDBClient.of({base: FileAttachment("./data/mcas.db")});
```

```js
const schools = await db.query("SELECT DISTINCT district, school, school_code FROM base.mcas ORDER BY district, school");
```

Search for the schools you're interested in:

```js
const search = view(Inputs.search(schools));
```

Select schools in the table below to view their standardized test results:

```js
const selection = view(Inputs.table(search, {
    required: false,
    multiple: true
}));
```

```js
if (selection.length > 0) {

// Below is a plot of the data for the selected schools.

const my_list = selection.map((x) => `'${x.school_code}'`).join(", ");
const data = await db.query(`SELECT *, 100 * (n_e / n) AS p_e FROM base.mcas WHERE school_code IN (${my_list})`);
const my_plot = Plot.plot({
  title: "Percentage of students exceeding expectations by school, grade, subject, and year",
  y: {domain: [0, 100], label: "Exceeding expectations (%)"},
  x: {domain: [3, 10], label: "Grade"},
  facet: {data: data, y: "year", x: "Subject"},
  inset: 10,
  color: {legend: true},
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
});
display(my_plot);
}
```

## TODO

- Incorporate the latest data
- If no schools are selected hide the last plot
- Make table of schools more informative
- Improve labels (ELA = English Language Arts, years generally don't have commas)
- Make it easier to compare schools in different towns (modify how search works)