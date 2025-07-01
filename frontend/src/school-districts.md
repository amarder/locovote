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

```js
function calculateWeightedLinearRegression(data, xKey, yKey, weightKey) {
  if (data.length < 3) return null;

  const n = data.length;
  const weights = data.map(d => d[weightKey]);
  const xValues = data.map(d => d[xKey]);
  const yValues = data.map(d => d[yKey]);

  const sumWeights = weights.reduce((sum, w) => sum + w, 0);
  if (sumWeights === 0) return null;

  const xMean = data.reduce((sum, d, i) => sum + weights[i] * d[xKey], 0) / sumWeights;
  const yMean = data.reduce((sum, d, i) => sum + weights[i] * d[yKey], 0) / sumWeights;

  const numerator = data.reduce((sum, d, i) => sum + weights[i] * (d[xKey] - xMean) * (d[yKey] - yMean), 0);
  const denominator = data.reduce((sum, d, i) => sum + weights[i] * Math.pow(d[xKey] - xMean, 2), 0);

  if (denominator === 0) return null;

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  return { slope, intercept };
}

async function createMetricsData(selectedDistricts) {
  if (!selectedDistricts || selectedDistricts.length === 0) {
    return [];
  }

  // 1. Fetch all necessary data
  const allDataQuery = `
    SELECT 
      DIST_NAME as district,
      year,
      SUBJECT_CODE as subject,
      grade,
      avg_sgp,
      n_me,
      n_white,
      n
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND avg_sgp IS NOT NULL AND n > 0 AND n_white IS NOT NULL AND n_me IS NOT NULL
      AND DIST_NAME != 'State'
  `;
  const allData = await db.query(allDataQuery);

  allData.forEach(d => {
    d.prop_white = d.n > 0 ? d.n_white / d.n : 0;
  });

  // 2. Calculate regression adjustments for each year/subject
  const regressionParams = {};
  const groupedData = {};
  allData.forEach(d => {
    const key = `${d.year}-${d.subject}`;
    if (!groupedData[key]) groupedData[key] = [];
    groupedData[key].push(d);
  });
  
  for (const key in groupedData) {
    const group = groupedData[key];
    const regression = calculateWeightedLinearRegression(group, 'prop_white', 'avg_sgp', 'n');
    if (regression) {
      regressionParams[key] = regression;
    }
  }

  // 3. Filter for selected districts and calculate all three metrics
  const districtList = selectedDistricts.map(d => `'${d}'`).join(',');
  const selectedDataQuery = `
    SELECT 
      DIST_NAME as district,
      year,
      SUBJECT_CODE as subject,
      grade,
      avg_sgp,
      n_me,
      n_white,
      n
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' AND DIST_NAME IN (${districtList})
      AND avg_sgp IS NOT NULL AND n > 0 AND n_white IS NOT NULL AND n_me IS NOT NULL
  `;
  const selectedData = await db.query(selectedDataQuery);

  // 4. Create "tidy" data with a row for each metric
  const tidyData = [];
  selectedData.forEach(d => {
    d.prop_white = d.n > 0 ? d.n_white / d.n : 0;
    const key = `${d.year}-${d.subject}`;
    const params = regressionParams[key];
    
    const test_score_progress = d.avg_sgp;
    const test_score_levels = d.n > 0 ? (d.n_me / d.n) * 100 : 0;
    
    let race_balanced_progress = null;
    if (params) {
      const { slope, intercept } = params;
      const predicted_sgp = slope * d.prop_white + intercept;
      race_balanced_progress = test_score_progress - predicted_sgp + 50;
    }

    if (race_balanced_progress !== null) {
        tidyData.push({ ...d, metric: "Race-Balanced Progress", value: race_balanced_progress });
    }
    tidyData.push({ ...d, metric: "Test Score Progress", value: test_score_progress });
    tidyData.push({ ...d, metric: "Test Score Levels", value: test_score_levels });
  });

  return tidyData;
}
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
  
  const allMetricsData = await createMetricsData(selected);

  // Aggregate data for the table
  const aggregatedData = {};
  allMetricsData.forEach(d => {
    if (!aggregatedData[d.district]) {
      aggregatedData[d.district] = {
        district: d.district,
        "Race-Balanced Progress": { sum: 0, count: 0 },
        "Test Score Progress": { sum: 0, count: 0 },
        "Test Score Levels": { sum: 0, count: 0 },
        total_tests: 0
      };
    }
    const districtEntry = aggregatedData[d.district];
    if (d.metric === "Race-Balanced Progress") {
      districtEntry["Race-Balanced Progress"].sum += d.value;
      districtEntry["Race-Balanced Progress"].count++;
    } else if (d.metric === "Test Score Progress") {
      districtEntry["Test Score Progress"].sum += d.value;
      districtEntry["Test Score Progress"].count++;
    } else if (d.metric === "Test Score Levels") {
      districtEntry["Test Score Levels"].sum += d.value;
      districtEntry["Test Score Levels"].count++;
    }
    districtEntry.total_tests += d.n;
  });

  const tableData = Object.values(aggregatedData).map(d => ({
    district: d.district,
    race_balanced_progress: d["Race-Balanced Progress"].count > 0 ? (d["Race-Balanced Progress"].sum / d["Race-Balanced Progress"].count) : null,
    test_score_progress: d["Test Score Progress"].count > 0 ? (d["Test Score Progress"].sum / d["Test Score Progress"].count) : null,
    test_score_levels: d["Test Score Levels"].count > 0 ? (d["Test Score Levels"].sum / d["Test Score Levels"].count) : null,
    total_tests: d.total_tests / 3 // Adjust for triple counting
  }));
  
  // Reorder data to match selection order
  const orderedData = selected.map(selectedDistrict => 
    tableData.find(d => d.district === selectedDistrict)
  ).filter(d => d !== undefined);
  
  return Inputs.table(orderedData, {
    columns: ["district", "race_balanced_progress", "test_score_progress", "test_score_levels", "total_tests"],
    header: {
      "district": "School District", 
      "race_balanced_progress": "Race-Balanced Progress",
      "test_score_progress": "Test Score Progress",
      "test_score_levels": "Test Score Levels",
      "total_tests": "# Tests"
    },
    format: {
      race_balanced_progress: (x) => x?.toFixed(1) || "N/A",
      test_score_progress: (x) => x?.toFixed(1) || "N/A",
      test_score_levels: (x) => x ? `${x.toFixed(1)}%` : "N/A",
      total_tests: (x) => x.toLocaleString()
    },
    width: {
      district: 200,
      race_balanced_progress: 150,
      test_score_progress: 150,
      test_score_levels: 150,
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
  
  const tidyData = await createMetricsData(selected);
  if (tidyData.length === 0) return html`<p>No data available for the selected districts.</p>`;

  // Aggregate data by district, year, and metric
  const aggregatedData = {};
  tidyData.forEach(d => {
    const key = `${d.district}-${d.year}-${d.metric}`;
    if (!aggregatedData[key]) {
      aggregatedData[key] = { district: d.district, year: d.year, metric: d.metric, sum: 0, count: 0 };
    }
    aggregatedData[key].sum += d.value;
    aggregatedData[key].count++;
  });

  const chartData = Object.values(aggregatedData).map(d => ({
    district: d.district,
    year: d.year,
    metric: d.metric,
    value: d.count > 0 ? d.sum / d.count : null
  })).filter(d => d.value !== null);
  
  return Plot.plot({
    title: "Performance Comparison by Year",
    width: 830,
    height: 400,
    facet: {
      data: chartData,
      x: "metric"
    },
    fx: {
      domain: ["Race-Balanced Progress", "Test Score Progress", "Test Score Levels"]
    },
    x: {
      label: "Year",
      type: "linear",
      tickFormat: d => d.toString()
    },
    y: {
      label: "Value",
      grid: true,
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "3,3", opacity: 0.7, y: (d) => d.metric === "Test Score Levels" ? null: 50}),
      Plot.line(chartData, {
        x: "year",
        y: "value",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\n${d.year}: ${d.value?.toFixed(1)}`
      }),
      Plot.dot(chartData, {
        x: "year",
        y: "value", 
        fill: "district",
        r: 3,
        title: d => `${d.district}\n${d.year}: ${d.value?.toFixed(1)}`
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
  
  const tidyData = await createMetricsData(selected);
  if (tidyData.length === 0) return html`<p>No data available for the selected districts.</p>`;
  
  // Aggregate data by district, subject, and metric
  const aggregatedData = {};
  tidyData.forEach(d => {
    const key = `${d.district}-${d.subject}-${d.metric}`;
    if (!aggregatedData[key]) {
      aggregatedData[key] = { district: d.district, subject: d.subject, metric: d.metric, sum: 0, count: 0 };
    }
    aggregatedData[key].sum += d.value;
    aggregatedData[key].count++;
  });

  const chartData = Object.values(aggregatedData).map(d => ({
    district: d.district,
    subject: d.subject,
    metric: d.metric,
    value: d.count > 0 ? d.sum / d.count : null
  })).filter(d => d.value !== null);

  return Plot.plot({
    title: "Performance Comparison by Subject",
    width: 830,
    height: 400,
    facet: {
      data: chartData,
      x: "metric"
    },
    fx: {
      domain: ["Race-Balanced Progress", "Test Score Progress", "Test Score Levels"]
    },
    x: {
      label: "",
      tickFormat: d => subjectLabels[d] || d
    },
    y: {
      label: "Value",
      grid: true,
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "3,3", opacity: 0.7, y: (d) => d.metric === "Test Score Levels" ? null: 50}),
      Plot.line(chartData, {
        x: "subject",
        y: "value",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\n${subjectLabels[d.subject] || d.subject}: ${d.value?.toFixed(1)}`
      }),
      Plot.dot(chartData, {
        x: "subject",
        y: "value",
        fill: "district",
        r: 3,
        title: d => `${d.district}\n${subjectLabels[d.subject] || d.subject}: ${d.value?.toFixed(1)}`
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
  
  const tidyData = await createMetricsData(selected);
  if (tidyData.length === 0) return html`<p>No data available for the selected districts.</p>`;

  // Aggregate data by district, grade, and metric
  const aggregatedData = {};
  tidyData.forEach(d => {
    const key = `${d.district}-${d.grade}-${d.metric}`;
    if (!aggregatedData[key]) {
      aggregatedData[key] = { district: d.district, grade: d.grade, metric: d.metric, sum: 0, count: 0 };
    }
    aggregatedData[key].sum += d.value;
    aggregatedData[key].count++;
  });

  const chartData = Object.values(aggregatedData).map(d => ({
    district: d.district,
    grade: d.grade,
    metric: d.metric,
    value: d.count > 0 ? d.sum / d.count : null
  })).filter(d => d.value !== null);
  
  return Plot.plot({
    title: "Performance Comparison by Grade",
    width: 830,
    height: 400,
    facet: {
      data: chartData,
      x: "metric"
    },
    fx: {
      domain: ["Race-Balanced Progress", "Test Score Progress", "Test Score Levels"]
    },
    x: {
      label: "Grade"
    },
    y: {
      label: "Value",
      grid: true,
    },
    color: {
      legend: true,
      scheme: "category10"
    },
    marks: [
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "3,3", opacity: 0.7, y: (d) => d.metric === "Test Score Levels" ? null: 50}),
      Plot.line(chartData, {
        x: "grade",
        y: "value",
        stroke: "district",
        strokeWidth: 2,
        title: d => `${d.district}\nGrade ${d.grade}: ${d.value?.toFixed(1)}`
      }),
      Plot.dot(chartData, {
        x: "grade",
        y: "value",
        fill: "district",
        r: 3,
        title: d => `${d.district}\nGrade ${d.grade}: ${d.value?.toFixed(1)}`
      })
    ]
  });
}
```

<div class="card">${await createPerformanceByGradeChart()}</div>

## About the Data

The data in these comparisons comes from the Massachusetts Comprehensive Assessment System (MCAS). The three metrics—Test Score Levels, Test Score Progress, and Race-Balanced Progress—offer different ways to understand a school district's performance.

**Metric Definitions:**
- **Test Score Levels:** This is the percentage of students meeting or exceeding expectations on their MCAS exams. It reflects the overall academic achievement level of the district's students in a given year.
- **Test Score Progress (SGP):** This is the average Student Growth Percentile (SGP) for the district. SGP measures a student's academic growth relative to other students with similar past MCAS scores. A value of 50 indicates typical growth, while higher values suggest stronger-than-average growth.
- **Race-Balanced Progress:** This is a regression-adjusted version of Test Score Progress. It's calculated by statistically removing the relationship between a district's student demographics (specifically, the proportion of white students) and its average SGP. The goal is to isolate the district's impact on student learning from demographic factors.

**Understanding the Charts:**
- For progress metrics, the dashed line at 50 represents the state average or typical growth.
- Districts with lines above 50 show above-average student growth.
- Districts with lines below 50 show below-average student growth.
- Higher values indicate stronger academic performance or growth over time.

All data is sourced from the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data). To learn more about the methodology, see the [Methodology page](/methodology).
To view detailed results for individual districts or schools, visit the [School Districts page](/data/school-districts) or [Schools page](/data/schools).
