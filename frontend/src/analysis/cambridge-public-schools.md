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

  // Debug: Check a few data points
  console.log("Sample enrichedData points:", enrichedData.slice(0, 3));
  
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
    r: {
      type: "identity", // Use raw values directly without sqrt scaling
      range: [3, 12] // Minimum and maximum radius in pixels
    },
    marks: [
      // Reference line at 50 (typical growth) - bottom layer
      Plot.ruleY([50], {stroke: "#666", strokeDasharray: "2,2", opacity: 0.5}),
      
      // Add trend line for each subject - middle layer
      Plot.linearRegressionY(enrichedData, {
        x: "share_white", 
        y: "progress",
        fx: "subject_display",
        stroke: "#dc2626",
        strokeWidth: 2,
        strokeOpacity: 0.5,
        ci: 0  // Remove confidence interval/uncertainty band
      }),

      // Points for each school-subject with hover functionality - top layer
      Plot.dot(enrichedData, {
        x: "share_white",
        y: "progress",
        fx: "subject_display",
        r: d => 4 + d.n / 500,
        fill: "school_level",
        fillOpacity: 1.0, // Full opacity for clear visibility
        stroke: "black", // Small black stroke on the outside
        strokeWidth: 1,
        title: d => `${d.school}\nSubject: ${d.subject_display}\nLevel: ${d.school_level}\nProgress: ${d.progress.toFixed(1)}\nShare White: ${d.share_white.toFixed(1)}%\nTests: ${d.n.toLocaleString()}`
      }),


    ]
  });

  // Apply auto-labeling to the plot
  const plotWithLabels = addSchoolLabels(subjectPlot, enrichedData, "share_white", "progress", "school");

  return html`<div class="card">
    <h3>Test Score Progress vs School Demographics by Subject</h3>
    <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">
      Each point shows the average student growth percentile for a school in a subject (aggregated across all years)—that is, how much student scores are increasing over time compared to the rest of the state.
      Points are colored by grade level (Elementary, Middle, High, etc.) and sized by number of tests.
      The dashed line marks typical growth (50). Red trend lines show the correlation between demographics and growth.
      School names are automatically positioned to avoid overlaps using D3-Labeler.
    </p>
    ${plotWithLabels}
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
    r: {
      type: "identity", // Use raw values directly without sqrt scaling
      range: [3, 12] // Minimum and maximum radius in pixels
    },
    marks: [
      // Add trend line for each subject - middle layer
      Plot.linearRegressionY(enrichedLevelsData, {
        x: "share_white", 
        y: "pct_meeting_exceeding",
        fx: "subject_display",
        stroke: "#dc2626",
        strokeWidth: 2,
        strokeOpacity: 0.5,
        ci: 0  // Remove confidence interval/uncertainty band
      }),

      // Points for each school-subject with hover functionality - top layer
      Plot.dot(enrichedLevelsData, {
        x: "share_white",
        y: "pct_meeting_exceeding",
        fx: "subject_display",
        r: d => 4 + d.n / 500,
        fill: "school_level",
        fillOpacity: 1.0, // Full opacity for clear visibility
        stroke: "black", // Small black stroke on the outside
        strokeWidth: 1,
        title: d => `${d.school}\nSubject: ${d.subject_display}\nLevel: ${d.school_level}\nMeeting/Exceeding: ${d.pct_meeting_exceeding.toFixed(1)}%\nShare White: ${d.share_white.toFixed(1)}%\nTests: ${d.n.toLocaleString()}`
      }),


    ]
  });

  // Apply auto-labeling to the plot
  const plotWithLabels = addSchoolLabels(levelsPlot, enrichedLevelsData, "share_white", "pct_meeting_exceeding", "school");

  return html`<div class="card">
    <h3>Test Score Levels vs School Demographics by Subject</h3>
    <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">
      Each point represents a school's percentage of students meeting or exceeding expectations in a subject (aggregated across all years). 
      Points are colored by grade level (Elementary, Middle, High, etc.) and sized by number of tests.
      Red trend lines show the correlation between demographics and achievement levels.
      School names are automatically positioned to avoid overlaps using D3-Labeler.
    </p>
    ${plotWithLabels}
  </div>`;
}

display(await createSchoolLevelsPlot());
```

