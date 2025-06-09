---
title: Schools
---

# Schools

<div class="tip" label="Key Questions">

- How well do schools in my community perform academically?
- What percentage of students meet or exceed state standards on MCAS tests?
- How do different schools and districts compare over time?

</div>

```js
import SQLite from "npm:@observablehq/sqlite";

const db = FileAttachment("data/mcas.db").sqlite();
```

```js
// const schools = db.query("SELECT DISTINCT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code FROM mcas ORDER BY district, school");
const schools = db.query("SELECT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code, SUBSTR(ORG_CODE, -4) = '0000' AS is_district, 100*SUM(n_e)/SUM(n) AS pct_e, 100*SUM(n_me)/SUM(n) AS pct_me FROM mcas GROUP BY DIST_NAME, ORG_NAME, ORG_CODE ORDER BY district, school");

```

Select one or more schools or districts from the table below to explore their MCAS performance data. You can search by name and compare multiple institutions side-by-side.

```js
const search = view(Inputs.search(schools));
```

```js
// debugger;

const my_table = Inputs.table(search, {
    required: false,
    multiple: true,
    value: search.slice(9, 10),
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
return "Select schools or districts from the table above to visualize their performance trends and compare results.";
}
```

<div class="card">${make_plot()}</div>

---

## About the Data

Test results are from the Massachusetts Comprehensive Assessment System (MCAS), the state's standardized testing program. Data is provided by the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data).

**Understanding the Metrics:**
- **Exceeding Expectations:** Students demonstrate comprehensive understanding and skills beyond grade-level standards
- **Meeting or Exceeding Expectations:** Students meet or surpass the minimum proficiency standards for their grade level
