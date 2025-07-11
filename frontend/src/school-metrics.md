---
title: School Metrics
toc: true
---

```js
import * as Plot from "npm:@observablehq/plot";
import SQLite from "npm:@observablehq/sqlite";
import {Cite} from "npm:@citation-js/core";
import "npm:@citation-js/plugin-doi";
import "npm:@citation-js/plugin-bibtex";
import "npm:@citation-js/plugin-csl";
```

```html
<style>
.bibliography-container .csl-bib-body {
  line-height: 1.6;
}

.bibliography-container .csl-entry {
  margin-bottom: 1em;
  padding-left: 2em;
  text-indent: -2em;
}

.bibliography-container .csl-entry:last-child {
  margin-bottom: 0;
}
</style>
```

```js
const db = FileAttachment("data/mcas.db").sqlite();
```

```js
// Subject labels for display
const subjectLabels = {"ELA": "English", "MATH": "Math", "SCI": "Science"};
```

```js
// Citation examples and helper functions
const citations = new Cite();

// Add citations using DOIs, URLs, or BibTeX
const exampleCitations = [
  "10.1080/19345747.2015.1086915", // DOI example
  // You can also add BibTeX entries directly:
  `@article{reardon2016,
    title={School district socioeconomic status, race, and academic achievement},
    author={Reardon, Sean F and Kalogrides, Demetra and Shores, Kenneth},
    journal={American Educational Research Journal},
    volume={53},
    number={4},
    pages={1036--1073},
    year={2016}
  }`
];

// Function to generate formatted citations
function formatCitations(citationStyle = 'apa') {
  return citations.format('bibliography', {
    format: 'html',
    template: citationStyle,
    lang: 'en-US'
  });
}

// Function to get in-text citation
function getInTextCitation(id, style = 'apa') {
  return citations.format('citation', {
    format: 'text',
    template: style,
    entry: [id]
  });
}
```

# School Metrics

<div class="tip" label="Key Question">

**How should we measure school quality (with publicly available data)?**

</div>

## Research

