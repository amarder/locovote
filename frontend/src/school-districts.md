---
title: Compare School Districts - Student Growth
toc: true
---

# Compare School Districts - Student Growth

This tool allows you to compare the academic **growth** of different Massachusetts school districts over time. Use the search box below to select districts and explore how they differ in Student Growth Percentiles (SGP) across subjects, grades, and years.

<div class="tip" label="Key Questions This Tool Answers">

- **How do different districts compare in student growth?** See growth trends across multiple districts.
- **How does growth vary by subject?** Compare districts in English, Math, and Science growth rates.
- **Are there grade-level differences?** Analyze growth patterns across elementary, middle, and high school grades.

</div>

### Select School Districts to Compare

Choose multiple school districts to compare their MCAS Student Growth Percentiles. Popular comparisons include neighboring districts, similar-sized districts, or districts you're considering for your family.

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
const selected = view(searchCheckbox(districtNames, { urlParam: "q", value: ["Boston", "Cambridge"]}));
```

```js
// Subject labels for display
const subjectLabels = {"ELA": "English", "MATH": "Math", "SCI": "Science"};
```

## Overall Growth Performance

This table shows the average Student Growth Percentile for each selected school district, aggregated across all years, grades, and subjects in the dataset.

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
      SUM(avg_sgp * avg_sgp_incl) / SUM(avg_sgp_incl) as avg_student_growth,
      SUM(avg_sgp_incl) as data_points,
      SUM(n) as total_tests
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND avg_sgp IS NOT NULL
      AND avg_sgp_incl > 0
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
    columns: ["district", "avg_student_growth", "data_points", "total_tests"],
    header: {
      "district": "School District", 
      "avg_student_growth": "Avg Growth Percentile", 
      "data_points": "Data Points",
      "total_tests": "# Tests"
    },
    format: {
      avg_student_growth: (x) => x?.toFixed(1) || "N/A", 
      data_points: (x) => x.toLocaleString(),
      total_tests: (x) => x.toLocaleString()
    },
    width: {
      district: 200,
      avg_student_growth: 140,
      data_points: 100,
      total_tests: 80
    }
  });
}
```

<div class="card">${await createDistrictComparisonTable()}</div>

## Student Growth by Year

This chart shows how districts compare in student growth over time. Each line represents a different district, showing their average Student Growth Percentile trends.

