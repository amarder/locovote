---
title: Schools
---

# Schools

<div class="tip" label="Key Questions">

- How well do schools in my community perform academically?
- What percentage of students meet or exceed state standards on MCAS tests?
- How does MCAS performance vary by year, grade, and subject?

</div>

```js
import SQLite from "npm:@observablehq/sqlite";

const db = FileAttachment("/data/mcas.db").sqlite();
```

```js
// const schools = db.query("SELECT DISTINCT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code FROM mcas ORDER BY district, school");
const schools = db.query("SELECT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code, SUBSTR(ORG_CODE, -4) = '0000' AS is_district, 100*SUM(n_e)/SUM(n) AS pct_e, 100*SUM(n_me)/SUM(n) AS pct_me, SUM(n) as n FROM mcas WHERE NOT is_district GROUP BY DIST_NAME, ORG_NAME, ORG_CODE ORDER BY district, school");

```

Select a school from the table below to explore MCAS performance data. Use the search functionality to quickly find schools by name.

```js
const search = view(Inputs.search(schools, {format: (x) => x.toLocaleString() + " Schools"}));
```

```js
// Get initial school from URL parameter
function getInitialSelection() {
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  
  if (codeParam) {
    const schoolFromUrl = search.find(school => school.school_code === codeParam);
    if (schoolFromUrl) {
      return schoolFromUrl;
    }
  }
  
  // Default to the 8th school if no URL parameter or school not found
  return search.slice(7, 8)[0];
}

const my_table = Inputs.table(search, {
    required: true,
    multiple: false,
    value: getInitialSelection(),
    columns: ["district", "school", "pct_e", "pct_me", "n"],
    header: {"district": "District", "school": "School", "pct_e": "Exceeding (%)", "pct_me": "Meeting or Exceeding (%)", "n": "# Tests"},
    format: {pct_e: (x) => x.toFixed(1), pct_me: (x) => x.toFixed(1)}
});

const selection = view(my_table);
```

```js
// Update URL when selection changes (reactive cell)
if (selection && selection.school_code) {
  const url = new URL(window.location);
  url.searchParams.set('code', selection.school_code);
  window.history.replaceState({}, '', url);
}
```

<div class="card">${my_table}</div>

```js
function createSchoolSummary() {
  if (!selection) {
    return html`<div class="card">
      <h3>School Summary</h3>
      <p>Please select a school from the table above to see details.</p>
    </div>`;
  }
  
  return html`<div>
        <h4 style="margin: 0 0 5px 0; color: #666;">School</h4>
        <p style="padding-bottom: 40;font-size: 1.1em; font-weight: 500;">${selection.school}</p>
      </div>
      <div>
        <h4 style="margin: 0 0 5px 0; color: #666;">District</h4>
        <p style="padding-bottom: 40;font-size: 1.1em; font-weight: 500;">${selection.district}</p>
      </div>
      <div>
        <h4 style="margin: 0 0 5px 0; color: #666;">Meeting or Exceeding Expectations</h4>
        <p style="padding-bottom: 40;font-size: 1.3em; font-weight: bold;">${selection.pct_me.toFixed(1)}%</p>
      </div>
      <div>
        <h4 style="margin: 0 0 5px 0; color: #666;">Exceeding Expectations</h4>
        <p style="padding-bottom: 40;font-size: 1.3em; font-weight: bold;">${selection.pct_e.toFixed(1)}%</p>
      </div>
      <div>
        <h4 style="margin: 0 0 5px 0; color: #666;">Total Tests</h4>
        <p style="padding-bottom: 40;font-size: 1.3em; font-weight: bold;">${selection.n.toLocaleString()}</p>
      </div>`;
}
```