Locovote ranks school-quality measures according to insights from [“Race and the Mismeasure of School Quality”](https://doi.org/10.1257/aeri.20220292). That study shows that traditional ratings echo student demographics more than actual school effectiveness. Using randomized school-assignment data, the authors found that schools enrolling higher shares of White students are not inherently better at educating children, they only appear so because of selection bias.

Here are the measures we consider in reverse-order of importance:

1. **Test score levels:** Traditional proficiency ratings, specifically the share of students scoring "proficient", are heavily influenced by student demographics, not by school quality. They exhibit strong racial correlations and poor predictive accuracy, essentially measuring neighborhood characteristics rather than educational effectiveness.

2. **Test score progress:** Student Growth Percentiles (SGPs) measure year-over-year improvement, capturing how much schools contribute to learning independently of students' backgrounds. These progress ratings are more accurate than achievement levels and are far less correlated with demographics.

3. **Race-balanced progress:** Student growth measures in which racial bias is statistically removed through regression adjustment. This approach removes demographic bias while simultaneously improving the predictive accuracy of true school quality.

<div class="warning" label="Open Research Question">

**Do the findings in ${inTextCitations[0].text} extend to making comparisons across school districts?**

The findings in their paper were specific to New York City and Denver, two large urban districts. It is possible that applying their conclusions to comparisons across districts may not be appropriate. I suggest considering both race-balanced progress and test score progress measures. Locovote includes test score levels so users can view these traditional measures, but they are not good indicators of school quality.

</div>

If you're interested in reading more about the research, a copy of their paper is available [here](https://economics.mit.edu/sites/default/files/2025-02/angrist-et-al-2024-race-and-the-mismeasure-of-school-quality.pdf).

## Data

The figure below examines the relationship between a district's racial composition and test-score progress. Each point represents a school district; the x-axis shows the proportion of White students, and the y-axis shows the average Student Growth Percentile. The size of each point reflects the number of students in that school district.

```js
async function createDemographicsGrowthData() {
  const query = `
    SELECT 
      DIST_NAME as district,
      year,
      SUBJECT_CODE as subject,
      AVG(avg_sgp) as avg_sgp,
      SUM(n_white) as total_n_white,
      SUM(n) as total_n,
      CASE 
        WHEN SUM(n) > 0 THEN CAST(SUM(n_white) AS FLOAT) / SUM(n)
        ELSE NULL 
      END as prop_white
    FROM mcas 
    WHERE SUBSTR(ORG_CODE, -4) = '0000' 
      AND avg_sgp IS NOT NULL
      AND n > 0
      AND n_white IS NOT NULL
      AND DIST_NAME != 'State'
    GROUP BY DIST_NAME, year, SUBJECT_CODE
    HAVING SUM(n) > 100  -- Only include districts with substantial sample sizes
    ORDER BY district, year, subject
  `;
  
  const data = await db.query(query);
  
  // Filter out null values and ensure reasonable bounds
  return data.filter(d => 
    d.avg_sgp !== null && 
    d.prop_white !== null && 
    d.prop_white >= 0 && 
    d.prop_white <= 1
  );
}
```

```js
function calculateWeightedLinearRegression(data, xKey, yKey, weightKey) {
  if (data.length < 3) return null; // Need at least 3 points for meaningful regression
  
  const n = data.length;
  const weights = data.map(d => d[weightKey]);
  const xValues = data.map(d => d[xKey]);
  const yValues = data.map(d => d[yKey]);
  
  // Calculate weighted sums
  const sumWeights = weights.reduce((sum, w) => sum + w, 0);
  const xMean = data.reduce((sum, d, i) => sum + weights[i] * d[xKey], 0) / sumWeights;
  const yMean = data.reduce((sum, d, i) => sum + weights[i] * d[yKey], 0) / sumWeights;
  
  // Calculate weighted slope
  const numerator = data.reduce((sum, d, i) => sum + weights[i] * (d[xKey] - xMean) * (d[yKey] - yMean), 0);
  const denominator = data.reduce((sum, d, i) => sum + weights[i] * Math.pow(d[xKey] - xMean, 2), 0);
  
  if (denominator === 0) return null;
  
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  
  // Calculate weighted standard error
  const predictions = data.map(d => slope * d[xKey] + intercept);
  const weightedSSE = data.reduce((sum, d, i) => sum + weights[i] * Math.pow(d[yKey] - predictions[i], 2), 0);
  const effectiveN = Math.pow(sumWeights, 2) / weights.reduce((sum, w) => sum + w * w, 0); // Effective sample size
  const mse = weightedSSE / (effectiveN - 2);
  const standardError = Math.sqrt(mse / denominator);
  
  return { slope, intercept, standardError, n, effectiveN, sumWeights };
}
```

```js
async function createDemographicsGrowthChart() {
  const data = await createDemographicsGrowthData();
  
  if (data.length === 0) {
    return html`<div style="width: 830px; height: 600px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">No data available for demographics analysis</p>
    </div>`;
  }
  
  return Plot.plot({
    title: "Test Score Progress vs. Share White by Year and Subject",
    width: 830,
    height: 1600,
    x: {
      label: "Share White",
      domain: [0, 1],
      tickFormat: d => `${Math.round(d * 100)}%`
    },
    y: {
      label: "Average Student Growth Percentile",
      grid: true,
    },
    facet: {
      data: data,
      x: "subject",
      y: "year",
      label: null
    },
    fx: {
      label: "",
      tickFormat: d => subjectLabels[d] || d
    },
    fy: {
      label: "",
      tickFormat: d => d.toString()
    },
    r: {
      range: [1, 8]  // Smaller range for point sizes
    },
    marks: [
      Plot.frame(),
      Plot.dot(data, {
        x: "prop_white",
        y: "avg_sgp",
        fill: "#2563eb",
        fillOpacity: 0.6,
        r: "total_n",
        title: d => `${d.district}\n${d.year} ${subjectLabels[d.subject] || d.subject}\nWhite students: ${Math.round(d.prop_white * 100)}%\nGrowth percentile: ${d.avg_sgp?.toFixed(1)}\nTotal students: ${d.total_n?.toLocaleString()}`
      }),
      Plot.linearRegressionY(data, {
        x: "prop_white",
        y: "avg_sgp",
        stroke: "#dc2626",
        strokeWidth: 2,
        strokeOpacity: 0.8,
        ci: 0
      }),
    ]
  });
}
```

<div class="card">${await createDemographicsGrowthChart()}</div>

The next chart illustrates how the relationship between test score progress and demographics has evolved over time. Each point is the slope estimate for a given year and subject, error bars denote 95% confidence intervals.

```js
async function createSlopeEstimatesChart() {
  const data = await createDemographicsGrowthData();
  
  if (data.length === 0) {
    return html`<div style="width: 830px; height: 600px; display: flex; align-items: center; justify-content: center; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px;">
      <p style="color: #666; margin: 0;">No data available for slope estimates</p>
    </div>`;
  }
  
  // Group data by year and subject
  const groupedData = {};
  data.forEach(d => {
    const key = `${d.year}-${d.subject}`;
    if (!groupedData[key]) groupedData[key] = [];
    groupedData[key].push(d);
  });
  
  // Calculate weighted regression stats for each group
  const regressionStats = Object.entries(groupedData).map(([key, groupData]) => {
    const [year, subject] = key.split('-');
    const stats = calculateWeightedLinearRegression(groupData, 'prop_white', 'avg_sgp', 'total_n');
    
    if (!stats || !isFinite(stats.slope) || !isFinite(stats.standardError)) return null;
    
    // Calculate 95% confidence intervals
    const criticalValue = 1.96; // 95% CI
    const marginOfError = criticalValue * stats.standardError;
    const ci_lower = stats.slope - marginOfError;
    const ci_upper = stats.slope + marginOfError;
    
    // Only include if all values are finite
    if (!isFinite(ci_lower) || !isFinite(ci_upper)) return null;
    
    return {
      year: parseInt(year),
      subject: subject,
      subject_label: subjectLabels[subject] || subject,
      slope: stats.slope,
      standard_error: stats.standardError,
      ci_lower: ci_lower,
      ci_upper: ci_upper,
      n_districts: stats.n,
      total_students: stats.sumWeights
    };
  }).filter(d => d !== null);
  
  // Sort by year and subject
  regressionStats.sort((a, b) => a.year - b.year || a.subject.localeCompare(b.subject));
  // display(regressionStats);
  
  return Plot.plot({
    title: "Regression Estimates: Test Score Progress vs. Share White",
          width: 830,
      height: 400,
      insetTop: 2,
      insetBottom: 2,
      insetLeft: 40,
      insetRight: 40,
    // marginLeft: 60,
    // marginRight: 20,
    // marginTop: 30,
    // marginBottom: 50,
    x: {
      label: "Year",
      type: "linear",
      tickFormat: d => d.toString(),
      zero: false,
      nice: true
    },
    y: {
      label: "Slope Estimate",
      grid: true,
      zero: true,
      nice: true
    },
    facet: {
      data: regressionStats,
      x: "subject"
    },
    fx: {
      label: "",
      tickFormat: d => subjectLabels[d] || d
    },
    marks: [
      Plot.frame(),
        Plot.ruleY([0], {stroke: "#666", strokeDasharray: "3,3", opacity: 0.7}),
              // Error bars (confidence intervals)
        Plot.ruleX(regressionStats, {
          x: "year",
          y1: "ci_lower",
          y2: "ci_upper",
          // stroke: "subject",
          strokeWidth: 2,
          strokeOpacity: 0.6
        }),
      // Point estimates
      Plot.dot(regressionStats, {
        x: "year",
        y: "slope",
        fill: "white",
        // stroke: "white",
        strokeWidth: 1,
        r: 4,
        title: d => `${d.subject_label} ${d.year}\nSlope: ${d.slope?.toFixed(3)}\n95% CI: [${d.ci_lower?.toFixed(3)}, ${d.ci_upper?.toFixed(3)}]\nStd Error: ${d.standard_error?.toFixed(3)}\n${d.n_districts} districts, ${d.total_students?.toLocaleString()} students`
      })
    ]
  });
}
```

<div class="card">${await createSlopeEstimatesChart()}</div>

The data are sourced from [this dataset](https://educationtocareer.data.mass.gov/Assessment-and-Accountability/MCAS-Achievement-Results/i9w6-niyt/about_data). The quotation below provides additional context for interpreting trends in the slope estimates presented in the graph above.

> "Student growth percentile (AVG_SGP) was calculated as a median for 2017. In 2018 and onward, it is a mean. In 2021, a baseline SGP method was used to compare growth from 2019 to 2021, following the COVID-19 pandemic. For all other years, a cohort referenced model is used. For more information on SGP calculations, please see the [Student Growth page](https://www.doe.mass.edu/mcas/growth) on DESE's website."

## References


```js
// Create a citation manager
const academicCitations = new Cite();

// Add citations using different methods
await academicCitations.addAsync([
  // Method 1: Using DOI (automatically fetches metadata)
  "10.1257/aeri.20220292", // Angrist et al. "Race and the Mismeasure of School Quality"
  "10.1016/bs.hesedu.2023.03.001",
]);
```

```js
// Get in-text citations
const inTextCitations = academicCitations.get().map((entry, index) => {
  const citation = new Cite(entry);
  return {
    id: index,
    text: citation.format('citation', {
      format: 'text',
      template: 'chicago-author-date'
    }),
    title: entry.title || 'Untitled'
  };
});
```

```js
// You can also format in different styles
const chicagoBibliography = academicCitations.format('bibliography', {
  format: 'html',
  template: 'chicago-author-date',
  lang: 'en-US'
});

// Create element and set innerHTML to properly render Citation.js HTML
const bibliographyElement = html`<div class="bibliography-container"></div>`;
bibliographyElement.innerHTML = chicagoBibliography;
```

${bibliographyElement}
