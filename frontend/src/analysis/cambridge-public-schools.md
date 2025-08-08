---
title: Cambridge Public Schools
toc: true
---

# Cambridge Public Schools

My very thoughtful friend [Eugenia](https://www.voteeugenia.com/) is running for School Committee in Cambridge. I'm a big fan of her and her slogan:

> "Every child deserves a **great** education."

Eugenia saw Locovote and thought there might be an opportunity to collaborate.

<div class="tip" label="Key Question">

**Based on the data we have, which schools in Cambridge should we be looking up to, and which schools have room for improvement?**

</div>

For Cambridge, I think it makes sense to compare schools using test score progress and race-balanced progress measures. I include test score levels since this is how schools are often compared. If you're curious to learn more about the pros and cons of the various measures see the [school metrics page](/school-metrics).

## Test Score Progress

```js
async function createSchoolSubjectPlot() {
  // Get school-subject level data aggregated across all years - focus on ELA and MATH only
  const subjectData = await db.query(`
    SELECT 
      ORG_NAME AS school,
      ORG_CODE AS school_code,
      SUBJECT_CODE as subject,
      SUM(avg_sgp * avg_sgp_incl) / SUM(avg_sgp_incl) as progress,
      100*SUM(n_white)/SUM(n) AS share_white,
      SUM(avg_sgp_incl) as n,
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
    ORDER BY SUBJECT_CODE, ORG_NAME
  `);
  // console.log(subjectData);

  if (subjectData.length === 0) {
    return html`<p>No subject-level data available for Cambridge schools.</p>`;
  }

  // Add subject labels and use schoolTypes object for categorization
  const subjectLabels = {"ELA": "English", "MATH": "Math"};
  const enrichedData = subjectData.map(d => {
    // Use predefined schoolTypes object instead of calculating from grades
    const school_level = schoolTypes[d.school] || "Unknown";
    
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
      label: "Average Student Growth Percentile",
      grid: true,
      domain: [yMin - yPadding, yMax + yPadding]
    },
    fx: {
      label: "",
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
    <h3>Test Score Progress vs School Demographics by Subject</h3>
    <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">
      Each point shows the average student growth percentile for a school in a subject (aggregated across all years)—that is, how much student scores are increasing over time compared to the rest of the state.
      Points are colored by grade level (Elementary, Middle, High, etc.) and sized by number of tests.
      The dashed line marks typical growth (50). Red trend lines show the correlation between demographics and growth.
      Hover over points to see detailed information about each school.
    </p>
    ${subjectPlot}
  </div>`;
}

