---
title: Schools
---

# Schools

```js
const db = DuckDBClient.of({mcas: FileAttachment("./data/mcas.parquet")});
```

```js
const schools = db.query("SELECT DISTINCT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code FROM mcas ORDER BY district, school");
```

Search for the schools you're interested in:

```js
const search = view(Inputs.search(schools));
```

Select schools in the table below to view their standardized test results:

```js
// debugger;

const selection = view(Inputs.table(search, {
    required: false,
    multiple: true,
    value: search.slice(0, 1)
}));
```

```js
if (selection.length > 0) {

// Below is a plot of the data for the selected schools.

const my_list = selection.map((x) => `'${x.school_code}'`).join(", ");
const data = await db.query(`SELECT *, 100 * (n_e / n) AS p_e FROM mcas WHERE ORG_CODE IN (${my_list})`);
const my_plot = Plot.plot({
  title: "Percentage of students exceeding expectations by school, grade, subject, and year",
  y: {domain: [0, 100], label: "Exceeding expectations (%)"},
  x: {domain: [3, 10], label: "Grade"},
  facet: {data: data, y: "year", x: "SUBJECT_CODE"},
  inset: 10,
  color: {legend: true},
  marks: [
    Plot.frame(),
    Plot.line(data, {
        x: "grade",
        y: "p_e",
        stroke: "ORG_NAME",
        z: "ORG_NAME",
    }),
    Plot.dot(data, {
      x: "grade",
      y: "p_e",
      fill: "ORG_NAME",
      tip: true
    })
  ]
});
display(my_plot);
}
```

Planned improvements:

- Make table of schools more informative
- Improve labels (ELA = English Language Arts, years generally don't have commas)
- Speed up page load

Data comes from the [Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/Next-Generation-MCAS-Achievement-Results/i9w6-niyt/about_data).
