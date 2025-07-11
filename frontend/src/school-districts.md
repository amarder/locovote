---
title: Compare School Districts
toc: true
---

# Compare School Districts

<div class="tip" label="Key Questions">

**Are districts helping students achieve higher scores over time?**

**Is district performance changing by year, grade, or subject?**

</div>

Use the controls below to choose the school districts you want to compare and the metric you'd like to view. I recommend focusing on Test Score Progress and Race-Balanced Progress because research shows they are stronger indicators of school quality (see the [school metrics page](/school-metrics) for details).

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


```js
async function createDistrictComparisonTable() {
  if (selected.length === 0) {
    return html`<div style="padding: 20px; text-align: center; color: #666; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p>Select school districts to view comparison table</p>
    </div>`;
  }
  
  const allMetricsData = await createMetricsData(selected);

  // Filter data for the selected metric only
  const filteredData = allMetricsData.filter(d => d.metric === selectedMetric);

  // Aggregate data for the table
  const aggregatedData = {};
  filteredData.forEach(d => {
    if (!aggregatedData[d.district]) {
      aggregatedData[d.district] = {
        district: d.district,
        metric_value: { sum: 0, count: 0 },
        total_tests: 0
      };
    }
    const districtEntry = aggregatedData[d.district];
    districtEntry.metric_value.sum += d.value;
    districtEntry.metric_value.count++;
    districtEntry.total_tests += d.n;
  });

  const tableData = Object.values(aggregatedData).map(d => ({
    district: d.district,
    metric_value: d.metric_value.count > 0 ? (d.metric_value.sum / d.metric_value.count) : null,
    total_tests: d.total_tests
  }));
  
  // Reorder data to match selection order
  const orderedData = selected.map(selectedDistrict => 
    tableData.find(d => d.district === selectedDistrict)
  ).filter(d => d !== undefined);
  
  // Format value based on selected metric
  const formatValue = (x) => {
    if (x === null) return "N/A";
    return selectedMetric === "Test Score Levels" ? `${x.toFixed(1)}%` : x.toFixed(1);
  };
  
  return Inputs.table(orderedData, {
    columns: ["district", "metric_value", "total_tests"],
    header: {
      "district": "School District", 
      "metric_value": selectedMetric,
      "total_tests": "# Tests"
    },
    format: {
      metric_value: formatValue,
      total_tests: (x) => x.toLocaleString()
    },
    width: {
      district: 250,
      metric_value: 200,
      total_tests: 100
    }
  });
}
```

## District Cards

<div class="card">

```js
const selectedComponent = searchCheckbox(districtNames, { urlParam: "q", value: ["Boston", "Cambridge"]});
const selected = view(selectedComponent);
```

```js
// Add metric selector
const selectedMetric = view(Inputs.select(
  ["Race-Balanced Progress", "Test Score Progress", "Test Score Levels"],
  {
    label: null,
    value: "Test Score Progress",
    width: 62
  }
));
```

</div>

