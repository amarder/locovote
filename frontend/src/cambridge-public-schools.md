---
title: Cambridge Public Schools
toc: true
---

# Cambridge Public Schools

My very thoughtful friend [Eugenia](https://www.voteeugenia.com/) is running for School Committee in Cambridge. I think her slogan is right on:

> "Every child deserves a **great** education."

Eugenia saw Locovote and identified an opportunity to collaborate.

<div class="tip" label="Key Question">

**Based on the data we have, which schools in Cambridge should we be looking up to / which schools have room for improvement?**

</div>

```js
import * as Plot from "npm:@observablehq/plot";
import SQLite from "npm:@observablehq/sqlite";
```

```js
const db = FileAttachment("data/mcas.db").sqlite();
```

```js
// Get all Cambridge schools
const cambridgeSchools = await db.query(`
  SELECT 
    DIST_NAME AS district, 
    ORG_NAME AS school, 
    ORG_CODE AS school_code, 
    MIN(grade) AS min_grade,
    MAX(grade) AS max_grade,
    100*SUM(n_e)/SUM(n) AS pct_e, 
    100*SUM(n_me)/SUM(n) AS pct_me, 
    SUM(n) as n 
  FROM mcas 
  WHERE DIST_NAME = 'Cambridge' AND SUBSTR(ORG_CODE, -4) != '0000'
  GROUP BY DIST_NAME, ORG_NAME, ORG_CODE 
  ORDER BY pct_me DESC, school
`);
```

## Cambridge Schools Overview

The table below shows all schools in the Cambridge Public Schools district, ranked by their percentage of students meeting or exceeding expectations on MCAS tests. This gives us a quick view of which schools are performing well and which might need additional support.

```js
// Add grade range formatting to schools data
const schoolsWithGradeRange = cambridgeSchools.map(school => ({
  ...school,
  grade_range: school.min_grade === school.max_grade 
    ? `Grade ${school.min_grade}` 
    : `Grades ${school.min_grade}-${school.max_grade}`
}));

const schoolsTable = Inputs.table(schoolsWithGradeRange, {
  columns: ["school", "grade_range", "pct_e", "pct_me", "n"],
  header: {
    "school": "School", 
    "grade_range": "Grade Levels",
    "pct_e": "Exceeding (%)", 
    "pct_me": "Meeting or Exceeding (%)", 
    "n": "# Tests"
  },
  format: {
    pct_e: (x) => x.toFixed(1), 
    pct_me: (x) => x.toFixed(1),
    n: (x) => x.toLocaleString()
  },
  width: {
    school: 280,
    grade_range: 120,
    pct_e: 120,
    pct_me: 180,
    n: 100
  }
});

display(schoolsTable);
```

## Performance Comparison

Let's visualize how Cambridge schools compare across key performance metrics:

```js
function createCambridgeComparisonChart() {
  if (cambridgeSchools.length === 0) {
    return html`<p>No Cambridge school data available.</p>`;
  }

  // Add school level categorization
  const schoolsWithLevel = schoolsWithGradeRange.map(school => {
    let level;
    const minGrade = school.min_grade;
    const maxGrade = school.max_grade;
    
    if (maxGrade <= 5) {
      level = "Elementary";
    } else if (minGrade >= 6 && maxGrade <= 8) {
      level = "Middle";
    } else if (minGrade >= 9) {
      level = "High";
    } else if (minGrade <= 5 && maxGrade >= 9) {
      level = "K-12";
    } else {
      level = "Elementary and Middle";
    }
    
    return { ...school, school_level: level };
  });

  // Group schools by level and calculate actual grade ranges
  const levelCategories = ["Elementary", "Elementary and Middle", "Middle", "High", "K-12"];
  const schoolsByLevel = {};
  const actualRanges = {};
  
  levelCategories.forEach(category => {
    const categorySchools = schoolsWithLevel.filter(school => 
      school.school_level === category
    );
    
    if (categorySchools.length > 0) {
      const minGrade = Math.min(...categorySchools.map(s => s.min_grade));
      const maxGrade = Math.max(...categorySchools.map(s => s.max_grade));
      const actualRange = minGrade === maxGrade ? `${minGrade}` : `${minGrade}-${maxGrade}`;
      
      const levelWithRange = `${category} (${actualRange})`;
      schoolsByLevel[levelWithRange] = categorySchools.sort((a, b) => b.pct_me - a.pct_me);
      actualRanges[category] = levelWithRange;
    }
  });
  
  const levelOrder = Object.keys(schoolsByLevel);

  // Create separate plots for each level
  const plots = levelOrder.map(level => {
    const levelSchools = schoolsByLevel[level];
    
    if (levelSchools.length === 0) {
      return null; // Skip empty levels
    }
    
    const plot = Plot.plot({
      width: 800,
      height: Math.max(150, levelSchools.length * 30 + 80), // Dynamic height based on school count
      marginLeft: 200,
      marginBottom: 50,
      marginTop: 40,
      x: {
        domain: [0, 100],
        label: level === levelOrder[levelOrder.length - 1] ? "Percentage of Students (%)" : null // Only show x-label on last chart
      },
      y: {
        label: null,
        tickFormat: (school) => {
          return school.length > 25 ? school.substring(0, 22) + "..." : school;
        }
      },
      color: {
        domain: ["Meeting or Exceeding", "Exceeding Only"],
        range: ["#2563eb", "#059669"],
        legend: level === levelOrder[0] // Only show legend on first chart
      },
      marks: [
        // Meeting or exceeding (base bar)
        Plot.barX(levelSchools, {
          x: "pct_me",
          y: "school",
          fill: "#2563eb",
          fillOpacity: 0.8,
          title: d => `${d.school} (${d.grade_range})\nMeeting or Exceeding: ${d.pct_me.toFixed(1)}%\nExceeding: ${d.pct_e.toFixed(1)}%\nTotal Tests: ${d.n.toLocaleString()}`
        }),
        // Exceeding only (overlay)
        Plot.barX(levelSchools, {
          x: "pct_e",
          y: "school",
          fill: "#059669",
          fillOpacity: 0.9,
          title: d => `${d.school} (${d.grade_range})\nExceeding: ${d.pct_e.toFixed(1)}%`
        })
      ]
    });
    
    return html`<div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 10px 0; font-size: 1.1em; color: #333;">${level}</h4>
      ${plot}
    </div>`;
  }).filter(plot => plot !== null); // Remove null entries

  return html`<div class="card">
    <h3>Cambridge Schools MCAS Performance Comparison by Grade Level</h3>
    <p style="margin-bottom: 30px; color: #666; font-size: 0.9em;">
      Schools are grouped by grade level and ranked by percentage of students meeting or exceeding expectations within each group. 
      The dark green shows students exceeding expectations, while blue shows all students meeting or exceeding.
    </p>
    ${plots}
  </div>`;
}

display(createCambridgeComparisonChart());
```

## Individual School Analysis

Select a Cambridge school below to see detailed performance trends over time:

```js
const selectedSchool = view(Inputs.select(
  schoolsWithGradeRange,
  {
    label: "Choose a school:",
    format: d => `${d.school} (${d.grade_range})`,
    value: schoolsWithGradeRange[0] // Default to top-performing school
  }
));
```

```js
async function createSchoolDetailCharts(school) {
  if (!school) {
    return html`<p>Please select a school to view detailed analysis.</p>`;
  }

  // Query detailed data for the selected school
  const detailQuery = `
    SELECT 
      year,
      grade,
      SUBJECT_CODE as subject,
      100*SUM(n_me - n_e)/SUM(n) AS meeting_only, 
      100*SUM(n_e)/SUM(n) AS exceeding,
      SUM(n) as total_tests
    FROM mcas 
    WHERE ORG_CODE = '${school.school_code}'
    GROUP BY year, grade, SUBJECT_CODE 
    ORDER BY year, grade, SUBJECT_CODE
  `;
  
  const detailData = await db.query(detailQuery);
  
  if (detailData.length === 0) {
    return html`<p>No detailed data available for ${school.school}.</p>`;
  }

  const subjectLabels = {"ELA": "English", "MATH": "Math", "SCI": "Science"};

  // Aggregate by year for year chart
  const yearData = {};
  detailData.forEach(d => {
    if (!yearData[d.year]) {
      yearData[d.year] = { year: d.year, exceeding: 0, meeting_only: 0, total_tests: 0 };
    }
    yearData[d.year].exceeding += d.exceeding * d.total_tests;
    yearData[d.year].meeting_only += d.meeting_only * d.total_tests;
    yearData[d.year].total_tests += d.total_tests;
  });
  
  const yearAggregated = Object.values(yearData).map(d => ({
    year: d.year,
    exceeding: d.total_tests > 0 ? d.exceeding / d.total_tests : 0,
    meeting_only: d.total_tests > 0 ? d.meeting_only / d.total_tests : 0
  }));

  // Aggregate by subject for subject chart
  const subjectData = {};
  detailData.forEach(d => {
    if (!subjectData[d.subject]) {
      subjectData[d.subject] = { subject: d.subject, exceeding: 0, meeting_only: 0, total_tests: 0 };
    }
    subjectData[d.subject].exceeding += d.exceeding * d.total_tests;
    subjectData[d.subject].meeting_only += d.meeting_only * d.total_tests;
    subjectData[d.subject].total_tests += d.total_tests;
  });
  
  const subjectAggregated = Object.values(subjectData).map(d => ({
    subject: d.subject,
    exceeding: d.total_tests > 0 ? d.exceeding / d.total_tests : 0,
    meeting_only: d.total_tests > 0 ? d.meeting_only / d.total_tests : 0
  }));

  // Create stacked data for charts
  const yearStackedData = yearAggregated.flatMap(d => [
    {...d, performance: "Exceeding Expectations", value: d.exceeding},
    {...d, performance: "Meeting Expectations", value: d.meeting_only}
  ]);

  const subjectStackedData = subjectAggregated.flatMap(d => [
    {...d, performance: "Exceeding Expectations", value: d.exceeding},
    {...d, performance: "Meeting Expectations", value: d.meeting_only}
  ]);

  // Performance by year
  const yearChart = Plot.plot({
    width: 400,
    height: 300,
    y: {domain: [0, 100], label: "Percentage of Students (%)"},
    x: {label: "Year", tickFormat: d => d.toString()},
    color: {
      domain: ["Exceeding Expectations", "Meeting Expectations"],
      range: ["#059669", "#2563eb"],
      legend: true
    },
    marks: [
      Plot.rectY(yearStackedData, {
        x: "year",
        y: "value",
        fill: "performance",
        order: ["Exceeding Expectations", "Meeting Expectations"],
        tip: true
      })
    ]
  });

  // Performance by subject
  const subjectChart = Plot.plot({
    width: 400,
    height: 300,
    y: {domain: [0, 100], label: "Percentage of Students (%)"},
    x: {
      label: "Subject",
      tickFormat: d => subjectLabels[d] || d
    },
    color: {
      domain: ["Exceeding Expectations", "Meeting Expectations"],
      range: ["#059669", "#2563eb"],
      legend: true
    },
    marks: [
      Plot.rectY(subjectStackedData, {
        x: "subject",
        y: "value",
        fill: "performance",
        order: ["Exceeding Expectations", "Meeting Expectations"],
        tip: true
      })
    ]
  });

  return html`<div class="grid grid-cols-2">
    <div class="card">
      <h3>Performance Over Time</h3>
      ${yearChart}
    </div>
    <div class="card">
      <h3>Performance by Subject</h3>
      ${subjectChart}
    </div>
  </div>
  
  <div class="card">
    <h3>${school.school} - Summary Statistics</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
      <div>
        <h4 style="margin: 0 0 5px 0; color: #666;">Meeting or Exceeding</h4>
        <div style="font-size: 2em; font-weight: bold; color: #2563eb;">${school.pct_me.toFixed(1)}%</div>
      </div>
      <div>
        <h4 style="margin: 0 0 5px 0; color: #666;">Exceeding Only</h4>
        <div style="font-size: 2em; font-weight: bold; color: #059669;">${school.pct_e.toFixed(1)}%</div>
      </div>
      <div>
        <h4 style="margin: 0 0 5px 0; color: #666;">Total Tests</h4>
        <div style="font-size: 2em; font-weight: bold; color: #333;">${school.n.toLocaleString()}</div>
      </div>
    </div>
  </div>`;
}

display(await createSchoolDetailCharts(selectedSchool));
```

## Key Insights

```js
function generateInsights() {
  if (schoolsWithGradeRange.length === 0) {
    return html`<p>No data available for analysis.</p>`;
  }

  const sorted = [...schoolsWithGradeRange].sort((a, b) => b.pct_me - a.pct_me);
  const topSchools = sorted.slice(0, 3);
  const bottomSchools = sorted.slice(-3).reverse();
  
  const avgMeeting = schoolsWithGradeRange.reduce((sum, s) => sum + s.pct_me, 0) / schoolsWithGradeRange.length;
  const avgExceeding = schoolsWithGradeRange.reduce((sum, s) => sum + s.pct_e, 0) / schoolsWithGradeRange.length;

  return html`<div class="note" label="Data-Driven Insights">
    
    **Top Performing Schools** (by % meeting or exceeding expectations):
    ${topSchools.map(s => html`<br/>• ${s.school} (${s.grade_range}): ${s.pct_me.toFixed(1)}% (${s.pct_e.toFixed(1)}% exceeding)`)}
    
    **Schools with Room for Improvement:**
    ${bottomSchools.map(s => html`<br/>• ${s.school} (${s.grade_range}): ${s.pct_me.toFixed(1)}% (${s.pct_e.toFixed(1)}% exceeding)`)}
    
    **District Averages:**
    <br/>• Meeting or Exceeding Expectations: ${avgMeeting.toFixed(1)}%
    <br/>• Exceeding Expectations: ${avgExceeding.toFixed(1)}%
    
    **Total Cambridge Schools:** ${schoolsWithGradeRange.length}

  </div>`;
}

display(generateInsights());
```

## About the Data

This analysis uses MCAS (Massachusetts Comprehensive Assessment System) data from the [Massachusetts Department of Elementary and Secondary Education](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data). The data includes test results across multiple years, grade levels, and subject areas.

**Performance Levels:**
- **Meeting or Exceeding Expectations:** Students who meet the minimum proficiency requirements for their grade level
- **Exceeding Expectations:** Students who demonstrate advanced understanding beyond grade-level standards

For more detailed analysis tools, explore the [Compare School Districts](/school-districts) page or the comprehensive [Schools](/data/schools) database.