---
title: Compare School Districts
toc: true
---

# Compare School Districts

This tool allows you to compare the academic performance of different Massachusetts school districts over time. Use the search box below to select districts and explore how they differ in MCAS test results across subjects, grades, and years.

<div class="tip" label="Key Questions This Tool Answers">

- **How do different districts compare academically?** See performance trends across multiple districts.
- **How does performance vary by subject?** Compare districts in English, Math, and Science.
- **Are there grade-level differences?** Analyze performance patterns across elementary, middle, and high school grades.

</div>

### Select School Districts to Compare

Choose multiple school districts to compare their MCAS performance. Popular comparisons include neighboring districts, similar-sized districts, or districts you're considering for your family.

```js
import {searchCheckbox} from "./components/search-select.js"
import * as Plot from "npm:@observablehq/plot";
import SQLite from "npm:@observablehq/sqlite";
```

```js
const db = FileAttachment("data/mcas.db").sqlite();
```

```js
// Get district names for selection
const districts = await db.query("SELECT DISTINCT DIST_NAME AS district FROM mcas WHERE SUBSTR(ORG_CODE, -4) = '0000' ORDER BY district");
const districtNames = districts.map(d => d.district);
```

```js
const selected = view(searchCheckbox(districtNames, { urlParam: "districts", value: ["Boston", "Cambridge"]}));
```

```js
// Subject labels for display
const subjectLabels = {"ELA": "English", "MATH": "Math", "SCI": "Science"};
```

## Overall Performance

This table shows the overall MCAS performance for each selected school district, aggregated across all years, grades, and subjects in the dataset.

```js
async function createDistrictComparisonTable() {
  if (selected.length === 0) {
    return html`<div style="padding: 20px; text-align: center; color: #666; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p>Select school districts to view comparison table</p>
    </div>`;
  }
  
  const districtList = selected.map(d => `'${d}'`).join(',');
  
  const query = `
    SELECT 
      DIST_NAME as district,
      100.0 * SUM(n_e) / SUM(n) as pct_exceeding,
      100.0 * SUM(n_me) / SUM(n) as pct_meeting_or_exceeding,
      SUM(n) as total_tests
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND n > 0
    GROUP BY DIST_NAME
    ORDER BY DIST_NAME
  `;
  
  const data = await db.query(query);
  
  // Reorder data to match selection order
  const orderedData = selected.map(selectedDistrict => 
    data.find(d => d.district === selectedDistrict)
  ).filter(d => d !== undefined);
  
  return Inputs.table(orderedData, {
    columns: ["district", "pct_meeting_or_exceeding", "pct_exceeding", "total_tests"],
    header: {
      "district": "School District", 
      "pct_meeting_or_exceeding": "Meeting or Exceeding (%)", 
      "pct_exceeding": "Exceeding (%)", 
      "total_tests": "# Tests"
    },
    format: {
      pct_meeting_or_exceeding: (x) => x.toFixed(1), 
      pct_exceeding: (x) => x.toFixed(1),
      total_tests: (x) => x.toLocaleString()
    },
    width: {
      district: 200,
      pct_meeting_or_exceeding: 120,
      pct_exceeding: 100,
      total_tests: 80
    }
  });
}
```

<div class="card">${await createDistrictComparisonTable()}</div>

## Performance by Year

This chart shows how districts compare on the two key performance metrics over time. Each line represents a different district, with separate panels for "Exceeding Expectations" and "Meeting or Exceeding Expectations".

