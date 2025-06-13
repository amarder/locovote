---
title: School Districts
---

# School Districts

<div class="tip" label="Key Questions">

- How does my school district perform academically?
- What percentage of students meet or exceed state standards on MCAS tests?
- How does MCAS performance change by year, grade, and subject?

</div>

```js
import SQLite from "npm:@observablehq/sqlite";

const db = FileAttachment("/data/mcas.db").sqlite();
```

```js
// const districts = db.query("SELECT DISTINCT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code FROM mcas ORDER BY district, school");
const districts = db.query("SELECT DIST_NAME AS district, ORG_NAME AS school, ORG_CODE AS school_code, SUBSTR(ORG_CODE, -4) = '0000' AS is_district, 100*SUM(n_e)/SUM(n) AS pct_e, 100*SUM(n_me)/SUM(n) AS pct_me, SUM(n) as n FROM mcas WHERE is_district GROUP BY DIST_NAME, ORG_NAME, ORG_CODE ORDER BY district, school");

```

Select a school district from the table below to explore its MCAS test results. Use the search bar to quickly find districts by name.

```js
const search = view(Inputs.search(districts, {format: (x) => x.toLocaleString() + " Districts"}));
```

```js
// Get initial district from URL parameter
function getInitialSelection() {
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  
  if (codeParam) {
    const districtFromUrl = search.find(district => district.school_code === codeParam);
    if (districtFromUrl) {
      return districtFromUrl;
    }
  }
  
  // Default to the 8th district if no URL parameter or district not found
  return search.slice(3, 4)[0];
}

const my_table = Inputs.table(search, {
    required: true,
    multiple: false,
    value: getInitialSelection(),
    columns: ["district", "pct_e", "pct_me", "n"],
    header: {"district": "District", "pct_e": "Exceeding (%)", "pct_me": "Meeting or Exceeding (%)", "n": "# Tests"},
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
function createDistrictSummary() {
  if (!selection) {
    return html`<div class="card">
      <h3>District Summary</h3>
      <p>Please select a district from the table above to view its details.</p>
    </div>`;
  }
  
  return html`<div>
        <h4 style="margin: 0 0 5px 0; color: #666;">District</h4>
        <p style="padding-bottom: 40;font-size: 1.1em; font-weight: 500;">${selection.school}</p>
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
      <p>Please select a district from the table above to view this chart.</p>
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

```js
async function renderDashboard() {
  if (!selection) {
    return html`<div class="card">Select a school district in the table above.</div>`;
  }
  
  // Await all the chart promises
  const [yearChart, gradeChart, subjectChart] = await Promise.all([
    createPerformanceChart("year", "MCAS Performance by Year"),
    createPerformanceChart("grade", "MCAS Performance by Grade"),
    createPerformanceChart("subject", "MCAS Performance by Subject")
  ]);
  
  return html`<div class="grid grid-cols-2">
    <div class="card">${createDistrictSummary()}</div>
    ${yearChart}
    ${gradeChart}
    ${subjectChart}
  </div>`;
}

display(await renderDashboard());
```

```js
async function createDetailedPerformanceChart() {
  if (!selection) {
    return html`
      <h3>MCAS Performance by Year, Subject, and Grade</h3>
      <p>Please select a district from the table above to view this chart.</p>
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
      <h3>Academic Performance by Year, Subject, and Grade</h3>
      <p>No data available for this district.</p>`;
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
    height: 800,
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
    <h3>MCAS Performance by Year, Grade, and Subject</h3>
    ${plot}
  </div>`
}
display(await createDetailedPerformanceChart());
```

## About the Data

The performance data is sourced from the Massachusetts Comprehensive Assessment System (MCAS), the state's standardized testing program for measuring student achievement in core academic subjects. All data comes from the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data).

**Performance Level Definitions:**
- **Exceeding Expectations:** Students demonstrate a comprehensive understanding and advanced skills that go beyond grade-level standards.
- **Meeting or Exceeding Expectations:** Students meet or surpass the minimum proficiency requirements for their grade level.

The data includes test results across multiple years, grade levels, and subject areas, providing an excellent view into each district's academic performance trends.

To view results for individual schools, visit the [Schools page](./schools).