```js
async function createPerformanceOverTimeChart() {
  if (selected.length === 0) {
    return html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">Select school districts to view growth trends</p>
    </div>`;
  }
  
  const districtList = selected.map(d => `'${d}'`).join(',');
  
  const query = `
    SELECT 
      DIST_NAME as district,
      year,
      AVG(avg_sgp) as avg_student_growth
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND avg_sgp IS NOT NULL
      AND n > 0
    GROUP BY DIST_NAME, year
    ORDER BY DIST_NAME, year
  `;
  
  const data = await db.query(query);
  
  // Filter out null values
  const chartData = data.filter(d => d.avg_student_growth !== null);
  
  return Plot.plot({
    title: "Student Growth by Year",
    width: 830,
    height: 400,
    x: {
      label: "Year",
      type: "linear",
      tickFormat: d => d.toString()
    },
    y: {
      label: "Average Student Growth Percentile",
      grid: true,
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "3,3", opacity: 0.7}),
      Plot.line(chartData, {
        x: "year",
        y: "avg_student_growth",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\n${d.year}: ${d.avg_student_growth?.toFixed(1)}`
      }),
      Plot.dot(chartData, {
        x: "year",
        y: "avg_student_growth", 
        fill: "district",
        r: 3,
        title: d => `${d.district}\n${d.year}: ${d.avg_student_growth?.toFixed(1)}`
      })
    ]
  });
}
```

<div class="card">${await createPerformanceOverTimeChart()}</div>

## Student Growth by Subject

This chart breaks down student growth by subject area, allowing you to see which districts show stronger growth in specific subjects and how growth varies between English, Math, and Science.

```js
async function createPerformanceBySubjectChart() {
  if (selected.length === 0) {
    return html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">Select school districts to view growth by subject</p>
    </div>`;
  }
  
  const districtList = selected.map(d => `'${d}'`).join(',');
  
  const query = `
    SELECT 
      DIST_NAME as district,
      SUBJECT_CODE as subject,
      AVG(avg_sgp) as avg_student_growth
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND avg_sgp IS NOT NULL
      AND n > 0
    GROUP BY DIST_NAME, SUBJECT_CODE
    ORDER BY DIST_NAME, SUBJECT_CODE
  `;
  
  const data = await db.query(query);
  
  // Filter out null values
  const chartData = data.filter(d => d.avg_student_growth !== null);
  
  return Plot.plot({
    title: "Student Growth by Subject",
    width: 830,
    height: 400,
    x: {
      label: "",
      tickFormat: d => subjectLabels[d] || d
    },
    y: {
      label: "Average Student Growth Percentile",
      grid: true,
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "3,3", opacity: 0.7}),
      Plot.line(chartData, {
        x: "subject",
        y: "avg_student_growth",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\n${subjectLabels[d.subject] || d.subject}: ${d.avg_student_growth?.toFixed(1)}`
      }),
      Plot.dot(chartData, {
        x: "subject",
        y: "avg_student_growth",
        fill: "district",
        r: 3,
        title: d => `${d.district}\n${subjectLabels[d.subject] || d.subject}: ${d.avg_student_growth?.toFixed(1)}`
      })
    ]
  });
}
```

<div class="card">${await createPerformanceBySubjectChart()}</div>

## Student Growth by Grade

This chart shows student growth across different grade levels, helping you understand how districts perform at elementary, middle, and high school levels.

```js
async function createPerformanceByGradeChart() {
  if (selected.length === 0) {
    return html`<div style="width: 830px; height: 400px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">Select school districts to view growth by grade</p>
    </div>`;
  }
  
  const districtList = selected.map(d => `'${d}'`).join(',');
  
  const query = `
    SELECT 
      DIST_NAME as district,
      grade,
      AVG(avg_sgp) as avg_student_growth
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND DIST_NAME IN (${districtList})
      AND avg_sgp IS NOT NULL
      AND n > 0
    GROUP BY DIST_NAME, grade
    ORDER BY DIST_NAME, grade
  `;
  
  const data = await db.query(query);
  
  // Filter out null values
  const chartData = data.filter(d => d.avg_student_growth !== null);
  
  return Plot.plot({
    title: "Student Growth by Grade",
    width: 830,
    height: 400,
    x: {
      label: "Grade"
    },
    y: {
      label: "Average Student Growth Percentile",
      grid: true,
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "3,3", opacity: 0.7}),
      Plot.line(chartData, {
        x: "grade",
        y: "avg_student_growth",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\nGrade ${d.grade}: ${d.avg_student_growth?.toFixed(1)}`
      }),
      Plot.dot(chartData, {
        x: "grade",
        y: "avg_student_growth",
        fill: "district",
        r: 3,
        title: d => `${d.district}\nGrade ${d.grade}: ${d.avg_student_growth?.toFixed(1)}`
      })
    ]
  });
}
```

<div class="card">${await createPerformanceByGradeChart()}</div>



## About the Data

The student growth data is sourced from the Massachusetts Comprehensive Assessment System (MCAS), the state's standardized testing program for measuring student achievement and growth in core academic subjects. All data comes from the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data).

**Student Growth Percentile (SGP) Definition:**
- **Student Growth Percentile (SGP):** Compares a student's growth to that of other students with similar prior MCAS performance. An SGP of 50 represents typical growth, while values above 50 indicate above-average growth and values below 50 indicate below-average growth.

**Understanding the Charts:**
- The dashed line at 50 represents typical/average growth
- Districts with lines above 50 show above-average student growth
- Districts with lines below 50 show below-average student growth
- Higher values indicate stronger academic growth over time

The data includes growth results across multiple years, grade levels, and subject areas, providing a comprehensive view into how effectively each district is helping students improve academically over time.

To view detailed results for individual districts or schools, visit the [School Districts page](/data/school-districts) or [Schools page](/data/schools).