```js
// Calculate separate y-axis domains for each chart type based on aggregated data across all districts
async function calculateGlobalYDomains() {
  if (selected.length === 0) return { year: [0, 100], subject: [0, 100], grade: [0, 100] };
  
  const tidyData = await createMetricsData(selected);
  
  // Only consider data for the currently selected metric AND selected districts
  const metricData = tidyData.filter(d => 
    d.metric === selectedMetric && 
    selected.includes(d.district)
  );
  
  if (metricData.length === 0) return { year: [0, 100], subject: [0, 100], grade: [0, 100] };
  
  // Separate arrays for each chart type
  const yearValues = [];
  const subjectValues = [];
  const gradeValues = [];
  
  // For each district, calculate the same aggregations that the charts will show
  selected.forEach(district => {
    const districtData = metricData.filter(d => d.district === district);
    
    // Aggregate by year (like createMiniYearChart does)
    const yearData = {};
    districtData.forEach(d => {
      if (!yearData[d.year]) yearData[d.year] = { sum: 0, count: 0 };
      yearData[d.year].sum += d.value;
      yearData[d.year].count++;
    });
    Object.values(yearData).forEach(d => {
      if (d.count > 0) yearValues.push(d.sum / d.count);
    });
    
    // Aggregate by subject (like createMiniSubjectChart does)
    const subjectData = {};
    districtData.forEach(d => {
      if (!subjectData[d.subject]) subjectData[d.subject] = { sum: 0, count: 0 };
      subjectData[d.subject].sum += d.value;
      subjectData[d.subject].count++;
    });
    Object.values(subjectData).forEach(d => {
      if (d.count > 0) subjectValues.push(d.sum / d.count);
    });
    
    // Aggregate by grade (like createMiniGradeChart does)
    const gradeData = {};
    districtData.forEach(d => {
      if (!gradeData[d.grade]) gradeData[d.grade] = { sum: 0, count: 0 };
      gradeData[d.grade].sum += d.value;
      gradeData[d.grade].count++;
    });
    Object.values(gradeData).forEach(d => {
      if (d.count > 0) gradeValues.push(d.sum / d.count);
    });
  });
  
  // Helper function to calculate domain with padding
  function calculateDomain(values, label) {
    if (values.length === 0) return [0, 100];
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    // Add some padding to the range (10% on each side)
    const padding = Math.max((maxValue - minValue) * 0.1, 1); // Minimum 1 unit padding
    
    const domain = [
      Math.max(0, Math.floor(minValue - padding)),
      Math.ceil(maxValue + padding)
    ];
    
    console.log(`${label} domain for ${selectedMetric}: min=${minValue.toFixed(2)}, max=${maxValue.toFixed(2)}, domain=[${domain[0]}, ${domain[1]}], values: ${values.length}`);
    
    return domain;
  }
  
  return {
    year: calculateDomain(yearValues, "Year"),
    subject: calculateDomain(subjectValues, "Subject"), 
    grade: calculateDomain(gradeValues, "Grade")
  };
}
```