```js
async function createPerformanceOverTimeChart() {
  if (selected.length === 0) {
    return html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">Select school districts to view performance trends</p>
    </div>`;
  }
  
  const districtList = selected.map(d => `'${d}'`).join(',');
  
  const query = `
    SELECT 
      DIST_NAME as district,
      year,
      100.0 * SUM(n_e) / SUM(n) as pct_exceeding,
      100.0 * SUM(n_me) / SUM(n) as pct_meeting_or_exceeding
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND n > 0
    GROUP BY DIST_NAME, year
    ORDER BY DIST_NAME, year
  `;
  
  const data = await db.query(query);
  
  // Transform data for chart - create long format with performance variables
  const chartData = data.flatMap(d => [
    {
      district: d.district,
      year: d.year,
      variable: "Exceeding Expectations",
      percentage: d.pct_exceeding
    },
    {
      district: d.district,
      year: d.year,
      variable: "Meeting or Exceeding Expectations", 
      percentage: d.pct_meeting_or_exceeding
    }
  ]);
  
  return Plot.plot({
    title: "MCAS Performance by Year",
    width: 830,
    height: 400,
    x: {
      label: "Year",
      type: "linear",
      tickFormat: d => d.toString()
    },
    y: {
      label: "Percentage of Students (%)",
      grid: true,
      domain: [0, 100]
    },
    fx: {
      label: "",
      domain: ["Meeting or Exceeding Expectations", "Exceeding Expectations"]
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.line(chartData, {
        x: "year",
        y: "percentage",
        fx: "variable",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\n${d.variable}\n${d.year}: ${d.percentage?.toFixed(1)}%`
      }),
      Plot.dot(chartData, {
        x: "year",
        y: "percentage", 
        fx: "variable",
        fill: "district",
        r: 3,
        title: d => `${d.district}\n${d.variable}\n${d.year}: ${d.percentage?.toFixed(1)}%`
      })
    ]
  });
}
```

<div class="card">${await createPerformanceOverTimeChart()}</div>

## Performance by Subject

This chart breaks down performance by subject area, allowing you to see which districts excel in specific subjects and how performance varies between English, Math, and Science.

```js
async function createPerformanceBySubjectChart() {
  if (selected.length === 0) {
    return html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">Select school districts to view performance by subject</p>
    </div>`;
  }
  
  const districtList = selected.map(d => `'${d}'`).join(',');
  
  const query = `
    SELECT 
      DIST_NAME as district,
      SUBJECT_CODE as subject,
      100.0 * SUM(n_e) / SUM(n) as pct_exceeding,
      100.0 * SUM(n_me) / SUM(n) as pct_meeting_or_exceeding
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND n > 0
    GROUP BY DIST_NAME, SUBJECT_CODE
    ORDER BY DIST_NAME, SUBJECT_CODE
  `;
  
  const data = await db.query(query);
  
  // Transform data for chart - create long format with performance variables
  const chartData = data.flatMap(d => [
    {
      district: d.district,
      subject: d.subject,
      variable: "Exceeding Expectations",
      percentage: d.pct_exceeding
    },
    {
      district: d.district,
      subject: d.subject,
      variable: "Meeting or Exceeding Expectations", 
      percentage: d.pct_meeting_or_exceeding
    }
  ]);
  
  return Plot.plot({
    title: "MCAS Performance by Subject",
    width: 830,
    height: 400,
    x: {
      label: "",
      tickFormat: d => subjectLabels[d] || d
    },
    y: {
      label: "Percentage of Students (%)",
      grid: true,
      domain: [0, 100]
    },
    fx: {
      label: "",
      domain: ["Meeting or Exceeding Expectations", "Exceeding Expectations"]
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.line(chartData, {
        x: "subject",
        y: "percentage",
        fx: "variable",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\n${subjectLabels[d.subject] || d.subject}\n${d.variable}: ${d.percentage?.toFixed(1)}%`
      }),
      Plot.dot(chartData, {
        x: "subject",
        y: "percentage",
        fx: "variable",
        fill: "district",
        r: 3,
        title: d => `${d.district}\n${subjectLabels[d.subject] || d.subject}\n${d.variable}: ${d.percentage?.toFixed(1)}%`
      })
    ]
  });
}
```

<div class="card">${await createPerformanceBySubjectChart()}</div>

## Performance by Grade

This chart shows performance across different grade levels, helping you understand how districts perform at elementary, middle, and high school levels.

```js
async function createPerformanceByGradeChart() {
  if (selected.length === 0) {
    return html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">Select school districts to view performance by grade</p>
    </div>`;
  }
  
  const districtList = selected.map(d => `'${d}'`).join(',');
  
  const query = `
    SELECT 
      DIST_NAME as district,
      grade,
      100.0 * SUM(n_e) / SUM(n) as pct_exceeding,
      100.0 * SUM(n_me) / SUM(n) as pct_meeting_or_exceeding
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND n > 0
    GROUP BY DIST_NAME, grade
    ORDER BY DIST_NAME, grade
  `;
  
  const data = await db.query(query);
  
  // Transform data for chart - create long format with performance variables
  const chartData = data.flatMap(d => [
    {
      district: d.district,
      grade: d.grade,
      variable: "Exceeding Expectations",
      percentage: d.pct_exceeding
    },
    {
      district: d.district,
      grade: d.grade,
      variable: "Meeting or Exceeding Expectations", 
      percentage: d.pct_meeting_or_exceeding
    }
  ]);
  
  return Plot.plot({
    title: "MCAS Performance by Grade",
    width: 830,
    height: 400,
    x: {
      label: "Grade"
    },
    y: {
      label: "Percentage of Students (%)",
      grid: true,
      domain: [0, 100]
    },
    fx: {
      label: "",
      domain: ["Meeting or Exceeding Expectations", "Exceeding Expectations"]
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.line(chartData, {
        x: "grade",
        y: "percentage",
        fx: "variable",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\nGrade ${d.grade}\n${d.variable}: ${d.percentage?.toFixed(1)}%`
      }),
      Plot.dot(chartData, {
        x: "grade",
        y: "percentage",
        fx: "variable",
        fill: "district",
        r: 3,
        title: d => `${d.district}\nGrade ${d.grade}\n${d.variable}: ${d.percentage?.toFixed(1)}%`
      })
    ]
  });
}
```

<div class="card">${await createPerformanceByGradeChart()}</div>

## About the Data

The performance data is sourced from the Massachusetts Comprehensive Assessment System (MCAS), the state's standardized testing program for measuring student achievement in core academic subjects. All data comes from the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data).

**Performance Level Definitions:**
- **Exceeding Expectations:** Students demonstrate a comprehensive understanding and advanced skills that go beyond grade-level standards.
- **Meeting or Exceeding Expectations:** Students meet or surpass the minimum proficiency requirements for their grade level.

The data includes test results across multiple years, grade levels, and subject areas, providing a comprehensive view into each district's academic performance trends and comparisons.

To view detailed results for individual districts or schools, visit the [School Districts page](/school-districts) or [Schools page](/schools).
