---
title: Schools
---

# Schools

```js
const db = DuckDBClient.of({mcas: FileAttachment("./data/mcas.parquet")});
```

```js
// const schools = db.query("SELECT DISTINCT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code FROM mcas ORDER BY district, school");
const schools = db.query("SELECT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code, ends_with(school_code, '0000') AS is_district, 100*SUM(n_e)/SUM(n) AS pct_e, 100*SUM(n_me)/SUM(n) AS pct_me FROM mcas GROUP BY DIST_NAME, ORG_NAME, ORG_CODE ORDER BY district, school");

```

Search for the schools you're interested in:

```js
const search = view(Inputs.search(schools));
```

Select schools and/or school districts in the table below to view their standardized test results:

```js
// debugger;

const selection = view(Inputs.table(search, {
    required: false,
    multiple: true,
    value: search.slice(0, 1),
    columns: ["district", "school", "pct_e", "pct_me", "is_district"],
    header: {"district": "District", "school": "Name", "pct_e": "Exceeding (%)", "pct_me": "Meeting or Exceeding (%)", "is_district": "Type"},
    format: {pct_e: (x) => x.toFixed(1), pct_me: (x) => x.toFixed(1), is_district: (x) => x ? "District" : "School"}
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

Data comes from the [Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/Next-Generation-MCAS-Achievement-Results/i9w6-niyt/about_data).