```js
const db = FileAttachment("/data/cambridge.db").sqlite();
```

```js
// D3-Labeler inline implementation
function createSchoolLabeler() {
  var lab = [],
      anc = [],
      w = 1, // box width
      h = 1, // box width
      labelerObj = {};

  // Force simulation parameters (no longer needed - forces are now built-in)

  // Greedy optimization functions
  var greedyOptimizer = {
    // Calculate objective function score for a label position
    calculateScore: function(labelIndex, testX, testY) {
      var score = 0;
      var label = lab[labelIndex];
      
      // Store original position
      var origX = label.x;
      var origY = label.y;
      
      // Test position
      label.x = testX;
      label.y = testY;
      
      // 1. Line length penalty (minimize leader lines)
      var dx = label.x - anc[labelIndex].x;
      var dy = label.y - anc[labelIndex].y;
      var lineLength = Math.sqrt(dx * dx + dy * dy);
      score += lineLength * 10.0; // Higher weight for line length to pull labels closer
      
      // 2. Overlap penalties
      score += this.calculateOverlapPenalty(labelIndex) * 500.0; // Much heavier penalty for overlaps
      
      // 3. Boundary penalty (keep inside constraints)
      score += this.calculateBoundaryPenalty(labelIndex) * 10000.0; // Extremely heavy penalty for going outside
      
      // Restore original position
      label.x = origX;
      label.y = origY;
      
      return score;
    },
    
    // Calculate overlap penalty for a label
    calculateOverlapPenalty: function(labelIndex) {
      var penalty = 0;
      var label = lab[labelIndex];
      
      // Label bounding box
      var x1 = label.x - label.width / 2;
      var y1 = label.y - label.height + 0.2;
      var x2 = label.x + label.width / 2;
      var y2 = label.y + 0.2;
      
      // Check overlap with other labels
      for (var i = 0; i < lab.length; i++) {
        if (i === labelIndex) continue;
        
        var other = lab[i];
        var ox1 = other.x - other.width / 2;
        var oy1 = other.y - other.height + 0.2;
        var ox2 = other.x + other.width / 2;
        var oy2 = other.y + 0.2;
        
        var overlap_x = Math.max(0, Math.min(x2, ox2) - Math.max(x1, ox1));
        var overlap_y = Math.max(0, Math.min(y2, oy2) - Math.max(y1, oy1));
        
        if (overlap_x > 0 && overlap_y > 0) {
          penalty += overlap_x * overlap_y; // Area of overlap
        }
      }
      
      // Check distance from anchor points - enforce minimum clearance
      for (var i = 0; i < anc.length; i++) {
        var dx = label.x - anc[i].x;
        var dy = label.y - anc[i].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minDist = anc[i].r + 1.2; // Safe clearance - ensure no overlap
        
        if (dist < minDist) {
          var violation = minDist - dist;
          penalty += violation * violation * 50; // Strong penalty for being too close to points
        }
      }
      
      return penalty;
    },
    
    // Calculate boundary penalty for a label
    calculateBoundaryPenalty: function(labelIndex) {
      var penalty = 0;
      var label = lab[labelIndex];
      var margin = 1.0;
      
      var x1 = label.x - label.width / 2;
      var y1 = label.y - label.height + 0.2;
      var x2 = label.x + label.width / 2;
      var y2 = label.y + 0.2;
      
      // Penalize going outside boundaries - much stronger penalties
      if (x1 < margin) penalty += (margin - x1) * (margin - x1) * 100; // Quadratic penalty
      if (x2 > w - margin) penalty += (x2 - (w - margin)) * (x2 - (w - margin)) * 100;
      if (y1 < margin) penalty += (margin - y1) * (margin - y1) * 100;
      if (y2 > h - margin) penalty += (y2 - (h - margin)) * (y2 - (h - margin)) * 100;
      
      return penalty;
    },
    
    // Find best position for a label using grid search
    optimizeLabel: function(labelIndex) {
      var bestScore = Infinity;
      var bestX = lab[labelIndex].x;
      var bestY = lab[labelIndex].y;
      
      var anchor = anc[labelIndex];
      var searchRadius = 8.0; // Much larger search area 
      var stepSize = 0.2; // Finer grid resolution for better optimization
      
      // Grid search around the anchor point
      for (var dx = -searchRadius; dx <= searchRadius; dx += stepSize) {
        for (var dy = -searchRadius; dy <= searchRadius; dy += stepSize) {
          var testX = anchor.x + dx;
          var testY = anchor.y + dy;
          
          // Hard constraint: don't even consider positions outside boundaries
          var margin = 1.0;
          var testLabel = {
            x: testX,
            y: testY,
            width: lab[labelIndex].width,
            height: lab[labelIndex].height
          };
          var x1 = testLabel.x - testLabel.width / 2;
          var x2 = testLabel.x + testLabel.width / 2;
          var y1 = testLabel.y - testLabel.height + 0.2;
          var y2 = testLabel.y + 0.2;
          
          // Skip positions that violate boundaries
          if (x1 < margin || x2 > w - margin || y1 < margin || y2 > h - margin) {
            continue;
          }
          
          var score = this.calculateScore(labelIndex, testX, testY);
          
          if (score < bestScore) {
            bestScore = score;
            bestX = testX;
            bestY = testY;
          }
        }
      }
      
      // Update label position
      lab[labelIndex].x = bestX;
      lab[labelIndex].y = bestY;
      
      return bestScore;
    },
    
    // Fine-tune position with smaller search radius for already well-placed labels
    fineTuneLabel: function(labelIndex) {
      var bestScore = this.calculateScore(labelIndex, lab[labelIndex].x, lab[labelIndex].y);
      var bestX = lab[labelIndex].x;
      var bestY = lab[labelIndex].y;
      
      var anchor = anc[labelIndex];
      var searchRadius = 2.0; // Smaller search area for fine-tuning
      var stepSize = 0.1; // Very fine grid resolution
      
      // Fine grid search around current position
      for (var dx = -searchRadius; dx <= searchRadius; dx += stepSize) {
        for (var dy = -searchRadius; dy <= searchRadius; dy += stepSize) {
          var testX = lab[labelIndex].x + dx;
          var testY = lab[labelIndex].y + dy;
          
          // Hard constraint: don't even consider positions outside boundaries
          var margin = 1.0;
          var testLabel = {
            x: testX,
            y: testY,
            width: lab[labelIndex].width,
            height: lab[labelIndex].height
          };
          var x1 = testLabel.x - testLabel.width / 2;
          var x2 = testLabel.x + testLabel.width / 2;
          var y1 = testLabel.y - testLabel.height + 0.2;
          var y2 = testLabel.y + 0.2;
          
          // Skip positions that violate boundaries
          if (x1 < margin || x2 > w - margin || y1 < margin || y2 > h - margin) {
            continue;
          }
          
          var score = this.calculateScore(labelIndex, testX, testY);
          
          if (score < bestScore) {
            bestScore = score;
            bestX = testX;
            bestY = testY;
          }
        }
      }
      
      // Update label position
      lab[labelIndex].x = bestX;
      lab[labelIndex].y = bestY;
      
      return bestScore;
    }
  };

  // Greedy optimization step
  var greedyStep = function() {
    var improved = false;
    
    // Try to optimize each label in random order
    var labelOrder = [];
    for (var i = 0; i < lab.length; i++) {
      labelOrder.push(i);
    }
    
    // Shuffle the order to avoid systematic bias
    for (var i = labelOrder.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = labelOrder[i];
      labelOrder[i] = labelOrder[j];
      labelOrder[j] = temp;
    }
    
          // Optimize each label
      for (var i = 0; i < labelOrder.length; i++) {
        var labelIndex = labelOrder[i];
        var oldScore = greedyOptimizer.calculateScore(labelIndex, lab[labelIndex].x, lab[labelIndex].y);
        var newScore = greedyOptimizer.optimizeLabel(labelIndex);
        
        if (newScore < oldScore) {
          improved = true;
          // Log significant improvements
          if (oldScore - newScore > 10) {
            console.log(`Label ${labelIndex} improved: ${oldScore.toFixed(1)} -> ${newScore.toFixed(1)}`);
          }
        }
      }
    
    return improved;
  };

  // Utility functions removed - no longer needed for force-directed approach

  labelerObj.start = function(iterations) {
  // Greedy optimization
      var m = lab.length;
      if (m === 0) return;

      console.log(`=== STARTING GREEDY OPTIMIZATION: ${iterations} iterations, ${m} labels ===`);
      console.log(`Boundary constraints: width=${w.toFixed(2)}, height=${h.toFixed(2)}`);

      // Initialize positions farther from anchors to encourage spreading
      for (var i = 0; i < m; i++) {
        var angle = Math.random() * 2 * Math.PI;
        var minDist = anc[i].r + 1.5; // Safe clearance for initialization
        var distance = minDist + 1.0 + Math.random() * 2.0; // Start well clear of anchor
        lab[i].x = anc[i].x + Math.cos(angle) * distance;
        lab[i].y = anc[i].y + Math.sin(angle) * distance;
      }

      var improvementCount = 0;
      
      // Run greedy optimization
      for (var iter = 0; iter < iterations; iter++) {
        var improved = greedyStep();
        
        if (improved) {
          improvementCount++;
        }
        
        // Early termination if no improvements for many iterations (be very patient)
        if (iter > 30 && (iter - improvementCount) > 25) {
          console.log(`Converged after ${iter + 1} iterations (${improvementCount} improvements)`);
          break;
        }
      }
      
      // Calculate final stats
      var totalOverlaps = 0;
      var totalLineLength = 0;
      for (var i = 0; i < m; i++) {
        totalOverlaps += greedyOptimizer.calculateOverlapPenalty(i);
        var dx = lab[i].x - anc[i].x;
        var dy = lab[i].y - anc[i].y;
        totalLineLength += Math.sqrt(dx * dx + dy * dy);
      }
      
      console.log(`=== MAIN OPTIMIZATION COMPLETE: ${improvementCount} improvements ===`);
      
      // Fine-tuning phase - try to get labels closer to points
      console.log(`Starting fine-tuning phase...`);
      var fineTuningImprovements = 0;
      for (var fineTuneIter = 0; fineTuneIter < 10; fineTuneIter++) {
        var improved = false;
        
        // Fine-tune each label
        for (var i = 0; i < m; i++) {
          var oldScore = greedyOptimizer.calculateScore(i, lab[i].x, lab[i].y);
          var newScore = greedyOptimizer.fineTuneLabel(i);
          
          if (newScore < oldScore) {
            improved = true;
            fineTuningImprovements++;
            if (oldScore - newScore > 1) {
              console.log(`Fine-tune label ${i}: ${oldScore.toFixed(1)} -> ${newScore.toFixed(1)}`);
            }
          }
        }
        
        if (!improved) {
          console.log(`Fine-tuning converged after ${fineTuneIter + 1} iterations`);
          break;
        }
      }
      
      console.log(`=== GREEDY OPTIMIZATION COMPLETE: ${improvementCount} main + ${fineTuningImprovements} fine-tuning improvements ===`);
      console.log(`Final: Avg line length: ${(totalLineLength / m).toFixed(1)}, Total overlap penalty: ${totalOverlaps.toFixed(1)}`);
  };

  labelerObj.width = function(x) {
  // users insert graph width
    if (!arguments.length) return w;
    w = x;
    return labelerObj;
  };

  labelerObj.height = function(x) {
  // users insert graph height
    if (!arguments.length) return h;
    h = x;    
    return labelerObj;
  };

  labelerObj.label = function(x) {
  // users insert label positions
    if (!arguments.length) return lab;
    lab = x;
    return labelerObj;
  };

  labelerObj.anchor = function(x) {
  // users insert anchor positions
    if (!arguments.length) return anc;
    anc = x;
    return labelerObj;
  };

  // Alternative energy and schedule functions removed - not needed for force-directed approach

  return labelerObj;
};
```

