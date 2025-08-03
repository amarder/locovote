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

### School Demographics vs Progress by Subject

```js
async function createSchoolSubjectPlot() {
  // Get school-subject level data aggregated across all years - focus on ELA and MATH only
  const subjectData = await db.query(`
    SELECT 
      ORG_NAME AS school,
      ORG_CODE AS school_code,
      SUBJECT_CODE as subject,
      AVG(avg_sgp) as progress,
      100*SUM(n_white)/SUM(n) AS share_white,
      SUM(n) as n,
      MIN(grade) as min_grade,
      MAX(grade) as max_grade
    FROM mcas 
    WHERE DIST_NAME = 'Cambridge' 
      AND SUBSTR(ORG_CODE, -4) != '0000'
      AND SUBJECT_CODE IN ('ELA', 'MATH')
      AND avg_sgp IS NOT NULL 
      AND n > 0 
      AND n_white IS NOT NULL
    GROUP BY ORG_NAME, ORG_CODE, SUBJECT_CODE
    HAVING SUM(n) >= 30  -- Only include substantial sample sizes
    ORDER BY SUBJECT_CODE, ORG_NAME
  `);

  if (subjectData.length === 0) {
    return html`<p>No subject-level data available for Cambridge schools.</p>`;
  }

  // Add subject labels and grade level categorization
  const subjectLabels = {"ELA": "English", "MATH": "Math"};
  const enrichedData = subjectData.map(d => {
    // Categorize by grade level
    let school_level;
    const minGrade = d.min_grade;
    const maxGrade = d.max_grade;
    
    if (maxGrade <= 5) {
      school_level = "Elementary";
    } else if (minGrade >= 6 && maxGrade <= 8) {
      school_level = "Middle";
    } else if (minGrade >= 9) {
      school_level = "High";
    } else if (minGrade <= 5 && maxGrade >= 9) {
      school_level = "K-12";
    } else {
      school_level = "Elementary and Middle";
    }
    
    return {
      ...d,
      subject_display: subjectLabels[d.subject] || d.subject,
      school_level
    };
  });

  // Calculate data ranges for padding
  const xValues = enrichedData.map(d => d.share_white);
  const yValues = enrichedData.map(d => d.progress);
  
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  
  // Add 10% padding on each side
  const xPadding = (xMax - xMin) * 0.1;
  const yPadding = (yMax - yMin) * 0.1;

  // Create the faceted plot
  const subjectPlot = Plot.plot({
    width: 700,
    height: 400,
    marginLeft: 60,
    marginBottom: 60,
    marginTop: 40,
    marginRight: 40,
    x: {
      label: "Share White (%)",
      grid: true,
      domain: [Math.max(0, xMin - xPadding), Math.min(100, xMax + xPadding)]
    },
    y: {
      label: "Progress (Student Growth Percentile)",
      grid: true,
      domain: [yMin - yPadding, yMax + yPadding]
    },
    fx: {
      label: "Subject",
      domain: ["English", "Math"]
    },
    color: {
      domain: ["Elementary", "Elementary and Middle", "Middle", "High"],
      range: ["#059669", "#2563eb", "#7c3aed", "#dc2626"],
      legend: true
    },
    marks: [
      // Reference line at 50 (typical growth)
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "2,2", opacity: 0.5}),
      
      // Add trend line for each subject - no confidence band
      Plot.linearRegressionY(enrichedData, {
        x: "share_white", 
        y: "progress",
        fx: "subject_display",
        stroke: "#dc2626",
        strokeWidth: 2,
        strokeOpacity: 0.5,
        ci: 0  // Remove confidence interval/uncertainty band
      }),

              // Points for each school-subject with hover functionality
        Plot.dot(enrichedData, {
          x: "share_white",
          y: "progress",
          fx: "subject_display",
          r: d => 200 + d.n, // Fixed larger size instead of variable sizing
          fill: "school_level",
          fillOpacity: 0.8,
          stroke: "school_level",
          strokeWidth: 2,
          title: d => `${d.school}\nSubject: ${d.subject_display}\nLevel: ${d.school_level}\nProgress: ${d.progress.toFixed(1)}\nShare White: ${d.share_white.toFixed(1)}%\nTests: ${d.n.toLocaleString()}`
        }),

      // School name labels on hover - using text marks for better visibility
      Plot.text(enrichedData, {
        x: "share_white",
        y: "progress", 
        fx: "subject_display",
        text: "school",
        fontSize: 9,
        fill: "#333",
        textAnchor: "middle",
        dy: -8,
        opacity: 0,
        pointerEvents: "none"
      }),
    ]
  });

  return html`<div class="card">
    <h3>School Demographics vs Progress: English and Math</h3>
    <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">
      Each point represents a school's average performance in a subject (aggregated across all years). 
      Points are colored by grade level (Elementary, Middle, High, etc.) and sized by number of tests.
      The dashed line marks typical growth (50). Red trend lines show the relationship between demographics and progress.
      Hover over points to see detailed information about each school.
    </p>
    ${subjectPlot}
  </div>`;
}

display(await createSchoolSubjectPlot());
```