```js
async function createPerformanceChart(xAxis, title) {
  if (!selection) {
    return html`<div class="card">
      <h3>${title}</h3>
      <p>Please select a school from the table above to see the chart.</p>
    </div>`;
  }
  
  const xAxisMap = {year: "year", grade: "grade", subject: "SUBJECT_CODE"};
  const xAxisColumn = xAxisMap[xAxis];
  
  const query = `SELECT ${xAxisColumn}, 
    100*SUM(n_me - n_e)/SUM(n) AS meeting_only, 
    100*SUM(n_e)/SUM(n) AS exceeding 
    FROM mcas WHERE ORG_CODE = "${selection.school_code}" 
    GROUP BY ${xAxisColumn} 
    ORDER BY ${xAxisColumn}`;
    
  const data = await db.query(query);
  
  // Skip chart if only one data point
  if (data.length <= 1) {
    return "";
  }
  
  // Transform data for stacked chart
  const stackedData = data.flatMap(d => [
    {...d, performance: "Exceeding Expectations", value: d.exceeding},
    {...d, performance: "Meeting Expectations", value: d.meeting_only}
  ]);
  
  const xLabels = {year: "Year", grade: "Grade", subject: "Subject"};
  const subjectLabels = {"ELA": "English", "MATH": "Math", "SCI": "Science"};
  
  // Configure x-axis formatting based on axis type
  let xConfig = {label: xLabels[xAxis]};
  if (xAxis === "year") {
    xConfig.tickFormat = d => d.toString(); // No commas for years
  } else if (xAxis === "subject") {
    xConfig.tickFormat = d => subjectLabels[d] || d;
  }
  
  const plot = Plot.plot({
    width: 400,
    height: 300,
    y: {domain: [0, 100], label: "Percentage of Students (%)"},
    x: xConfig,
    color: {
      domain: ["Exceeding Expectations", "Meeting Expectations"],
      range: ["#059669", "#2563eb"],
      legend: true
    },
    marks: [
      Plot.rectY(stackedData, {
        x: xAxisColumn,
        y: "value",
        fill: "performance",
        order: ["Exceeding Expectations", "Meeting Expectations"],
        tip: true
      })
    ]
  });
  
  return html`<div class="card">
    <h3>${title}</h3>
    ${plot}
  </div>`;
}
```

<div class="grid grid-cols-2">
  <div class="card">${createSchoolSummary()}</div>
  ${createPerformanceChart("year", "MCAS Performance Over Time")}
  ${createPerformanceChart("grade", "MCAS Performance by Grade Level")}
  ${createPerformanceChart("subject", "MCAS Performance by Subject Area")}
</div>

```js
async function createDetailedPerformanceChart() {
  if (!selection) {
    return html`
      <h3>MCAS Performance Over Time by Subject and Grade</h3>
      <p>Please select a school from the table above to see the chart.</p>
    `;
  }
  
  const query = `SELECT year, grade, SUBJECT_CODE, 
    100*SUM(n_me - n_e)/SUM(n) AS meeting_only, 
    100*SUM(n_e)/SUM(n) AS exceeding 
    FROM mcas WHERE ORG_CODE = "${selection.school_code}" 
    GROUP BY year, grade, SUBJECT_CODE 
    ORDER BY year, grade, SUBJECT_CODE`;
    
  const data = await db.query(query);
  
  if (data.length === 0) {
    return html`
      <h3>Academic Performance Over Time by Subject and Grade</h3>
      <p>No data available for this school.</p>`;
  }
  
  // Skip chart if only one grade
  const uniqueGrades = [...new Set(data.map(d => d.grade))];
  if (uniqueGrades.length <= 1) {
    return "";
  }
  
  // Transform data for stacked chart
  const stackedData = data.flatMap(d => [
    {...d, performance: "Exceeding Expectations", value: d.exceeding},
    {...d, performance: "Meeting Expectations", value: d.meeting_only}
  ]);
  
  const subjectLabels = {"ELA": "English", "MATH": "Math", "SCI": "Science"};
  
  const plot = Plot.plot({
    width: 830,
    height: 500,
    y: {domain: [0, 100], label: "Percentage of Students (%)"},
    x: {label: "Year", tickFormat: d => d.toString()},
    facet: {
      data: stackedData, 
      x: "SUBJECT_CODE", 
      y: "grade",
      label: null
    },
    fx: {
      label: "Subject",
      tickFormat: d => subjectLabels[d] || d
    },
    fy: {
      label: "Grade"
    },
    color: {
      domain: ["Exceeding Expectations", "Meeting Expectations"],
      range: ["#059669", "#2563eb"],
      legend: true
    },
    inset: 10,
    marks: [
      Plot.frame(),
      Plot.rectY(stackedData, {
        x: "year",
        y: "value",
        fill: "performance",
        order: ["Exceeding Expectations", "Meeting Expectations"],
        tip: true
      })
    ]
  });
  
  return html`<div class="card">
    <h3>MCAS Performance Over Time by Subject and Grade</h3>
    ${plot}
  </div>`
}
display(await createDetailedPerformanceChart());
```

## About the Data

The performance data comes from the Massachusetts Comprehensive Assessment System (MCAS), the state's standardized testing program that measures student achievement across core academic subjects. All data is sourced from the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data).

**Performance Level Definitions:**
- **Exceeding Expectations:** Students demonstrate comprehensive understanding and advanced skills that go beyond grade-level standards
- **Meeting or Exceeding Expectations:** Students meet or surpass the minimum proficiency requirements established for their grade level

The data includes test results across multiple years, grade levels, and subject areas, providing our best view into each school's academic performance trends.

**Technical Details:**
For reference, the raw data table below shows the underlying MCAS records for the selected school.

```js
const rows = db.query(`SELECT * FROM mcas WHERE ORG_CODE = "${selection.school_code}"`);
```

<div class="card">${view(Inputs.table(rows))}</div>