```js
// Helper functions for creating small charts within cards
function createMiniYearChart(districtData, yDomain, width, height = 150) {
  // Aggregate by year
  const yearData = {};
  districtData.forEach(d => {
    if (!yearData[d.year]) {
      yearData[d.year] = { year: d.year, sum: 0, count: 0 };
    }
    yearData[d.year].sum += d.value;
    yearData[d.year].count++;
  });
  
  const chartData = Object.values(yearData).map(d => ({
    year: d.year,
    value: d.count > 0 ? d.sum / d.count : null
  })).filter(d => d.value !== null);

  // Calculate domain with padding
  const years = chartData.map(d => d.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const xDomain = [minYear - 0.55, maxYear + 0.55];

  const showReferenceLine = selectedMetric !== "Test Score Levels";
  const formatValue = (val) => val?.toFixed(1);

  return Plot.plot({
    width,
    height,
    marginLeft: 40,
    marginRight: 10,
    marginTop: 20,
    marginBottom: 30,
    x: {
      label: "Year",
      type: "linear",
      domain: xDomain,
      tickFormat: d => d.toString(),
      tickSize: 3,
      axis: "bottom",
      labelAnchor: "center",
      labelArrow: "none"
    },
    y: {
      label: null,
      grid: true,
      domain: yDomain,
      tickSize: 3
    },
    marks: [
      ...(showReferenceLine ? [Plot.ruleY([50], {stroke: "#666", strokeDasharray: "2,2", opacity: 0.5})] : []),
      Plot.rect(chartData, {
        x1: d => d.year - 0.45,
        x2: d => d.year + 0.45,
        y1: yDomain[0],
        y2: "value",
        fill: "#2563eb",
        fillOpacity: 0.8,
        title: d => `${d.year}: ${formatValue(d.value)}`
      })
    ]
  });
}

function createMiniSubjectChart(districtData, yDomain, width, height = 150) {
  // Aggregate by subject
  const subjectData = {};
  districtData.forEach(d => {
    if (!subjectData[d.subject]) {
      subjectData[d.subject] = { subject: d.subject, sum: 0, count: 0 };
    }
    subjectData[d.subject].sum += d.value;
    subjectData[d.subject].count++;
  });
  
  const chartData = Object.values(subjectData).map(d => ({
    subject: d.subject,
    value: d.count > 0 ? d.sum / d.count : null
  })).filter(d => d.value !== null);

  const showReferenceLine = selectedMetric !== "Test Score Levels";
  const formatValue = (val) => val?.toFixed(1);

  return Plot.plot({
    width,
    height,
    marginLeft: 40,
    marginRight: 10,
    marginTop: 20,
    marginBottom: 30,
    x: {
      label: "Subject",
      tickFormat: d => subjectLabels[d] || d,
      tickSize: 3
    },
    y: {
      label: null,
      grid: true,
      domain: yDomain,
      tickSize: 3
    },
    marks: [
      ...(showReferenceLine ? [Plot.ruleY([50], {stroke: "#666", strokeDasharray: "2,2", opacity: 0.5})] : []),
      Plot.rect(chartData, {
        x: "subject",
        y1: yDomain[0],
        y2: "value",
        fill: "#2563eb",
        fillOpacity: 0.8,
        title: d => `${subjectLabels[d.subject] || d.subject}: ${formatValue(d.value)}`
      })
    ]
  });
}

function createMiniGradeChart(districtData, yDomain, width, height = 150) {
  // Aggregate by grade
  const gradeData = {};
  districtData.forEach(d => {
    if (!gradeData[d.grade]) {
      gradeData[d.grade] = { grade: d.grade, sum: 0, count: 0 };
    }
    gradeData[d.grade].sum += d.value;
    gradeData[d.grade].count++;
  });
  
  const chartData = Object.values(gradeData).map(d => ({
    grade: d.grade,
    value: d.count > 0 ? d.sum / d.count : null
  })).filter(d => d.value !== null);

  // Calculate domain with padding
  const grades = chartData.map(d => d.grade);
  const minGrade = Math.min(...grades);
  const maxGrade = Math.max(...grades);
  const xDomain = [minGrade - 0.55, maxGrade + 0.55];

  const showReferenceLine = selectedMetric !== "Test Score Levels";
  const formatValue = (val) => val?.toFixed(1);

  return Plot.plot({
    width,
    height,
    marginLeft: 40,
    marginRight: 10,
    marginTop: 20,
    marginBottom: 30,
    x: {
      label: "Grade",
      domain: xDomain,
      tickSize: 3,
      axis: "bottom",
      labelAnchor: "center",
      labelArrow: "none"
    },
    y: {
      label: null,
      grid: true,
      domain: yDomain,
      tickSize: 3
    },
    marks: [
      ...(showReferenceLine ? [Plot.ruleY([50], {stroke: "#666", strokeDasharray: "2,2", opacity: 0.5})] : []),
      Plot.rect(chartData, {
        x1: d => d.grade - 0.45,
        x2: d => d.grade + 0.45,
        y1: yDomain[0],
        y2: "value",
        fill: "#2563eb",
        fillOpacity: 0.8,
        title: d => `Grade ${d.grade}: ${formatValue(d.value)}`
      })
    ]
  });
}
```