### School Demographics vs Achievement Levels: English and Math

```js
async function createSchoolLevelsPlot() {
  // Get school-subject level data aggregated across all years - focus on ELA and MATH only
  const levelsData = await db.query(`
    SELECT 
      ORG_NAME AS school,
      ORG_CODE AS school_code,
      SUBJECT_CODE as subject,
      100*SUM(n_me)/SUM(n) AS pct_meeting_exceeding,
      100*SUM(n_white)/SUM(n) AS share_white,
      SUM(n) as n,
      MIN(grade) as min_grade,
      MAX(grade) as max_grade
    FROM mcas 
    WHERE DIST_NAME = 'Cambridge' 
      AND SUBSTR(ORG_CODE, -4) != '0000'
      AND SUBJECT_CODE IN ('ELA', 'MATH')
      AND n > 0 
      AND n_white IS NOT NULL
      AND n_me IS NOT NULL
    GROUP BY ORG_NAME, ORG_CODE, SUBJECT_CODE
    HAVING SUM(n) >= 30  -- Only include substantial sample sizes
    ORDER BY SUBJECT_CODE, ORG_NAME
  `);

  if (levelsData.length === 0) {
    return html`<p>No levels data available for Cambridge schools.</p>`;
  }

  // Add subject labels and grade level categorization
  const subjectLabels = {"ELA": "English", "MATH": "Math"};
  const enrichedLevelsData = levelsData.map(d => {
    // Categorize by grade level
    let school_level;
    const minGrade = d.min_grade;
    const maxGrade = d.max_grade;
    
    if (maxGrade <= 5) {
      school_level = "Elementary";
    } else if (minGrade >= 6 && maxGrade <= 8) {
      school_level = "Middle";
    } else if (minGrade >= 9) {
      school_level = "High";
    } else if (minGrade <= 5 && maxGrade >= 9) {
      school_level = "K-12";
    } else {
      school_level = "Elementary and Middle";
    }
    
    return {
      ...d,
      subject_display: subjectLabels[d.subject] || d.subject,
      school_level
    };
  });

  // Calculate data ranges for padding
  const xValues = enrichedLevelsData.map(d => d.share_white);
  const yValues = enrichedLevelsData.map(d => d.pct_meeting_exceeding);
  
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  
  // Add 10% padding on each side
  const xPadding = (xMax - xMin) * 0.1;
  const yPadding = (yMax - yMin) * 0.1;

  // Create the faceted plot
  const levelsPlot = Plot.plot({
    width: 700,
    height: 400,
    marginLeft: 60,
    marginBottom: 60,
    marginTop: 40,
    marginRight: 40,
    x: {
      label: "Share White (%)",
      grid: true,
      domain: [Math.max(0, xMin - xPadding), Math.min(100, xMax + xPadding)]
    },
    y: {
      label: "Meeting or Exceeding Expectations (%)",
      grid: true,
      domain: [Math.max(0, yMin - yPadding), Math.min(100, yMax + yPadding)]
    },
    fx: {
      label: "Subject",
      domain: ["English", "Math"]
    },
    color: {
      domain: ["Elementary", "Elementary and Middle", "Middle", "High"],
      range: ["#059669", "#2563eb", "#7c3aed", "#dc2626"],
      legend: true
    },
    marks: [
      // Add trend line for each subject - no confidence band
      Plot.linearRegressionY(enrichedLevelsData, {
        x: "share_white", 
        y: "pct_meeting_exceeding",
        fx: "subject_display",
        stroke: "#dc2626",
        strokeWidth: 2,
        strokeOpacity: 0.5,
        ci: 0  // Remove confidence interval/uncertainty band
      }),

      // Points for each school-subject with hover functionality
      Plot.dot(enrichedLevelsData, {
        x: "share_white",
        y: "pct_meeting_exceeding",
        fx: "subject_display",
        r: d => 200 + d.n, // Same sizing as progress plot
        fill: "school_level",
        fillOpacity: 0.8,
        stroke: "school_level",
        strokeWidth: 2,
        title: d => `${d.school}\nSubject: ${d.subject_display}\nLevel: ${d.school_level}\nMeeting/Exceeding: ${d.pct_meeting_exceeding.toFixed(1)}%\nShare White: ${d.share_white.toFixed(1)}%\nTests: ${d.n.toLocaleString()}`
      }),

      // School name labels on hover - using text marks for better visibility
      Plot.text(enrichedLevelsData, {
        x: "share_white",
        y: "pct_meeting_exceeding", 
        fx: "subject_display",
        text: "school",
        fontSize: 9,
        fill: "#333",
        textAnchor: "middle",
        dy: -8,
        opacity: 0,
        pointerEvents: "none"
      }),
    ]
  });

  return html`<div class="card">
    <h3>School Demographics vs Achievement Levels: English and Math</h3>
    <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">
      Each point represents a school's percentage of students meeting or exceeding expectations in a subject (aggregated across all years). 
      Points are colored by grade level (Elementary, Middle, High, etc.) and sized by number of tests.
      Red trend lines show the relationship between demographics and achievement levels.
      Hover over points to see detailed information about each school.
    </p>
    ${levelsPlot}
  </div>`;
}

display(await createSchoolLevelsPlot());
```

