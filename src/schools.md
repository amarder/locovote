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

Select schools or districts in the table below to view their standardized test results.

```js
const search = view(Inputs.search(schools));
```

```js
// debugger;

const my_table = Inputs.table(search, {
    required: false,
    multiple: true,
    value: search.slice(0, 1),
    columns: ["district", "school", "pct_e", "pct_me", "is_district"],
    header: {"district": "District", "school": "Name", "pct_e": "Exceeding (%)", "pct_me": "Meeting or Exceeding (%)", "is_district": "Type"},
    format: {pct_e: (x) => x.toFixed(1), pct_me: (x) => x.toFixed(1), is_district: (x) => x ? "District" : "School"}
});

const selection = view(my_table);
```

<div class="card">${my_table}</div>

```js
const y_labels = {n_e: "Exceeding Expectations (%)", n_me: "Meeting or Exceeding Expectations (%)"};
const y = view(Inputs.select(["n_e", "n_me"], {label: "Y-Axis", format: (x) => y_labels[x]}));
```

```js
const x_labels = {year: "Year", grade: "Grade", SUBJECT_CODE: "Subject"};
const x = view(Inputs.select(["year", "grade"], {label: "X-Axis", format: (x) => x_labels[x]}));
```

```js
const all_facets = ["year", "grade", "SUBJECT_CODE"];
const available_facets = all_facets.filter(facet => facet !== x);
const facets = view(Inputs.select(available_facets, {label: "Facets", format: (x) => x_labels[x], multiple: true}));
```

```js
async function make_plot() {
if (selection.length > 0) {
const my_list = selection.map((x) => `'${x.school_code}'`).join(", ");
const groups = [x, ...facets, "ORG_CODE", "ORG_NAME"];
const group_list = groups.join(", ");
const my_query = `SELECT ${group_list}, 100*SUM(${y})/SUM(n) AS y FROM mcas WHERE ORG_CODE IN (${my_list}) GROUP BY ${group_list}`;
const data = await db.query(my_query);
const my_plot = Plot.plot({
  title: "Student performance by school, grade, subject, and year",
  y: {domain: [0, 100], label: y_labels[y]},
  x: {label: x_labels[x]},
  facet: {data: data, y: facets[0], x: facets[1]},
  inset: 10,
  color: {legend: true},
  marks: [
    Plot.frame(),
    Plot.line(data, {
        x: x,
        y: "y",
        stroke: "ORG_NAME",
        z: "ORG_NAME",
    }),
    Plot.dot(data, {
      x: x,
      y: "y",
      fill: "ORG_NAME",
      tip: true
    })
  ]
});
return my_plot;
}
return "Select a row in the table above to see the corresponding data.";
}
```

<div class="card">${make_plot()}</div>

Data comes from the [Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/Next-Generation-MCAS-Achievement-Results/i9w6-niyt/about_data).