```js
async function createDistrictCards() {
  if (selected.length === 0) {
    return html`<div style="padding: 40px; text-align: center; color: #666;">
      <p>Select school districts to view detailed comparisons</p>
    </div>`;
  }
  
  const allMetricsData = await createMetricsData(selected);
  const filteredData = allMetricsData.filter(d => d.metric === selectedMetric);
  const yDomains = await calculateGlobalYDomains();
  
  if (filteredData.length === 0) {
    return html`<div style="padding: 40px; text-align: center; color: #666;">
      <p>No data available for the selected districts and metric</p>
    </div>`;
  }

  // Group data by district
  const districtGroups = {};
  filteredData.forEach(d => {
    if (!districtGroups[d.district]) {
      districtGroups[d.district] = [];
    }
    districtGroups[d.district].push(d);
  });

  // Calculate overall metric and test count for each district
  const districtSummaries = {};
  filteredData.forEach(d => {
    if (!districtSummaries[d.district]) {
      districtSummaries[d.district] = { sum: 0, count: 0, totalTests: 0 };
    }
    districtSummaries[d.district].sum += d.value;
    districtSummaries[d.district].count++;
    districtSummaries[d.district].totalTests += d.n;
  });

  const formatValue = (val) => val?.toFixed(1);

  // Create cards in the order of selection
  const cards = selected.map(district => {
    const districtData = districtGroups[district] || [];
    const summary = districtSummaries[district];
    
    if (!summary || districtData.length === 0) {
      return html`<div class="card">
        <h3>${district}</h3>
        <p>No data available</p>
      </div>`;
    }

    const avgValue = summary.sum / summary.count;
    const totalTests = summary.totalTests;

         return html`<div class="card" style="position: relative;">
       <button 
         style="position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 18px; cursor: pointer; color: #666; padding: 4px; line-height: 1; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; hover:background-color: #f0f0f0;"
         title="Remove ${district}"
         onclick=${() => {
           const currentSelection = selectedComponent.value;
           const newSelection = currentSelection.filter(d => d !== district);
           selectedComponent.value = newSelection;
         }}
       >×</button>
       <div style="text-align: left; margin-bottom: 20px;">
         <div style="margin-bottom: 8px;">
           <h3 style="margin: 0 0 2px 0; font-size: 1.1em;">${district}</h3>
           <div style="color: #666; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px;">
             ${selectedMetric}
           </div>
         </div>
         <div style="font-size: 2.5em; font-weight: bold; color: #2563eb; margin: 8px 0 4px 0;">
           ${formatValue(avgValue)}
         </div>
         <div style="color: #666; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px;">
           ${totalTests.toLocaleString()} Tests
         </div>
       </div>
      
             <div style="display: grid; gap: 15px;">
         <div>
           ${resize((width) => createMiniYearChart(districtData, yDomains.year, width))}
         </div>
         
         <div>
           ${resize((width) => createMiniGradeChart(districtData, yDomains.grade, width))}
         </div>

         <div>
           ${resize((width) => createMiniSubjectChart(districtData, yDomains.subject, width))}
         </div>         
       </div>
    </div>`;
  });

  return html`<div class="grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style="gap: 20px;">
    ${cards}
  </div>`;
}
```

<div>${await createDistrictCards()}</div>

## Metric Definitions

**Test Score Levels:** The percentage of students who meet or exceed expectations on the MCAS standardized tests. It reflects the district’s overall level of academic achievement in a given year.

**Test Score Progress:** The district’s average Student Growth Percentile (SGP), which measures how much students grew academically relative to peers with similar prior MCAS scores. A score of 50 represents typical growth, higher values indicate faster-than-average growth.

**Race-Balanced Progress:** A regression-adjusted version of Test Score Progress. It statistically removes the relationship between student demographics (specifically the proportion of White students) and average SGP.

## Reading the Charts

For the progress metrics (Test Score Progress and Race-Balanced Progress), the dashed line at 50 marks the state average (typical growth). Districts scoring above 50 exhibit above-average growth, whereas those below 50 show below-average growth.

For Test Score Levels, higher percentages mean more students meet or exceed expectations. While higher values reflect stronger academic performance, part of that performance likely stems from factors outside of school quality.

## About the Data

These comparisons rely on data from the Massachusetts Comprehensive Assessment System (MCAS), provided by the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data). For details on how the metrics are constructed, see the [school metrics page](/school-metrics). To explore results for individual districts or schools, visit the [school districts](/data/school-districts) or [schools](/data/schools) pages.