```js
const db = FileAttachment("data/mcas.db").sqlite();
```

```js
// Helper function for weighted linear regression (Cambridge-specific)
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

// Get detailed Cambridge data for all metrics
const cambridgeDetailedData = await db.query(`
  SELECT 
    DIST_NAME AS district, 
    ORG_NAME AS school, 
    ORG_CODE AS school_code,
    year,
    SUBJECT_CODE as subject,
    grade,
    avg_sgp,
    n_me,
    n_e,
    n_white,
    n
  FROM mcas 
  WHERE DIST_NAME = 'Cambridge' 
    AND SUBSTR(ORG_CODE, -4) != '0000'
    AND avg_sgp IS NOT NULL 
    AND n > 0 
    AND n_white IS NOT NULL 
    AND n_me IS NOT NULL
`);

// Calculate Cambridge-specific regression parameters for race-balanced progress
const cambridgeRegressionData = cambridgeDetailedData.map(d => ({
  ...d,
  prop_white: d.n > 0 ? d.n_white / d.n : 0
}));

// Group by year/subject for regression calculation
const regressionParams = {};
const groupedData = {};
cambridgeRegressionData.forEach(d => {
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

// Aggregate data by school to get all metrics
const schoolData = {};
cambridgeDetailedData.forEach(d => {
  if (!schoolData[d.school_code]) {
    schoolData[d.school_code] = {
      district: d.district,
      school: d.school,
      school_code: d.school_code,
      grades: new Set(),
      progress_sum: 0,
      progress_count: 0,
      race_balanced_sum: 0,
      race_balanced_count: 0,
      n_white_total: 0,
      n_total: 0,
      n_me_total: 0,
      n_e_total: 0
    };
  }
  
  const schoolEntry = schoolData[d.school_code];
  schoolEntry.grades.add(d.grade);
  
  // Add to progress totals
  if (d.avg_sgp !== null) {
    schoolEntry.progress_sum += d.avg_sgp * d.n;
    schoolEntry.progress_count += d.n;
  }
  
  // Calculate race-balanced progress for this observation
  d.prop_white = d.n > 0 ? d.n_white / d.n : 0;
  const key = `${d.year}-${d.subject}`;
  const params = regressionParams[key];
  
  if (params && d.avg_sgp !== null) {
    const { slope, intercept } = params;
    const predicted_sgp = slope * d.prop_white + intercept;
    const race_balanced_progress = d.avg_sgp - predicted_sgp + 50;
    
    schoolEntry.race_balanced_sum += race_balanced_progress * d.n;
    schoolEntry.race_balanced_count += d.n;
  }
  
  // Add to demographic and achievement totals
  schoolEntry.n_white_total += d.n_white;
  schoolEntry.n_total += d.n;
  schoolEntry.n_me_total += d.n_me;
  schoolEntry.n_e_total += d.n_e;
});

// Convert to final school array with calculated metrics
const cambridgeSchools = Object.values(schoolData).map(school => {
  const gradeArray = Array.from(school.grades).sort((a, b) => a - b);
  const min_grade = gradeArray[0];
  const max_grade = gradeArray[gradeArray.length - 1];
  
  return {
    district: school.district,
    school: school.school,
    school_code: school.school_code,
    min_grade,
    max_grade,
    progress: school.progress_count > 0 ? school.progress_sum / school.progress_count : null,
    race_balanced_progress: school.race_balanced_count > 0 ? school.race_balanced_sum / school.race_balanced_count : null,
    share_white: school.n_total > 0 ? (school.n_white_total / school.n_total) * 100 : null,
    pct_e: school.n_total > 0 ? (school.n_e_total / school.n_total) * 100 : null,
    pct_me: school.n_total > 0 ? (school.n_me_total / school.n_total) * 100 : null,
    n: school.n_total
  };
}).sort((a, b) => (b.race_balanced_progress || 0) - (a.race_balanced_progress || 0)); // Sort by race-balanced progress
```