display(await createSchoolSubjectPlot());
```

## Test Score Levels

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
    ORDER BY SUBJECT_CODE, ORG_NAME
  `);

  if (levelsData.length === 0) {
    return html`<p>No levels data available for Cambridge schools.</p>`;
  }
  // console.log(levelsData);

  // Add subject labels and use schoolTypes object for categorization
  const subjectLabels = {"ELA": "English", "MATH": "Math"};
  const enrichedLevelsData = levelsData.map(d => {
    // Use predefined schoolTypes object instead of calculating from grades
    const school_level = schoolTypes[d.school] || "Unknown";
    
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
      label: "",
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
    <h3>Test Score Levels vs School Demographics by Subject</h3>
    <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">
      Each point represents a school's percentage of students meeting or exceeding expectations in a subject (aggregated across all years). 
      Points are colored by grade level (Elementary, Middle, High, etc.) and sized by number of tests.
      Red trend lines show the correlation between demographics and achievement levels.
      Hover over points to see detailed information about each school.
    </p>
    ${levelsPlot}
  </div>`;
}

display(await createSchoolLevelsPlot());
```

```js
const db = FileAttachment("/data/cambridge.db").sqlite();
const schoolTypes = {
  "Amigos School": "Elementary and Middle",
  "Cambridge Rindge and Latin": "High",
  "Cambridge Street Upper School": "Middle",
  "Cambridgeport": "Elementary",
  "Fletcher/Maynard Academy": "Elementary",
  "Graham and Parks": "Elementary",
  "Haggerty": "Elementary",
  "John M Tobin": "Elementary",
  "Kennedy-Longfellow": "Elementary",
  "King Open": "Elementary",
  "Maria L. Baldwin": "Elementary",
  "Martin Luther King Jr.": "Elementary",
  "Morse": "Elementary",
  "Peabody": "Elementary",
  "Putnam Avenue Upper School": "Middle",
  "Rindge Avenue Upper School": "Middle",
  "Vassal Lane Upper School": "Middle"
};
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

## The Data

```js
// Get comprehensive school-subject level data with all metrics
const comprehensiveData = await db.query(`
  SELECT 
    ORG_NAME AS school,
    ORG_CODE AS school_code,
    SUBJECT_CODE as subject,
    SUM(avg_sgp * avg_sgp_incl) / SUM(avg_sgp_incl) as progress,
    100*SUM(n_me)/SUM(n) AS levels,
    100*SUM(n_white)/SUM(n) AS share_white,
    SUM(avg_sgp_incl) as sum_avg_sgp_incl,
    SUM(n) as n_tests
  FROM mcas 
  WHERE DIST_NAME = 'Cambridge' 
    AND SUBSTR(ORG_CODE, -4) != '0000'
    AND SUBJECT_CODE IN ('ELA', 'MATH')
  GROUP BY ORG_NAME, ORG_CODE, SUBJECT_CODE
  ORDER BY ORG_NAME, SUBJECT_CODE
`);

// Calculate race-balanced progress for each school-subject combination
const comprehensiveDataWithRaceBalanced = comprehensiveData.map(d => {
  const prop_white = d.share_white / 100;
  
  // Find the regression parameters for this subject across all Cambridge observations
  const subjectKey = d.subject;
  let race_balanced_progress = null;
  
  // Simple approach: use the overall Cambridge regression slope for the subject
  // This is a simplified version - in practice you'd want the full regression analysis
  const cambridgeSubjectData = cambridgeDetailedData.filter(cd => cd.subject === d.subject);
  if (cambridgeSubjectData.length > 0) {
    const regression = calculateWeightedLinearRegression(
      cambridgeSubjectData.map(cd => ({
        ...cd,
        prop_white: cd.n > 0 ? cd.n_white / cd.n : 0
      })), 
      'prop_white', 
      'avg_sgp', 
      'n'
    );
    
    if (regression && d.progress !== null) {
      const { slope, intercept } = regression;
      const predicted_sgp = slope * prop_white + intercept;
      race_balanced_progress = d.progress - predicted_sgp + 50;
    }
  }
  
  return {
    ...d,
    race_balanced_progress,
    subject_display: {"ELA": "English", "MATH": "Math", "SCI": "Science"}[d.subject] || d.subject
  };
});

const comprehensiveTable = Inputs.table(comprehensiveDataWithRaceBalanced, {
  columns: ["school", "subject_display", "progress", "race_balanced_progress", "sum_avg_sgp_incl", "levels", "n_tests", "share_white"],
  header: {
    "school": "School",
    "subject_display": "Subject", 
    "progress": "Progress",
    "race_balanced_progress": "Race-Balanced Progress",
    "sum_avg_sgp_incl": "# Tests (Progress)",
    "levels": "Levels (%)",
    "n_tests": "# Tests (Levels)",
    "share_white": "Share White (%)"
  },
  format: {
    progress: (x) => x !== null ? x.toFixed(1) : "N/A",
    race_balanced_progress: (x) => x !== null ? x.toFixed(1) : "N/A",
    sum_avg_sgp_incl: (x) => x !== null ? x.toLocaleString() : "N/A",
    levels: (x) => x !== null ? x.toFixed(1) : "N/A",
    n_tests: (x) => x.toLocaleString(),
    share_white: (x) => x !== null ? x.toFixed(1) : "N/A"
  },
  width: {
    school: 220,
    subject_display: 80,
    progress: 80,
    race_balanced_progress: 120,
    sum_avg_sgp_incl: 110,
    levels: 80,
    n_tests: 80,
    share_white: 100
  },
  sort: "race_balanced_progress",
  reverse: true
});

display(comprehensiveTable);
```

## Conclusions

The MCAS test scores coming out of Kennedy-Longfellow and Fletcher Maynard Academy are concerning. Kennedy-Longfellow has [closed](https://www.cambridgeday.com/2025/05/27/as-kennedy-longfellow-school-nears-closing-community-seeks-memories-for-final-events/). Thinking about what would help the children at Fletcher Maynard could be really impactful.

Dr. Martin Luther King, Jr. School is really good. It's nice to see they were named a [2024 National Blue Ribbon School](https://mlk.cpsd.us/school_news/cps_school_2024_national_blue_ribbon_school).

> "Cambridge Public Schools is proud to announce that the U.S. Department of Education has recognized the Dr. Martin Luther King, Jr. School as a 2024 National Blue Ribbon School (NBRS), receiving acclaim for the school's progress in closing student achievement gaps. Only nine schools in the state were recognized as a 2024 National Blue Ribbon School."

Amigos School is also very good (I didn't realize they teach both elementary and middle school students).

The test score progress at Haggerty is great, but the test score levels are a little disappointing. I wonder if their curriculum is too easy in grades 3 and below.

In terms of test score levels, King Open doesn't look great, but when we look at test score progress they're doing an okay job helping students keep up with the state average growth.

Of the five middle schools, Cambridge Street Upper School looks to have the most room for improvement.

Vassal Lane Upper School is making a lot of progress on math, it might be informative to learn from their approach to teaching math.

<div class="tip" label="Thanks">

When reviewing the first draft of this analysis, Eugenia "Eagle Eyes" Schraa Huh noticed that the number of tests reported for Kennedy-Longfellow and Fletcher Maynard Academy were way too low. I dug deeper into the data and found that groups with fewer than 10 students are omitted from the data (to protect student privacy). I modified the code to move away from "school-year-grade" analyses to "school-year" analyses. Now what is presented on this page should be consistent with the [DESE School and District Profiles](https://profiles.doe.mass.edu/mcas/achievement_level.aspx?linkid=32&orgcode=00490040&orgtypecode=6&).

</div>