```js

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

// Simplified auto-labeling function specifically for Cambridge schools plots
function addSchoolLabels(plotElement, data, xField, yField, textField) {
  // Add labels directly to the plot after it's rendered
  const container = d3.select(plotElement);
  
  // Wait a bit for plot to render, then add labels
  setTimeout(() => {
    // Remove any existing labels to prevent duplicates
    container.selectAll(".school-labels-facet-0, .school-labels-facet-1, .school-labels-facet-2").remove();
    
    // Observable Plot creates multiple SVG elements - we need the main plot SVG, not legends
    const allSvgs = container.selectAll("svg");
    
    // Find the largest SVG (should be the main plot)
    let svg = null;
    let maxArea = 0;
    
    allSvgs.each(function() {
      const svgEl = d3.select(this);
      const width = parseFloat(svgEl.attr("width")) || 0;
      const height = parseFloat(svgEl.attr("height")) || 0;
      const area = width * height;
      
      if (area > maxArea) {
        maxArea = area;
        svg = svgEl;
      }
    });
    
    if (!svg || svg.empty()) {
      return;
    }
    
    // Observable Plot creates facets as separate groups (g elements)
    // Find all groups that contain circles - these are the facet panels
    const allGroupsWithCircles = svg.selectAll("g").filter(function() {
      return d3.select(this).selectAll("circle").size() > 0;
    });
    
    // Filter to get only the actual facet groups (should have around half the data points each)
    // Skip the first group if it contains all points (likely a background/combined group)
    const expectedPointsPerFacet = Math.floor(data.length / 2);
    const facetGroups = allGroupsWithCircles.filter(function() {
      const circleCount = d3.select(this).selectAll("circle").size();
      // Look for groups with roughly half the total data points (actual facets)
      // Avoid the group with all points (combined group)
      return circleCount >= expectedPointsPerFacet && circleCount < data.length;
    });
    
    if (facetGroups.empty()) {
      return;
    }
    
    // First pass: Calculate global Y bounds across ALL facets (since they share Y-axis)
    let globalYCoords = [];
    facetGroups.each(function() {
      const facetCircles = d3.select(this).selectAll("circle");
      facetCircles.each(function() {
        const cy = parseFloat(d3.select(this).attr("cy"));
        globalYCoords.push(cy);
      });
    });
    
    const globalMinY = Math.min(...globalYCoords);
    const globalMaxY = Math.max(...globalYCoords);
    const globalYHeight = globalMaxY - globalMinY + 50; // Add 50px margin
    
    // Process each facet group separately
    facetGroups.each(function(d, facetIndex) {
      const facetGroup = d3.select(this);
      const facetCircles = facetGroup.selectAll("circle");
      
      if (facetCircles.empty()) return;
      
      // Check if this group already has labels to avoid duplicates
      if (facetGroup.select(".school-labels-facet-0, .school-labels-facet-1").size() > 0) {
        return;
      }
      
      // Extract circle data for this facet using bounding boxes
      const circleData = [];
      facetCircles.each(function(d, i) {
        const circle = d3.select(this);
        const cx = parseFloat(circle.attr("cx"));
        const cy = parseFloat(circle.attr("cy"));
        
        // Get actual bounding box for more accurate dimensions
        const pointBBox = this.getBBox();
        
        circleData.push({ 
          element: this, 
          cx, 
          cy, 
          bbox: pointBBox,  // Store full bounding box
          index: i, 
          data: d 
        });
      });
      
      // Calculate facet bounds - use global Y bounds, local X bounds
      const facetXCoords = circleData.map(d => d.cx);
      const facetMinX = Math.min(...facetXCoords);
      const facetMaxX = Math.max(...facetXCoords);
      // Use global Y bounds for consistent height across facets
      const facetMinY = globalMinY;
      const facetMaxY = globalMaxY;
      // Scale down facet dimensions to match scaled labels
      const facetWidth = (facetMaxX - facetMinX + 50) / 10; // Scale down by 10x
      const facetHeight = globalYHeight / 10; // Use global Y height, scaled down by 10x
    
      // Create arrays for the labeler for this facet
      const labels = [];
      const anchors = [];
      
      // Create a temporary text element to measure dimensions
      const tempText = svg.append("text")
        .style("font-size", "9px")
        .style("font-family", "sans-serif")
        .style("visibility", "hidden");
      
      // First pass: create anchors for ALL points in this facet using bounding boxes
      circleData.forEach((circleInfo, localIndex) => {
        const { cx, cy, bbox: pointBBox } = circleInfo;
        // Add minimal padding to the point bounding box for better collision detection
        const padding = 1;
        const paddedBBox = {
          x: pointBBox.x - padding,
          y: pointBBox.y - padding,
          width: pointBBox.width + 2 * padding,
          height: pointBBox.height + 2 * padding
        };
        
        anchors.push({
          x: (cx - facetMinX + 25) / 10, // Translate to facet-relative coordinates, then scale down
          y: (cy - facetMinY + 25) / 10, // Translate to facet-relative coordinates, then scale down
          bbox: paddedBBox, // Store the padded bounding box (still in absolute coordinates for visual)
          // Use a much smaller radius closer to actual visual circle size
          r: 0.5 // Small radius in scaled coordinates (5px when scaled back up)
        });
      });
      
      // Second pass: create labels only for valid data points
      circleData.forEach((circleInfo, localIndex) => {
        const { cx, cy, bbox: pointBBox, data: dataIndex } = circleInfo;
        
        // The boundData is actually an index into our original data array
        if (typeof dataIndex !== 'number' || dataIndex < 0 || dataIndex >= data.length) {
          return;
        }
        
        const dataPoint = data[dataIndex];
        if (!dataPoint || !dataPoint[textField]) {
          return;
        }
        
        const schoolName = dataPoint[textField];
        const schoolLevel = dataPoint.school_level; // Get school level for color mapping
        
        // Measure text width
        tempText.text(schoolName);
        const bbox = tempText.node().getBBox();
        
        // Start labels in any direction around their points
        const minDistance = 25; // Minimum distance from point
        const extraDistance = 15; // Additional random distance
        const angle = Math.random() * 2 * Math.PI; // Full 360° around the point
        const distance = minDistance + Math.random() * extraDistance;
        
        // SCALE DOWN label dimensions dramatically for D3-Labeler
        const scaledWidth = (bbox.width * 0.85) / 10; // Scale down by 10x
        const scaledHeight = (bbox.height * 1.1) / 10; // Scale down by 10x
        
        console.log(`Label "${schoolName}": original ${bbox.width.toFixed(1)}x${bbox.height.toFixed(1)} -> scaled ${scaledWidth.toFixed(1)}x${scaledHeight.toFixed(1)}`);

        labels.push({
          x: (cx - facetMinX + 25 + Math.cos(angle) * distance) / 10, // Translate to facet-relative, then scale down
          y: (cy - facetMinY + 25 + Math.sin(angle) * distance) / 10, // Translate to facet-relative, then scale down
          name: schoolName,
          width: scaledWidth,
          height: scaledHeight,
          schoolLevel: schoolLevel // Store school level for color mapping
        });
      });
      
      tempText.remove();
      
      if (labels.length === 0) {
        return;
      }
      
      // OPTIMIZATION DEBUG: Log current parameter settings and results
      console.log(`=== LABELER OPTIMIZATION DEBUG - Facet ${facetIndex} ===`);
              console.log(`Parameters: w_len=0.01, w_inter=1.0, w_lab2=100.0, w_lab_anc=300.0, w_orient=2.0`);
      console.log(`Inputs: ${labels.length} labels, ${anchors.length} anchors, dimensions: ${facetWidth}x${facetHeight}`);
      
      // Create color mapping function matching the plot's color scheme
      const getSchoolLevelColor = (schoolLevel) => {
        switch(schoolLevel) {
          case "Elementary": return "#059669";
          case "Elementary and Middle": return "#2563eb";  
          case "Middle": return "#7c3aed";
          case "High": return "#dc2626";
          default: return "var(--theme-foreground)";
        }
      };

      // Apply D3-Labeler optimization for this facet with enhanced settings
      const labeler = createSchoolLabeler()
        .label(labels)
        .anchor(anchors) 
        .width(facetWidth)
        .height(facetHeight)
                  .start(100); // Force-directed simulation iterations
      
      // Post-process labels to optimize distances
      labels.forEach((label, i) => {
        const anchor = anchors[i];
        
        // Ensure minimum distance from anchor point (considering circle radius)
        const dx = label.x - anchor.x;
        const dy = label.y - anchor.y;
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        const minRequired = anchor.r + 0; // Circle radius + minimal clearance
        
        if (currentDist < minRequired) {
          const angle = Math.atan2(dy, dx);
          label.x = anchor.x + Math.cos(angle) * minRequired;
          label.y = anchor.y + Math.sin(angle) * minRequired;
        }
      });
      
      // Additional optimization: try to pull labels closer when possible
      labels.forEach((label, i) => {
        const anchor = anchors[i];
        const minRequired = anchor.r + 0;
        
        // Try to move closer to anchor along current direction
        const dx = label.x - anchor.x;
        const dy = label.y - anchor.y;
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        
        if (currentDist > minRequired + 1) { // Only if we have room to move closer
          const angle = Math.atan2(dy, dx);
          const targetDist = minRequired + 1; // Try to get to just above minimum
          const newX = anchor.x + Math.cos(angle) * targetDist;
          const newY = anchor.y + Math.sin(angle) * targetDist;
          
          // Check for conflicts with other labels (simple distance check)
          let hasConflict = false;
          for (let j = 0; j < labels.length; j++) {
            if (i === j) continue;
            const otherLabel = labels[j];
            const distToOther = Math.sqrt((newX - otherLabel.x) ** 2 + (newY - otherLabel.y) ** 2);
            if (distToOther < 15) { // Minimum separation between labels
              hasConflict = true;
              break;
            }
          }
          
          if (!hasConflict) {
            label.x = newX;
            label.y = newY;
          }
        }
      });
      
      // Calculate final energy and distances for optimization feedback
      let totalEnergy = 0;
      let avgLeaderLength = 0;
      let labelOverlaps = 0;
      let pointOverlaps = 0;
      
      for (let i = 0; i < labels.length; i++) {
        // Leader line length
        const dx = labels[i].x - anchors[i].x;
        const dy = labels[i].y - anchors[i].y;
        const leaderLength = Math.sqrt(dx * dx + dy * dy);
        avgLeaderLength += leaderLength;
        
        // Check for label-label overlaps using actual bounding boxes
        for (let j = i + 1; j < labels.length; j++) {
          // Label i bounding box
          const label1Left = labels[i].x;
          const label1Right = labels[i].x + labels[i].width;
          const label1Top = labels[i].y - labels[i].height * 0.7;
          const label1Bottom = labels[i].y - labels[i].height * 0.7 + labels[i].height;
          
          // Label j bounding box
          const label2Left = labels[j].x;
          const label2Right = labels[j].x + labels[j].width;
          const label2Top = labels[j].y - labels[j].height * 0.7;
          const label2Bottom = labels[j].y - labels[j].height * 0.7 + labels[j].height;
          
          // Check if bounding boxes overlap
          const xOverlap = label1Left < label2Right && label1Right > label2Left;
          const yOverlap = label1Top < label2Bottom && label1Bottom > label2Top;
          
          if (xOverlap && yOverlap) labelOverlaps++;
        }
        
        // Check for label-point overlaps using actual bounding boxes
        for (let j = 0; j < anchors.length; j++) {
          const labelLeft = labels[i].x;
          const labelRight = labels[i].x + labels[i].width;
          const labelTop = labels[i].y - labels[i].height * 0.7; // Match debug box positioning
          const labelBottom = labels[i].y - labels[i].height * 0.7 + labels[i].height;
          
          // Use actual point bounding box
          const pointBBox = anchors[j].bbox;
          const pointLeft = pointBBox.x;
          const pointRight = pointBBox.x + pointBBox.width;
          const pointTop = pointBBox.y;
          const pointBottom = pointBBox.y + pointBBox.height;
          
          // Check if label rectangle overlaps with point bounding box
          const xOverlap = labelLeft < pointRight && labelRight > pointLeft;
          const yOverlap = labelTop < pointBottom && labelBottom > pointTop;
          
          if (xOverlap && yOverlap) pointOverlaps++;
        }
      }
      
      avgLeaderLength = avgLeaderLength / labels.length;
      
      console.log(`Results: Avg leader length: ${avgLeaderLength.toFixed(1)}px, Label overlaps: ${labelOverlaps}, Point overlaps: ${pointOverlaps}`);
      console.log(`=== END DEBUG ===`);
      
      // Add labels and leader lines to this facet group - insert at the beginning so they appear behind circles
      const labelGroup = facetGroup.insert("g", ":first-child")
        .attr("class", `school-labels-facet-${facetIndex}`);
      
      // DEBUG: Draw bounding boxes for points - HIDDEN
      // const pointBoxes = labelGroup.selectAll(".point-bbox")
      //   .data(anchors)
      //   .enter()
      //   .append("rect")
      //   .attr("class", "point-bbox")
      //   .attr("x", d => d.bbox.x) // Keep original scale - this was already correct
      //   .attr("y", d => d.bbox.y) // Keep original scale - this was already correct
      //   .attr("width", d => d.bbox.width) // Keep original scale - this was already correct
      //   .attr("height", d => d.bbox.height) // Keep original scale - this was already correct
      //   .attr("fill", "none")
      //   .attr("stroke", "red")
      //   .attr("stroke-width", 1)
      //   .attr("stroke-dasharray", "2,2")
      //   .attr("opacity", 0.7);
      
            // Add leader lines with matching school level colors (scale positions back up)
      const leaderLines = labelGroup.selectAll(".leader-line")
        .data(labels)
        .enter()
        .append("line")
        .attr("class", "leader-line")
        .attr("x1", (d, i) => (anchors[i].x * 10) + facetMinX - 25) // Scale back up and translate to absolute coordinates
        .attr("y1", (d, i) => (anchors[i].y * 10) + facetMinY - 25) // Scale back up and translate to absolute coordinates
        .attr("x2", d => (d.x * 10) + facetMinX - 25) // Scale back up and translate to absolute coordinates
        .attr("y2", d => (d.y * 10) + facetMinY - 25) // Scale back up and translate to absolute coordinates
        .attr("stroke", d => getSchoolLevelColor(d.schoolLevel))
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .attr("opacity", 0.7);
      
      // Add positioned labels with exact Observable Plot text styling and matching colors (scale positions back up)
      const labelTexts = labelGroup.selectAll(".school-label")
        .data(labels)
        .enter()
        .append("text")
        .attr("class", "school-label")
        .attr("x", d => (d.x * 10) + facetMinX - 25) // Scale back up and translate to absolute coordinates
        .attr("y", d => (d.y * 10) + facetMinY - 25) // Scale back up and translate to absolute coordinates
        .text(d => d.name)
        .style("font", "7px var(--sans-serif)")
        .style("fill", d => getSchoolLevelColor(d.schoolLevel)) // Use school level color
        .style("text-anchor", "middle")
        .style("white-space", "pre")
        .style("stroke", "var(--plot-background, white)")
        .style("stroke-width", "3px")
        .style("paint-order", "stroke")
        .style("opacity", "1.0");
      
      // DEBUG: Draw plot boundary rectangle - HIDDEN
      // labelGroup.append("rect")
      //   .attr("class", "plot-boundary")
      //   .attr("x", facetMinX - 25) // Position at actual facet origin (with margin)
      //   .attr("y", facetMinY - 25) // Position at actual facet origin (with margin)
      //   .attr("width", facetWidth * 10) // Scale back up to visual coordinates
      //   .attr("height", facetHeight * 10) // Scale back up to visual coordinates
      //   .attr("fill", "none")
      //   .attr("stroke", "red")
      //   .attr("stroke-width", 2)
      //   .attr("stroke-dasharray", "5,5")
      //   .attr("opacity", 0.8);

      // DEBUG: Draw bounding boxes for labels - HIDDEN
      // const labelBoxes = labelGroup.selectAll(".label-bbox")
      //   .data(labels)
      //   .enter()
      //   .append("rect")
      //   .attr("class", "label-bbox")
      //   .attr("x", d => (d.x * 10) + facetMinX - 25 - (d.width * 10) / 2) // Center-justified: subtract half width, translate to absolute coordinates
      //   .attr("y", d => (d.y * 10) + facetMinY - 25 - (d.height * 10) * 0.7) // Scale back up and adjust positioning, translate to absolute coordinates
      //   .attr("width", d => d.width * 10) // Scale back up to match actual label size
      //   .attr("height", d => d.height * 10) // Scale back up to match actual label size
      //   .attr("fill", "none")
      //   .attr("stroke", "blue")
      //   .attr("stroke-width", 1)
      //   .attr("stroke-dasharray", "3,3")
      //   .attr("opacity", 0.8);
      

    }); // End facet group processing
    
  }, 150);
  
  return plotElement;
}
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