## Student Progress Analysis

The table below shows Cambridge schools ranked by their race-balanced progress scores. These metrics focus on student growth rather than absolute achievement levels, providing insight into how effectively schools are helping students improve over time.

```js
// Add grade range formatting to schools data
const schoolsWithGradeRange = cambridgeSchools.map(school => ({
  ...school,
  grade_range: school.min_grade === school.max_grade 
    ? `Grade ${school.min_grade}` 
    : `Grades ${school.min_grade}-${school.max_grade}`
}));

const progressTable = Inputs.table(schoolsWithGradeRange, {
  columns: ["school", "grade_range", "progress", "race_balanced_progress", "share_white", "n"],
  header: {
    "school": "School", 
    "grade_range": "Grade Levels",
    "progress": "Progress",
    "race_balanced_progress": "Race-Balanced Progress", 
    "share_white": "Share White (%)",
    "n": "# Tests"
  },
  format: {
    progress: (x) => x !== null ? x.toFixed(1) : "N/A",
    race_balanced_progress: (x) => x !== null ? x.toFixed(1) : "N/A",
    share_white: (x) => x !== null ? x.toFixed(1) : "N/A",
    n: (x) => x.toLocaleString()
  },
  width: {
    school: 280,
    grade_range: 120,
    progress: 100,
    race_balanced_progress: 140,
    share_white: 120,
    n: 100
  }
});

display(progressTable);
```

## Achievement Levels Analysis

This section examines the percentage of students meeting or exceeding expectations on MCAS tests. While these metrics reflect overall academic achievement, they are influenced by factors beyond school quality such as student demographics and prior preparation.

```js
// Create a more detailed levels analysis with additional breakdowns
const levelsTable = Inputs.table(schoolsWithGradeRange, {
  columns: ["school", "grade_range", "pct_me", "pct_e", "share_white", "n"],
  header: {
    "school": "School", 
    "grade_range": "Grade Levels",
    "pct_me": "Meeting/Exceeding (%)", 
    "pct_e": "Exceeding (%)",
    "share_white": "Share White (%)",
    "n": "# Tests"
  },
  format: {
    pct_me: (x) => x !== null ? x.toFixed(1) : "N/A",
    pct_e: (x) => x !== null ? x.toFixed(1) : "N/A",
    share_white: (x) => x !== null ? x.toFixed(1) : "N/A",
    n: (x) => x.toLocaleString()
  },
  width: {
    school: 280,
    grade_range: 120,
    pct_me: 140,
    pct_e: 120,
    share_white: 120,
    n: 100
  },
  sort: "pct_me",
  reverse: true
});

display(levelsTable);
```

### Subject-Specific Achievement Analysis

Let's examine how Cambridge schools perform across different subjects:

```js
// Get subject-specific data for Cambridge schools
const subjectData = await db.query(`
  SELECT 
    ORG_NAME AS school,
    SUBJECT_CODE as subject,
    100*SUM(n_me)/SUM(n) AS pct_me,
    100*SUM(n_e)/SUM(n) AS pct_e,
    SUM(n) as n,
    100*SUM(n_white)/SUM(n) AS share_white
  FROM mcas 
  WHERE DIST_NAME = 'Cambridge' 
    AND SUBSTR(ORG_CODE, -4) != '0000'
    AND n > 0 AND n_me IS NOT NULL AND n_e IS NOT NULL
  GROUP BY ORG_NAME, SUBJECT_CODE
  HAVING SUM(n) >= 20  -- Only include substantial sample sizes
  ORDER BY ORG_NAME, SUBJECT_CODE
`);

const subjectLabels = {"ELA": "English", "MATH": "Math", "SCI": "Science"};

const subjectTableData = subjectData.map(d => ({
  ...d,
  subject_display: subjectLabels[d.subject] || d.subject
}));

const subjectTable = Inputs.table(subjectTableData, {
  columns: ["school", "subject_display", "pct_me", "pct_e", "share_white", "n"],
  header: {
    "school": "School",
    "subject_display": "Subject", 
    "pct_me": "Meeting/Exceeding (%)",
    "pct_e": "Exceeding (%)",
    "share_white": "Share White (%)",
    "n": "# Tests"
  },
  format: {
    pct_me: (x) => x !== null ? x.toFixed(1) : "N/A",
    pct_e: (x) => x !== null ? x.toFixed(1) : "N/A",
    share_white: (x) => x !== null ? x.toFixed(1) : "N/A",
    n: (x) => x.toLocaleString()
  },
  width: {
    school: 240,
    subject_display: 100,
    pct_me: 140,
    pct_e: 120,
    share_white: 120,
    n: 100
  },
  sort: "pct_me",
  reverse: true
});

display(subjectTable);
```
