// ggrepel-style force-based labeler implementation

// Global seedable random number generator for consistent label placement
var globalSeededRandom = {
  seed: 1234,
  state: 12345,
  
  // Simple LCG (Linear Congruential Generator) for deterministic randomness
  random: function() {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  },
  
  // Reset random seed
  reset: function(seed) {
    this.seed = seed || 12345;
    this.state = this.seed;
  }
};

function createSchoolLabeler() {
  var lab = [],
      anc = [],
      w = 1, // box width
      h = 1, // box height
      labelerObj = {},
      algorithm = 'physics'; // 'physics' or 'annealing'

  // ggrepel-style physics simulation parameters (adjusted for better convergence)
  var physics = {
    force_push: 1e-6,     // Stronger initial repulsion force for better convergence
    force_pull: 1e-6,     // Stronger initial spring force for better convergence
    max_time: 0.2,        // Longer maximum simulation time
    max_iter: 3000,       // More iterations allowed
    max_overlaps: 10,     // Maximum overlaps before disabling label (matches C++)
    velocity_decay: 0.8,  // Slightly higher velocity decay for more stability
    force_point_size: 100.0, // Multiplier for point repulsion forces (matches C++)
    force_push_decay: 0.9999, // Faster force decay to prevent oscillation
    force_pull_decay: 0.999,  // Faster spring force decay
    
    // Use global seeded random for consistency
    seededRandom: function() {
      return globalSeededRandom.random();
    },
    
    // Initialize physics state (C++ style)
    velocities: [],
    original_positions: [],
    total_overlaps: [],
    too_many_overlaps: [],
    text_box_widths: [],
    
    // Euclidean distance between two points
    euclid: function(a, b) {
      var dx = a.x - b.x;
      var dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    
    // Check if two boxes overlap (with small buffer for clearance)
    boxesOverlap: function(box1, box2) {
      var buffer = 0.1; // Small buffer for label separation
      return !(box1.x2 + buffer < box2.x1 || box2.x2 + buffer < box1.x1 || 
               box1.y2 + buffer < box2.y1 || box2.y2 + buffer < box1.y1);
    },
    
    // Check if a circle overlaps with a box (with buffer for clearance)
    circleBoxOverlap: function(circle, box) {
      // Find closest point on box to circle center
      var closestX = Math.max(box.x1, Math.min(circle.x, box.x2));
      var closestY = Math.max(box.y1, Math.min(circle.y, box.y2));
      
      // Calculate distance from circle center to closest point
      var dx = circle.x - closestX;
      var dy = circle.y - closestY;
      var distance = Math.sqrt(dx * dx + dy * dy);
      
      // Add small buffer for clearance
      return distance < (circle.r + 0.2);
    },
    
    // Calculate repulsion force between two points (C++ implementation)
    repelForce: function(a, b, force_magnitude) {
      var dx = Math.abs(a.x - b.x);
      var dy = Math.abs(a.y - b.y);
      // Constrain the minimum distance, so it is never 0 (matches C++)
      var d2 = Math.max(dx * dx + dy * dy, 0.0004);
      
      // Compute a unit vector in the direction of the force
      var v = {
        x: (a.x - b.x) / Math.sqrt(d2),
        y: (a.y - b.y) / Math.sqrt(d2)
      };
      
      // Divide the force by the squared distance
      var f = {
        x: force_magnitude * v.x / d2,
        y: force_magnitude * v.y / d2
      };
      
      // Enhance force in dominant direction (matches C++)
      if (dx > dy) {
        f.y = f.y * 2;
      } else {
        f.x = f.x * 2;
      }
      
      return f;
    },
    
    // Calculate spring force pulling toward target position (C++ implementation)
    springForce: function(target, current, force_magnitude) {
      var v = {
        x: target.x - current.x,
        y: target.y - current.y
      };
      
      return {
        x: force_magnitude * v.x,
        y: force_magnitude * v.y
      };
    },
    
    // Keep box within boundaries (C++ implementation)
    putWithinBounds: function(box, xbounds, ybounds) {
      var width = Math.abs(box.x1 - box.x2);
      var height = Math.abs(box.y1 - box.y2);
      
      if (box.x1 < xbounds.x) {
        box.x1 = xbounds.x;
        box.x2 = box.x1 + width;
      } else if (box.x2 > xbounds.y) {
        box.x2 = xbounds.y;
        box.x1 = box.x2 - width;
      }
      
      if (box.y1 < ybounds.x) {
        box.y1 = ybounds.x;
        box.y2 = box.y1 + height;
      } else if (box.y2 > ybounds.y) {
        box.y2 = ybounds.y;
        box.y1 = box.y2 - height;
      }
      
      return box;
    },
    
    // Get centroid of a box
    centroid: function(box) {
      return {
        x: (box.x1 + box.x2) / 2,
        y: (box.y1 + box.y2) / 2
      };
    },
    
    // Convert label to bounding box
    labelToBox: function(label) {
      return {
        x1: label.x - label.width / 2,
        y1: label.y - label.height + 0.2,
        x2: label.x + label.width / 2,
        y2: label.y + 0.2
      };
    },
    
    // Convert anchor to circle
    anchorToCircle: function(anchor) {
      return {
        x: anchor.x,
        y: anchor.y,
        r: anchor.r
      };
    },
    
    // Line intersection detection (from C++ implementation)
    lineIntersect: function(p1, q1, p2, q2) {
      // Special cases - degenerate lines
      if ((q1.x === q2.x && q1.y === q2.y) || 
          (p1.x === q1.x && p1.y === q1.y) || 
          (p2.x === q2.x && p2.y === q2.y)) {
        return false;
      }

      var dy1 = q1.y - p1.y;
      var dx1 = q1.x - p1.x;
      var slope1 = dy1 / dx1;
      var intercept1 = q1.y - q1.x * slope1;

      var dy2 = q2.y - p2.y;
      var dx2 = q2.x - p2.x;
      var slope2 = dy2 / dx2;
      var intercept2 = q2.y - q2.x * slope2;

      var x, y;

      // Check if lines are vertical
      var epsilon = 1e-10;
      if (Math.abs(dx1) < epsilon) {
        if (Math.abs(dx2) < epsilon) {
          return false; // Both vertical, parallel
        } else {
          x = p1.x;
          y = slope2 * x + intercept2;
        }
      } else if (Math.abs(dx2) < epsilon) {
        x = p2.x;
        y = slope1 * x + intercept1;
      } else {
        if (Math.abs(slope1 - slope2) < epsilon) {
          return false; // Parallel lines
        }
        x = (intercept2 - intercept1) / (slope1 - slope2);
        y = slope1 * x + intercept1;
      }

      // Check if intersection point is within both line segments
      return (x >= Math.min(p1.x, q1.x) && x <= Math.max(p1.x, q1.x) &&
              y >= Math.min(p1.y, q1.y) && y <= Math.max(p1.y, q1.y) &&
              x >= Math.min(p2.x, q2.x) && x <= Math.max(p2.x, q2.x) &&
              y >= Math.min(p2.y, q2.y) && y <= Math.max(p2.y, q2.y));
    },
    
    // Rescale array to [0,1] range (from C++ implementation)
    rescale: function(v) {
      if (v.length === 0) return v;
      var min_value = Math.min.apply(Math, v);
      var max_value = Math.max.apply(Math, v);
      if (max_value === min_value) return v.map(function() { return 0; });
      
      return v.map(function(val) {
        return (val - min_value) / (max_value - min_value);
      });
    },
    
    // Main physics simulation step (C++ repel_boxes2 implementation)
    simulationStep: function(iter) {
      var n_overlaps = 0;
      var bounds = { x: 1, y: w - 1 }; // x bounds
      var ybounds = { x: 1, y: h - 1 }; // y bounds
      
      // Force decay per iteration (matches C++)
      this.force_push *= this.force_push_decay;
      this.force_pull *= this.force_pull_decay;
      
      // Process each label (text box)
      for (var i = 0; i < lab.length; i++) {
        // Skip labels with too many overlaps (matches C++)
        if (iter >= 2 && this.total_overlaps[i] > this.max_overlaps) {
          this.too_many_overlaps[i] = true;
        }
        if (this.too_many_overlaps[i]) {
          continue;
        }

        // Reset overlaps for next iteration
        this.total_overlaps[i] = 0;
        var i_overlaps = false;
        var force = { x: 0, y: 0 };
        
        var labelBox = this.labelToBox(lab[i]);
        var ci = this.centroid(labelBox); // Current label center
        
        // Check overlaps with data points and other labels
        for (var j = 0; j < anc.length; j++) {
          var anchorCircle = this.anchorToCircle(anc[j]);
          var point = { x: anc[j].x, y: anc[j].y };
          
          if (i === j) {
            // Own data point - skip if no size/padding
            if (anc[i].r === 0) continue;
            
            // Repel from own data point if overlapping
            if (this.circleBoxOverlap(anchorCircle, labelBox)) {
              n_overlaps += 1;
              i_overlaps = true;
              this.total_overlaps[i] += 1;
              var repelForce = this.repelForce(ci, point, anc[i].r * this.force_point_size * this.force_push);
              force.x += repelForce.x;
              force.y += repelForce.y;
            }
          } else if (j < lab.length && this.too_many_overlaps[j]) {
            // Other data point with disabled label - skip if no size
            if (anc[j].r === 0) continue;
            
            // Repel from other data points  
            if (this.circleBoxOverlap(anchorCircle, labelBox)) {
              n_overlaps += 1;
              i_overlaps = true;
              this.total_overlaps[i] += 1;
              var repelForce = this.repelForce(ci, point, anc[j].r * this.force_point_size * this.force_push);
              force.x += repelForce.x;
              force.y += repelForce.y;
            }
          } else {
            // Check label-label overlaps
            if (j < lab.length) {
              var otherBox = this.labelToBox(lab[j]);
              var cj = this.centroid(otherBox);
              
              if (this.boxesOverlap(labelBox, otherBox)) {
                n_overlaps += 1;
                i_overlaps = true;
                this.total_overlaps[i] += 1;
                var repelForce = this.repelForce(ci, cj, this.force_push);
                force.x += repelForce.x;
                force.y += repelForce.y;
              }
            }
            
            // Repel from other data points
            if (anc[j].r > 0 && this.circleBoxOverlap(anchorCircle, labelBox)) {
              n_overlaps += 1;
              i_overlaps = true;
              this.total_overlaps[i] += 1;
              var repelForce = this.repelForce(ci, point, anc[j].r * this.force_point_size * this.force_push);
              force.x += repelForce.x;
              force.y += repelForce.y;
            }
          }
        }
        
        // Pull toward original position if no overlaps (matches C++)
        if (!i_overlaps && i < this.original_positions.length) {
          var springForce = this.springForce(this.original_positions[i], ci, this.force_pull);
          force.x += springForce.x;
          force.y += springForce.y;
        }
        
        // Calculate overlap multiplier (matches C++)
        var overlap_multiplier = 1.0;
        if (this.total_overlaps[i] > 10) {
          overlap_multiplier += 0.5;
        } else {
          overlap_multiplier += 0.05 * this.total_overlaps[i];
        }
        
        // Update velocity with width scaling (matches C++)
        var width_factor = this.text_box_widths[i] + 1e-6;
        this.velocities[i].x = overlap_multiplier * this.velocities[i].x * width_factor * this.velocity_decay + force.x;
        this.velocities[i].y = overlap_multiplier * this.velocities[i].y * width_factor * this.velocity_decay + force.y;
        
        // Update position
        lab[i].x += this.velocities[i].x;
        lab[i].y += this.velocities[i].y;
        
        // Keep within bounds (matches C++)
        var newBox = this.labelToBox(lab[i]);
        newBox = this.putWithinBounds(newBox, bounds, ybounds);
        lab[i].x = (newBox.x1 + newBox.x2) / 2;
        lab[i].y = newBox.y2 - 0.2;
        
        // Check for line intersections (matches C++)
        if (n_overlaps === 0 || iter % 5 === 0) {
          for (var j = 0; j < lab.length; j++) {
            if (i === j || j >= anc.length) continue;
            
            var cj = this.centroid(this.labelToBox(lab[j]));
            var ci_updated = this.centroid(this.labelToBox(lab[i]));
            var point_i = { x: anc[i].x, y: anc[i].y };
            var point_j = { x: anc[j].x, y: anc[j].y };
            
            // Check if leader lines intersect
            if (this.lineIntersect(ci_updated, point_i, cj, point_j)) {
              n_overlaps += 1;
              // Apply spring forces to separate
              var springForceI = this.springForce(cj, ci_updated, 1);
              var springForceJ = this.springForce(ci_updated, cj, 1);
              
              lab[i].x += springForceI.x;
              lab[i].y += springForceI.y;
              lab[j].x += springForceJ.x;
              lab[j].y += springForceJ.y;
              
              // Check if resolved, if not apply stronger force
              ci_updated = this.centroid(this.labelToBox(lab[i]));
              cj = this.centroid(this.labelToBox(lab[j]));
              if (this.lineIntersect(ci_updated, point_i, cj, point_j)) {
                var strongForceI = this.springForce(cj, ci_updated, 1.25);
                var strongForceJ = this.springForce(ci_updated, cj, 1.25);
                lab[i].x += strongForceI.x;
                lab[i].y += strongForceI.y;
                lab[j].x += strongForceJ.x;
                lab[j].y += strongForceJ.y;
              }
            }
          }
        }
      }
      
      return n_overlaps;
    },
    
    // Initialize physics simulation (C++ style)
    initializeSimulation: function() {
      this.velocities = [];
      this.original_positions = [];
      this.total_overlaps = [];
      this.too_many_overlaps = [];
      this.text_box_widths = [];
      
      // Reset random seed for consistent results
      globalSeededRandom.reset();
      
      // Initialize arrays for each label
      for (var i = 0; i < lab.length; i++) {
        this.velocities.push({ x: 0, y: 0 });
        this.original_positions.push({ x: lab[i].x, y: lab[i].y });
        this.total_overlaps.push(0);
        this.too_many_overlaps.push(false);
        this.text_box_widths.push(lab[i].width || 1.0);
      }
      
      // Calculate text box widths and rescale (matches C++)
      this.text_box_widths = this.rescale(this.text_box_widths);
      
      // Add initial jitter (matches C++)
      for (var i = 0; i < lab.length; i++) {
        var jitter = this.force_push;
        lab[i].x += (this.seededRandom() - 0.5) * jitter;
        lab[i].y += (this.seededRandom() - 0.5) * jitter;
      }
      
      // Reset force parameters to initial values
      this.force_push = 1e-6;
      this.force_pull = 1e-6;
    },
    
    // Run complete simulation (C++ repel_boxes2 style)
    runSimulation: function() {
      console.log(`=== STARTING C++ STYLE PHYSICS SIMULATION ===`);
      console.log(`Parameters: force_push=${this.force_push}, force_pull=${this.force_pull}, max_iter=${this.max_iter}, max_time=${this.max_time}s`);
      console.log(`Simulation area: ${w.toFixed(1)} x ${h.toFixed(1)}, Label density: ${(lab.length / (w * h)).toFixed(3)} labels/unit²`);
      
      this.initializeSimulation();
      
      var start_time = Date.now();
      var max_time_ms = this.max_time * 1000; // Convert to milliseconds
      var iter = 0;
      var n_overlaps = 1;
      var p_overlaps = 1;
      
      while (n_overlaps && iter < this.max_iter) {
        iter += 1;
        p_overlaps = n_overlaps;
        n_overlaps = this.simulationStep(iter);
        
        // Check time limit every 10 iterations (matches C++)
        if (iter % 10 === 0) {
          var elapsed_time = Date.now() - start_time;
          if (elapsed_time > max_time_ms) {
            console.log(`Time limit reached after ${iter} iterations`);
            break;
          }
        }
        
        // Progress logging every 200 iterations
        if (iter % 200 === 0) {
          var elapsed_time = Date.now() - start_time;
          console.log(`Iter ${iter}: ${n_overlaps} overlaps, forces=${this.force_push.toExponential(1)}/${this.force_pull.toExponential(1)}, time=${(elapsed_time/1000).toFixed(2)}s`);
        }
      }
      
      var elapsed_time = Date.now() - start_time;
      
      // Final status message (matches C++)
      if (elapsed_time > max_time_ms) {
        console.log(`ggrepel: ${(max_time_ms/1000).toFixed(1)}s elapsed for ${iter} iterations, ${p_overlaps} overlaps. Consider increasing 'max.time'.`);
      } else if (iter >= this.max_iter) {
        console.log(`ggrepel: ${this.max_iter} iterations in ${(elapsed_time/1000).toFixed(3)}s, ${p_overlaps} overlaps. Consider increasing 'max.iter'.`);
      } else {
        console.log(`ggrepel: text repel complete in ${iter} iterations (${(elapsed_time/1000).toFixed(3)}s), ${p_overlaps} overlaps`);
      }
      
      return n_overlaps === 0;
    },
    
    // Detailed diagnostics for optimization
    printDetailedDiagnostics: function() {
      console.log(`=== DETAILED DIAGNOSTICS ===`);
      
      // Analyze label distribution
      var label_positions = [];
      var anchor_positions = [];
      var distances = [];
      
      for (var i = 0; i < lab.length; i++) {
        label_positions.push({x: lab[i].x, y: lab[i].y, width: lab[i].width, height: lab[i].height});
        if (i < anc.length) {
          anchor_positions.push({x: anc[i].x, y: anc[i].y, r: anc[i].r});
          var dx = lab[i].x - anc[i].x;
          var dy = lab[i].y - anc[i].y;
          distances.push(Math.sqrt(dx * dx + dy * dy));
        }
      }
      
      // Distance statistics
      var avg_distance = distances.reduce((a, b) => a + b, 0) / distances.length;
      var min_distance = Math.min(...distances);
      var max_distance = Math.max(...distances);
      console.log(`Leader distances: avg=${avg_distance.toFixed(2)}, min=${min_distance.toFixed(2)}, max=${max_distance.toFixed(2)}`);
      
      // Overlap analysis with area calculations
      var label_overlap_count = 0;
      var point_overlap_count = 0;
      var boundary_violations = 0;
      var overlap_details = [];
      var total_label_overlap_area = 0;
      var total_point_overlap_area = 0;
      var total_boundary_violation_area = 0;
      
      for (var i = 0; i < lab.length; i++) {
        var labelBox = this.labelToBox(lab[i]);
        var labelArea = (labelBox.x2 - labelBox.x1) * (labelBox.y2 - labelBox.y1);
        
        // Check boundary violations with area calculation
        var violation_area = 0;
        if (labelBox.x1 < 1 || labelBox.x2 > w - 1 || labelBox.y1 < 1 || labelBox.y2 > h - 1) {
          boundary_violations++;
          // Calculate how much of the label is outside bounds
          var bounds_x1 = Math.max(labelBox.x1, 1);
          var bounds_y1 = Math.max(labelBox.y1, 1);
          var bounds_x2 = Math.min(labelBox.x2, w - 1);
          var bounds_y2 = Math.min(labelBox.y2, h - 1);
          var inside_area = Math.max(0, (bounds_x2 - bounds_x1) * (bounds_y2 - bounds_y1));
          violation_area = labelArea - inside_area;
          total_boundary_violation_area += violation_area;
        }
        
        // Check label-label overlaps with area calculation
        for (var j = i + 1; j < lab.length; j++) {
          var otherBox = this.labelToBox(lab[j]);
          if (this.boxesOverlap(labelBox, otherBox)) {
            label_overlap_count++;
            
            // Calculate actual overlap area
            var overlap_x = Math.max(0, Math.min(labelBox.x2, otherBox.x2) - Math.max(labelBox.x1, otherBox.x1));
            var overlap_y = Math.max(0, Math.min(labelBox.y2, otherBox.y2) - Math.max(labelBox.y1, otherBox.y1));
            var overlap_area = overlap_x * overlap_y;
            total_label_overlap_area += overlap_area;
            
            var overlap_percent = ((overlap_area / Math.min(labelArea, (otherBox.x2 - otherBox.x1) * (otherBox.y2 - otherBox.y1))) * 100).toFixed(1);
            overlap_details.push(`Labels ${i}-${j}: "${lab[i].name}" vs "${lab[j].name}" (${overlap_area.toFixed(2)} area, ${overlap_percent}% of smaller label)`);
          }
        }
        
        // Check point overlaps with area calculation
        for (var j = 0; j < anc.length; j++) {
          var anchorCircle = this.anchorToCircle(anc[j]);
          if (this.circleBoxOverlap(anchorCircle, labelBox)) {
            point_overlap_count++;
            
            // Calculate approximate overlap area between circle and rectangle
            var circle_area = Math.PI * anchorCircle.r * anchorCircle.r;
            
            // Simple approximation: find intersection of circle bounding box with label box
            var circle_box = {
              x1: anchorCircle.x - anchorCircle.r,
              y1: anchorCircle.y - anchorCircle.r,
              x2: anchorCircle.x + anchorCircle.r,
              y2: anchorCircle.y + anchorCircle.r
            };
            
            var overlap_x = Math.max(0, Math.min(labelBox.x2, circle_box.x2) - Math.max(labelBox.x1, circle_box.x1));
            var overlap_y = Math.max(0, Math.min(labelBox.y2, circle_box.y2) - Math.max(labelBox.y1, circle_box.y1));
            var approx_overlap_area = overlap_x * overlap_y;
            
            // Scale by circle fill ratio (rough approximation)
            var actual_overlap_area = approx_overlap_area * 0.785; // π/4 ≈ 0.785 for circle vs square
            total_point_overlap_area += actual_overlap_area;
          }
        }
      }
      
      // Calculate percentages of total label area that's obscured
      var label_areas = lab.map(l => l.width * l.height);
      var total_label_area = label_areas.reduce((a, b) => a + b, 0);
      var plot_area = w * h;
      var area_ratio = total_label_area / plot_area;
      
      var label_overlap_percentage = total_label_area > 0 ? (total_label_overlap_area / total_label_area * 100) : 0;
      var point_overlap_percentage = total_label_area > 0 ? (total_point_overlap_area / total_label_area * 100) : 0;
      var boundary_violation_percentage = total_label_area > 0 ? (total_boundary_violation_area / total_label_area * 100) : 0;
      var total_obscured_percentage = label_overlap_percentage + point_overlap_percentage + boundary_violation_percentage;
      
      console.log(`=== OVERLAP AREA ANALYSIS ===`);
      console.log(`Label-label overlaps: ${total_label_overlap_area.toFixed(2)} area (${label_overlap_percentage.toFixed(1)}% of total label area) [${label_overlap_count} instances]`);
      console.log(`Label-point overlaps: ${total_point_overlap_area.toFixed(2)} area (${point_overlap_percentage.toFixed(1)}% of total label area) [${point_overlap_count} instances]`);
      console.log(`Boundary violations: ${total_boundary_violation_area.toFixed(2)} area (${boundary_violation_percentage.toFixed(1)}% of total label area) [${boundary_violations} instances]`);
      console.log(`TOTAL OBSCURED: ${total_obscured_percentage.toFixed(1)}% of label text is unreadable`);
      console.log(`Area analysis: total_label_area=${total_label_area.toFixed(1)}, plot_area=${plot_area.toFixed(1)}, density=${area_ratio.toFixed(3)}`);
      
      // Show specific overlapping pairs with area details (limit to first 3 for space)
      if (overlap_details.length > 0) {
        console.log(`Worst overlaps (first 3):`);
        for (var i = 0; i < Math.min(3, overlap_details.length); i++) {
          console.log(`  ${overlap_details[i]}`);
        }
      }
      
      if (area_ratio > 0.3) {
        console.log(`WARNING: High label density (${(area_ratio*100).toFixed(1)}%) may prevent convergence`);
      }
      
      // Suggest optimizations
      if (point_overlap_count > label_overlap_count) {
        console.log(`SUGGESTION: Increase force_point_size (currently ${this.force_point_size}) to better repel from data points`);
      }
      if (boundary_violations > 0) {
        console.log(`SUGGESTION: Labels hitting boundaries - consider increasing plot margins or reducing label sizes`);
      }
      if (label_overlap_count > 0 && avg_distance < 2.0) {
        console.log(`SUGGESTION: Increase force_push to create more separation between labels`);
      }
      
      console.log(`=== END DIAGNOSTICS ===`);
    }
  };

  // Simulated annealing algorithm implementation (based on annealing.js)
  var annealing = {
    max_move: 5.0,
    max_angle: 0.5,
    acc: 0,
    rej: 0,
    
    // weights for energy function
    w_len: 0.2,        // leader line length 
    w_inter: 1.0,      // leader line intersection
    w_lab2: 30.0,      // label-label overlap
    w_lab_anc: 30.0,   // label-anchor overlap
    w_orient: 3.0,     // orientation bias
    
    // Energy function for label placement
    energy: function(index) {
      var m = lab.length, 
          ener = 0,
          dx = lab[index].x - anc[index].x,
          dy = anc[index].y - lab[index].y,
          dist = Math.sqrt(dx * dx + dy * dy),
          overlap = true,
          amount = 0,
          theta = 0;

      // penalty for length of leader line
      if (dist > 0) ener += dist * this.w_len;

      // label orientation bias
      dx /= dist;
      dy /= dist;
      if (dx > 0 && dy > 0) { ener += 0 * this.w_orient; }
      else if (dx < 0 && dy > 0) { ener += 1 * this.w_orient; }
      else if (dx < 0 && dy < 0) { ener += 2 * this.w_orient; }
      else { ener += 3 * this.w_orient; }

      var x21 = lab[index].x,
          y21 = lab[index].y - lab[index].height + 2.0,
          x22 = lab[index].x + lab[index].width,
          y22 = lab[index].y + 2.0;
      var x11, x12, y11, y12, x_overlap, y_overlap, overlap_area;

      for (var i = 0; i < m; i++) {
        if (i != index) {
          // penalty for intersection of leader lines
          overlap = this.intersect(anc[index].x, lab[index].x, anc[i].x, lab[i].x,
                          anc[index].y, lab[index].y, anc[i].y, lab[i].y);
          if (overlap) ener += this.w_inter;

          // penalty for label-label overlap
          x11 = lab[i].x;
          y11 = lab[i].y - lab[i].height + 2.0;
          x12 = lab[i].x + lab[i].width;
          y12 = lab[i].y + 2.0;
          x_overlap = Math.max(0, Math.min(x12,x22) - Math.max(x11,x21));
          y_overlap = Math.max(0, Math.min(y12,y22) - Math.max(y11,y21));
          overlap_area = x_overlap * y_overlap;
          ener += (overlap_area * this.w_lab2);
        }

        // penalty for label-anchor overlap
        x11 = anc[i].x - anc[i].r;
        y11 = anc[i].y - anc[i].r;
        x12 = anc[i].x + anc[i].r;
        y12 = anc[i].y + anc[i].r;
        x_overlap = Math.max(0, Math.min(x12,x22) - Math.max(x11,x21));
        y_overlap = Math.max(0, Math.min(y12,y22) - Math.max(y11,y21));
        overlap_area = x_overlap * y_overlap;
        ener += (overlap_area * this.w_lab_anc);
      }
      return ener;
    },

    // Monte Carlo translation move
    mcmove: function(currT) {
      // select a random label
      var i = Math.floor(globalSeededRandom.random() * lab.length); 

      // save old coordinates
      var x_old = lab[i].x;
      var y_old = lab[i].y;

      // old energy
      var old_energy = this.energy(i);

      // random translation
      lab[i].x += (globalSeededRandom.random() - 0.5) * this.max_move;
      lab[i].y += (globalSeededRandom.random() - 0.5) * this.max_move;

      // hard wall boundaries
      if (lab[i].x > w) lab[i].x = x_old;
      if (lab[i].x < 0) lab[i].x = x_old;
      if (lab[i].y > h) lab[i].y = y_old;
      if (lab[i].y < 0) lab[i].y = y_old;

      // new energy
      var new_energy = this.energy(i);

      // delta E
      var delta_energy = new_energy - old_energy;

      if (globalSeededRandom.random() < Math.exp(-delta_energy / currT)) {
        this.acc += 1;
      } else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        this.rej += 1;
      }
    },

    // Monte Carlo rotation move
    mcrotate: function(currT) {
      // select a random label
      var i = Math.floor(globalSeededRandom.random() * lab.length); 

      // save old coordinates
      var x_old = lab[i].x;
      var y_old = lab[i].y;

      // old energy
      var old_energy = this.energy(i);

      // random angle
      var angle = (globalSeededRandom.random() - 0.5) * this.max_angle;

      var s = Math.sin(angle);
      var c = Math.cos(angle);

      // translate label (relative to anchor at origin):
      lab[i].x -= anc[i].x;
      lab[i].y -= anc[i].y;

      // rotate label
      var x_new = lab[i].x * c - lab[i].y * s,
          y_new = lab[i].x * s + lab[i].y * c;

      // translate label back
      lab[i].x = x_new + anc[i].x;
      lab[i].y = y_new + anc[i].y;

      // hard wall boundaries
      if (lab[i].x > w) lab[i].x = x_old;
      if (lab[i].x < 0) lab[i].x = x_old;
      if (lab[i].y > h) lab[i].y = y_old;
      if (lab[i].y < 0) lab[i].y = y_old;

      // new energy
      var new_energy = this.energy(i);

      // delta E
      var delta_energy = new_energy - old_energy;

      if (globalSeededRandom.random() < Math.exp(-delta_energy / currT)) {
        this.acc += 1;
      } else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        this.rej += 1;
      }
    },

    // Line intersection test
    intersect: function(x1, x2, x3, x4, y1, y2, y3, y4) {
      // returns true if two lines intersect, else false
      // from http://paulbourke.net/geometry/lineline2d/
      var mua, mub;
      var denom, numera, numerb;

      denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
      numera = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
      numerb = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);

      /* Is the intersection along the the segments */
      mua = numera / denom;
      mub = numerb / denom;
      if (!(mua < 0 || mua > 1 || mub < 0 || mub > 1)) {
          return true;
      }
      return false;
    },

    // Linear cooling schedule
    cooling_schedule: function(currT, initialT, nsweeps) {
      return (currT - (initialT / nsweeps));
    },

    // Main simulated annealing function
    runSimulation: function(nsweeps) {
      console.log(`=== STARTING SIMULATED ANNEALING OPTIMIZATION ===`);
      console.log(`Parameters: nsweeps=${nsweeps}, max_move=${this.max_move}, max_angle=${this.max_angle}`);
      console.log(`Energy weights: w_len=${this.w_len}, w_inter=${this.w_inter}, w_lab2=${this.w_lab2}, w_lab_anc=${this.w_lab_anc}, w_orient=${this.w_orient}`);
      
      var m = lab.length,
          currT = 1.0,
          initialT = 1.0;

      this.acc = 0;
      this.rej = 0;
      
      var start_time = Date.now();

      for (var i = 0; i < nsweeps; i++) {
        for (var j = 0; j < m; j++) { 
          if (globalSeededRandom.random() < 0.5) { 
            this.mcmove(currT); 
          } else { 
            this.mcrotate(currT); 
          }
        }
        currT = this.cooling_schedule(currT, initialT, nsweeps);
        
        // Progress logging every 100 sweeps
        if (i % 100 === 0 && i > 0) {
          var elapsed_time = Date.now() - start_time;
          var acceptance_rate = (this.acc / (this.acc + this.rej) * 100).toFixed(1);
          console.log(`Sweep ${i}: T=${currT.toFixed(4)}, acceptance=${acceptance_rate}%, time=${(elapsed_time/1000).toFixed(2)}s`);
        }
      }
      
      var elapsed_time = Date.now() - start_time;
      var acceptance_rate = (this.acc / (this.acc + this.rej) * 100).toFixed(1);
      console.log(`Annealing complete: ${nsweeps} sweeps in ${(elapsed_time/1000).toFixed(3)}s, final acceptance rate: ${acceptance_rate}%`);
      console.log(`=== END SIMULATED ANNEALING ===`);
      
      return true;
    }
  };

  // Legacy exploration optimizer (keeping for fallback/comparison)
  var explorationOptimizer = {
    temperature: 10.0, // Simulated annealing temperature
    coolingRate: 0.95,
    explorationPhase: 0, // 0=aggressive, 1=moderate, 2=fine-tuning
    
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
      score += lineLength * 0.1; // Reduced penalty to allow longer leader lines
      
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
    
    // Multi-strategy optimization with different exploration techniques
    optimizeLabel: function(labelIndex) {
      var strategies = [
        this.gridSearchOptimize.bind(this),
        this.simulatedAnnealingOptimize.bind(this),
        this.directedSearchOptimize.bind(this),
        this.repulsionBasedOptimize.bind(this)
      ];
      
      var bestScore = Infinity;
      var bestX = lab[labelIndex].x;
      var bestY = lab[labelIndex].y;
      var originalScore = this.calculateScore(labelIndex, bestX, bestY);
      
      // Try different strategies based on exploration phase
      var strategiesToTry = this.explorationPhase === 0 ? strategies : [strategies[0], strategies[1]];
      
      for (var s = 0; s < strategiesToTry.length; s++) {
        var result = strategiesToTry[s](labelIndex);
        if (result.score < bestScore) {
          bestScore = result.score;
          bestX = result.x;
          bestY = result.y;
        }
      }
      
      // Only update if we found improvement
      if (bestScore < originalScore) {
        lab[labelIndex].x = bestX;
        lab[labelIndex].y = bestY;
        return bestScore;
      }
      
      return originalScore;
    },
    
    // Traditional grid search (baseline)
    gridSearchOptimize: function(labelIndex) {
      var bestScore = Infinity;
      var bestX = lab[labelIndex].x;
      var bestY = lab[labelIndex].y;
      
      var anchor = anc[labelIndex];
      var searchRadius = this.explorationPhase === 0 ? 12.0 : 8.0; // Adaptive search radius
      var stepSize = this.explorationPhase === 2 ? 0.1 : 0.2;
      
      // Grid search around the anchor point
      for (var dx = -searchRadius; dx <= searchRadius; dx += stepSize) {
        for (var dy = -searchRadius; dy <= searchRadius; dy += stepSize) {
          var testX = anchor.x + dx;
          var testY = anchor.y + dy;
          
          if (!this.isValidPosition(labelIndex, testX, testY)) continue;
          
          var score = this.calculateScore(labelIndex, testX, testY);
          
          if (score < bestScore) {
            bestScore = score;
            bestX = testX;
            bestY = testY;
          }
        }
      }
      
      return {x: bestX, y: bestY, score: bestScore};
    },
    
    // Simulated annealing for escaping local minima
    simulatedAnnealingOptimize: function(labelIndex) {
      var currentX = lab[labelIndex].x;
      var currentY = lab[labelIndex].y;
      var currentScore = this.calculateScore(labelIndex, currentX, currentY);
      
      var bestX = currentX;
      var bestY = currentY;
      var bestScore = currentScore;
      
      var maxIterations = this.explorationPhase === 0 ? 200 : 50;
      var maxStep = this.explorationPhase === 0 ? 5.0 : 2.0;
      
      for (var iter = 0; iter < maxIterations; iter++) {
        // Random move
        var stepX = (Math.random() - 0.5) * maxStep;
        var stepY = (Math.random() - 0.5) * maxStep;
        var testX = currentX + stepX;
        var testY = currentY + stepY;
        
        if (!this.isValidPosition(labelIndex, testX, testY)) continue;
        
        var testScore = this.calculateScore(labelIndex, testX, testY);
        
        // Accept if better or with probability based on temperature
        var deltaE = testScore - currentScore;
        var probability = deltaE <= 0 ? 1.0 : Math.exp(-deltaE / this.temperature);
        
        if (Math.random() < probability) {
          currentX = testX;
          currentY = testY;
          currentScore = testScore;
          
          if (testScore < bestScore) {
            bestX = testX;
            bestY = testY;
            bestScore = testScore;
          }
        }
      }
      
      // Cool down temperature
      this.temperature *= this.coolingRate;
      
      return {x: bestX, y: bestY, score: bestScore};
    },
    
    // Directed search towards low-density areas
    directedSearchOptimize: function(labelIndex) {
      var bestScore = Infinity;
      var bestX = lab[labelIndex].x;
      var bestY = lab[labelIndex].y;
      
      var anchor = anc[labelIndex];
      
      // Find directions away from other labels
      var repulsionDirections = [];
      for (var i = 0; i < lab.length; i++) {
        if (i === labelIndex) continue;
        
        var dx = anchor.x - lab[i].x;
        var dy = anchor.y - lab[i].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          repulsionDirections.push({
            x: dx / dist,
            y: dy / dist,
            strength: 1.0 / (dist + 1.0)
          });
        }
      }
      
      // Sample positions in promising directions
      var numSamples = 50;
      var maxDistance = 10.0;
      
      for (var sample = 0; sample < numSamples; sample++) {
        var direction = {x: 0, y: 0};
        
        // Weight by repulsion directions
        for (var r = 0; r < repulsionDirections.length; r++) {
          var rep = repulsionDirections[r];
          direction.x += rep.x * rep.strength;
          direction.y += rep.y * rep.strength;
        }
        
        // Normalize and add some randomness
        var dirLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (dirLength > 0) {
          direction.x /= dirLength;
          direction.y /= dirLength;
        } else {
          direction.x = Math.random() - 0.5;
          direction.y = Math.random() - 0.5;
        }
        
        // Add randomness
        var randomAngle = (Math.random() - 0.5) * Math.PI / 2; // ±45 degrees
        var cosA = Math.cos(randomAngle);
        var sinA = Math.sin(randomAngle);
        var newDirX = direction.x * cosA - direction.y * sinA;
        var newDirY = direction.x * sinA + direction.y * cosA;
        
        var distance = Math.random() * maxDistance;
        var testX = anchor.x + newDirX * distance;
        var testY = anchor.y + newDirY * distance;
        
        if (!this.isValidPosition(labelIndex, testX, testY)) continue;
        
        var score = this.calculateScore(labelIndex, testX, testY);
        
        if (score < bestScore) {
          bestScore = score;
          bestX = testX;
          bestY = testY;
        }
      }
      
      return {x: bestX, y: bestY, score: bestScore};
    },
    
    // Repulsion-based optimization to spread labels apart
    repulsionBasedOptimize: function(labelIndex) {
      var bestScore = Infinity;
      var bestX = lab[labelIndex].x;
      var bestY = lab[labelIndex].y;
      
      // Calculate repulsion forces from other labels and anchors
      var forceX = 0, forceY = 0;
      var anchor = anc[labelIndex];
      
      // Repulsion from other labels
      for (var i = 0; i < lab.length; i++) {
        if (i === labelIndex) continue;
        
        var dx = lab[labelIndex].x - lab[i].x;
        var dy = lab[labelIndex].y - lab[i].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0 && dist < 8.0) { // Only nearby labels
          var force = 10.0 / (dist * dist);
          forceX += (dx / dist) * force;
          forceY += (dy / dist) * force;
        }
      }
      
      // Repulsion from anchor points
      for (var i = 0; i < anc.length; i++) {
        var dx = lab[labelIndex].x - anc[i].x;
        var dy = lab[labelIndex].y - anc[i].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        var minDist = anc[i].r + 1.5;
        if (dist > 0 && dist < minDist) {
          var force = 5.0 / (dist * dist);
          forceX += (dx / dist) * force;
          forceY += (dy / dist) * force;
        }
      }
      
      // Try positions along the force direction
      var forceLength = Math.sqrt(forceX * forceX + forceY * forceY);
      if (forceLength > 0) {
        forceX /= forceLength;
        forceY /= forceLength;
        
        for (var step = 0.5; step <= 8.0; step += 0.5) {
          var testX = lab[labelIndex].x + forceX * step;
          var testY = lab[labelIndex].y + forceY * step;
          
          if (!this.isValidPosition(labelIndex, testX, testY)) continue;
          
          var score = this.calculateScore(labelIndex, testX, testY);
          
          if (score < bestScore) {
            bestScore = score;
            bestX = testX;
            bestY = testY;
          }
        }
      }
      
      return {x: bestX, y: bestY, score: bestScore};
    },
    
    // Check if position is valid (within boundaries)
    isValidPosition: function(labelIndex, testX, testY) {
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
      
      return !(x1 < margin || x2 > w - margin || y1 < margin || y2 > h - margin);
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

  // Multi-phase optimization step with different exploration strategies
  var explorationStep = function(phaseType) {
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
    
    // Set exploration phase
    explorationOptimizer.explorationPhase = phaseType;
    
    // For aggressive exploration, also reset temperature periodically
    if (phaseType === 0) {
      explorationOptimizer.temperature = Math.max(explorationOptimizer.temperature, 5.0);
    }
    
    // Optimize each label
    for (var i = 0; i < labelOrder.length; i++) {
      var labelIndex = labelOrder[i];
      var oldScore = explorationOptimizer.calculateScore(labelIndex, lab[labelIndex].x, lab[labelIndex].y);
      var newScore = explorationOptimizer.optimizeLabel(labelIndex);
      
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
  
  // Multi-start optimization - try different initial configurations
  var multiStartOptimization = function() {
    var m = lab.length;
    if (m === 0) return;
    
    var bestConfiguration = [];
    var bestTotalScore = Infinity;
    
    // Store original positions
    var originalPositions = [];
    for (var i = 0; i < m; i++) {
      originalPositions.push({x: lab[i].x, y: lab[i].y});
    }
    
    var numRestarts = 3; // Try 3 different starting configurations
    
    for (var restart = 0; restart < numRestarts; restart++) {
      console.log(`=== MULTI-START ATTEMPT ${restart + 1}/${numRestarts} ===`);
      
      // Re-initialize labels with different strategy
      for (var i = 0; i < m; i++) {
        var anchor = anc[i];
        
        if (restart === 0) {
          // Random spread initialization
          var angle = Math.random() * 2 * Math.PI;
          var distance = 2.0 + Math.random() * 6.0;
          lab[i].x = anchor.x + Math.cos(angle) * distance;
          lab[i].y = anchor.y + Math.sin(angle) * distance;
        } else if (restart === 1) {
          // Grid-based initialization
          var gridSize = Math.ceil(Math.sqrt(m));
          var cellW = w / gridSize;
          var cellH = h / gridSize;
          var gridX = (i % gridSize) * cellW + cellW / 2;
          var gridY = Math.floor(i / gridSize) * cellH + cellH / 2;
          lab[i].x = gridX;
          lab[i].y = gridY;
        } else {
          // Repulsion-based initialization
          var maxAttempts = 50;
          var bestPos = {x: anchor.x, y: anchor.y};
          var bestDist = 0;
          
          for (var attempt = 0; attempt < maxAttempts; attempt++) {
            var angle = Math.random() * 2 * Math.PI;
            var distance = 2.0 + Math.random() * 8.0;
            var testX = anchor.x + Math.cos(angle) * distance;
            var testY = anchor.y + Math.sin(angle) * distance;
            
            if (!explorationOptimizer.isValidPosition(i, testX, testY)) continue;
            
            // Find minimum distance to other labels
            var minDist = Infinity;
            for (var j = 0; j < i; j++) {
              var dx = testX - lab[j].x;
              var dy = testY - lab[j].y;
              var dist = Math.sqrt(dx * dx + dy * dy);
              minDist = Math.min(minDist, dist);
            }
            
            if (minDist > bestDist) {
              bestDist = minDist;
              bestPos.x = testX;
              bestPos.y = testY;
            }
          }
          
          lab[i].x = bestPos.x;
          lab[i].y = bestPos.y;
        }
        
        // Ensure valid position
        if (!explorationOptimizer.isValidPosition(i, lab[i].x, lab[i].y)) {
          // Fallback to safe position
          lab[i].x = anc[i].x + 2.0;
          lab[i].y = anc[i].y + 2.0;
        }
      }
      
      // Run optimization on this configuration
      var localBestScore = runOptimizationPhases();
      
      // Check if this is the best configuration so far
      if (localBestScore < bestTotalScore) {
        bestTotalScore = localBestScore;
        bestConfiguration = [];
        for (var i = 0; i < m; i++) {
          bestConfiguration.push({x: lab[i].x, y: lab[i].y});
        }
      }
    }
    
    // Apply best configuration
    for (var i = 0; i < m; i++) {
      lab[i].x = bestConfiguration[i].x;
      lab[i].y = bestConfiguration[i].y;
    }
    
    console.log(`=== BEST CONFIGURATION SELECTED (Score: ${bestTotalScore.toFixed(1)}) ===`);
    
    // Final post-processing: resolve remaining point overlaps
    resolvePointOverlaps();
    
    return bestTotalScore;
  };
  
  // Final post-processing to specifically resolve point overlaps
  var resolvePointOverlaps = function() {
    console.log(`=== POST-PROCESSING: RESOLVING POINT OVERLAPS ===`);
    var resolved = 0;
    
    for (var i = 0; i < lab.length; i++) {
      for (var j = 0; j < anc.length; j++) {
        var dx = lab[i].x - anc[j].x;
        var dy = lab[i].y - anc[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minDist = anc[j].r + 1.3; // Slightly larger clearance
        
        if (dist < minDist) {
          // Push label away from point along the line from point to label
          var pushDistance = minDist - dist + 0.5; // Add extra buffer
          if (dist > 0) {
            var pushX = (dx / dist) * pushDistance;
            var pushY = (dy / dist) * pushDistance;
            
            var newX = lab[i].x + pushX;
            var newY = lab[i].y + pushY;
            
            // Verify the new position is valid
            if (explorationOptimizer.isValidPosition(i, newX, newY)) {
              // Check if this doesn't create worse overlaps
              var oldScore = explorationOptimizer.calculateScore(i, lab[i].x, lab[i].y);
              var newScore = explorationOptimizer.calculateScore(i, newX, newY);
              
              if (newScore <= oldScore * 1.5) { // Allow slight score increase to resolve overlap
                lab[i].x = newX;
                lab[i].y = newY;
                resolved++;
                console.log(`Resolved point overlap for label ${i}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`Post-processing resolved ${resolved} point overlaps`);
  };
  
  // Run multi-phase optimization
  var runOptimizationPhases = function() {
    var totalImprovements = 0;
    
    // Phase 1: Aggressive exploration (escape local minima)
    console.log(`=== PHASE 1: AGGRESSIVE EXPLORATION ===`);
    explorationOptimizer.temperature = 15.0; // Reset temperature
    var phase1Improvements = 0;
    
    for (var iter = 0; iter < 30; iter++) {
      var improved = explorationStep(0); // Aggressive exploration
      if (improved) phase1Improvements++;
      
      // Early termination if no improvements
      if (iter > 15 && phase1Improvements === 0) break;
    }
    totalImprovements += phase1Improvements;
    console.log(`Phase 1 complete: ${phase1Improvements} improvements`);
    
    // Phase 2: Moderate exploration (balance exploration and exploitation)
    console.log(`=== PHASE 2: MODERATE EXPLORATION ===`);
    var phase2Improvements = 0;
    
    for (var iter = 0; iter < 20; iter++) {
      var improved = explorationStep(1); // Moderate exploration
      if (improved) phase2Improvements++;
      
      if (iter > 10 && phase2Improvements === 0) break;
    }
    totalImprovements += phase2Improvements;
    console.log(`Phase 2 complete: ${phase2Improvements} improvements`);
    
    // Phase 3: Fine-tuning (local optimization)
    console.log(`=== PHASE 3: FINE-TUNING ===`);
    var phase3Improvements = 0;
    
    for (var iter = 0; iter < 15; iter++) {
      var improved = explorationStep(2); // Fine-tuning
      if (improved) phase3Improvements++;
      
      if (iter > 8 && phase3Improvements === 0) break;
    }
    totalImprovements += phase3Improvements;
    console.log(`Phase 3 complete: ${phase3Improvements} improvements`);
    
    // Calculate total score
    var totalScore = 0;
    for (var i = 0; i < lab.length; i++) {
      totalScore += explorationOptimizer.calculateScore(i, lab[i].x, lab[i].y);
    }
    
    console.log(`=== OPTIMIZATION COMPLETE: ${totalImprovements} total improvements ===`);
    return totalScore;
  };

  // Utility functions removed - no longer needed for force-directed approach

  labelerObj.start = function(iterations) {
    var m = lab.length;
    if (m === 0) return;

    console.log(`=== STARTING LABEL OPTIMIZATION: ${m} labels using ${algorithm.toUpperCase()} algorithm ===`);
    console.log(`Boundary constraints: width=${w.toFixed(2)}, height=${h.toFixed(2)}`);

    // Add small random jitter to initial positions to break symmetries (using seeded random)
    for (var i = 0; i < m; i++) {
      var jitter = 0.1;
      lab[i].x += (globalSeededRandom.random() - 0.5) * jitter;
      lab[i].y += (globalSeededRandom.random() - 0.5) * jitter;
    }

    var success;
    
    if (algorithm === 'annealing') {
      // Run simulated annealing optimization
      success = annealing.runSimulation(iterations || 1000);
    } else {
      // Run ggrepel-style physics simulation (default)
      success = physics.runSimulation();
    }
    
    // Calculate final statistics (common for both algorithms)
    var totalLineLength = 0;
    var labelOverlaps = 0;
    var pointOverlaps = 0;
    var totalOverlapArea = 0;
    
    for (var i = 0; i < m; i++) {
      var dx = lab[i].x - anc[i].x;
      var dy = lab[i].y - anc[i].y;
      totalLineLength += Math.sqrt(dx * dx + dy * dy);
      
      // Calculate label-label overlaps
      var x1 = lab[i].x - lab[i].width / 2;
      var y1 = lab[i].y - lab[i].height + 0.2;
      var x2 = lab[i].x + lab[i].width / 2;
      var y2 = lab[i].y + 0.2;
      
      for (var j = i + 1; j < m; j++) {
        var ox1 = lab[j].x - lab[j].width / 2;
        var oy1 = lab[j].y - lab[j].height + 0.2;
        var ox2 = lab[j].x + lab[j].width / 2;
        var oy2 = lab[j].y + 0.2;
        
        var overlap_x = Math.max(0, Math.min(x2, ox2) - Math.max(x1, ox1));
        var overlap_y = Math.max(0, Math.min(y2, oy2) - Math.max(y1, oy1));
        
        if (overlap_x > 0 && overlap_y > 0) {
          labelOverlaps++;
          totalOverlapArea += overlap_x * overlap_y;
        }
      }
      
      // Calculate point overlaps
      for (var j = 0; j < anc.length; j++) {
        var anchorLeft = anc[j].x - anc[j].r;
        var anchorTop = anc[j].y - anc[j].r;
        var anchorRight = anc[j].x + anc[j].r;
        var anchorBottom = anc[j].y + anc[j].r;
        
        var overlap_x = Math.max(0, Math.min(x2, anchorRight) - Math.max(x1, anchorLeft));
        var overlap_y = Math.max(0, Math.min(y2, anchorBottom) - Math.max(y1, anchorTop));
        
        if (overlap_x > 0 && overlap_y > 0) {
          pointOverlaps++;
        }
      }
    }
    
    // Calculate total label area for percentage
    var totalLabelArea = 0;
    for (var i = 0; i < m; i++) {
      totalLabelArea += lab[i].width * lab[i].height;
    }
    var overlapPercentage = totalLabelArea > 0 ? (totalOverlapArea / totalLabelArea * 100) : 0;
    
    console.log(`Results: Avg leader length: ${(totalLineLength / m).toFixed(1)}px, Label overlaps: ${labelOverlaps} (${totalOverlapArea.toFixed(2)} area, ${overlapPercentage.toFixed(1)}% obscured), Point overlaps: ${pointOverlaps}`);
    console.log(`Optimization ${success ? 'COMPLETED' : 'INCOMPLETE'}`);
    console.log(`=== END ${algorithm.toUpperCase()} OPTIMIZATION ===`);
    
    return labelerObj;
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

  labelerObj.algorithm = function(x) {
  // users set optimization algorithm: 'physics' or 'annealing'
    if (!arguments.length) return algorithm;
    algorithm = x;
    return labelerObj;
  };

  // Alternative energy and schedule functions removed - not needed for force-directed approach

  return labelerObj;
};

// Simplified auto-labeling function specifically for Cambridge schools plots
export function addSchoolLabels(plotElement, data, xField, yField, textField, d3, options = {}) {
  // Extract options with defaults
  const algorithm = options.algorithm || 'physics'; // 'physics' or 'annealing'
  const iterations = options.iterations || (algorithm === 'annealing' ? 1000 : 100);
  const showDebugBoxes = options.showDebugBoxes || false;
  
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
      const facetWidth = (facetMaxX - facetMinX + 50) / 5; // Scale down by 5x
      const facetHeight = globalYHeight / 5; // Use global Y height, scaled down by 5x
    
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
          x: (cx - facetMinX + 25) / 5, // Scale down by 5x to match label scaling
          y: (cy - facetMinY + 25) / 5, // Scale down by 5x to match label scaling
          bbox: paddedBBox, // Store the padded bounding box (still in absolute coordinates for visual)
          // Use a smaller radius but larger than before due to less scaling
          r: 1.0 // Radius in scaled coordinates (5px when scaled back up)
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
        
        // Start labels very close to their points (using seeded random for consistency)
        const minDistance = 8; // Much smaller minimum distance from point
        const extraDistance = 5; // Much smaller additional random distance
        const angle = globalSeededRandom.random() * 2 * Math.PI; // Full 360° around the point
        const distance = minDistance + globalSeededRandom.random() * extraDistance;
        
        // More reasonable scaling for C++ style physics
        const scaledWidth = (bbox.width * 0.85) / 5; // Scale down by 5x instead of 10x
        const scaledHeight = (bbox.height * 1.1) / 5; // Scale down by 5x instead of 10x
        
        console.log(`Label "${schoolName}": original ${bbox.width.toFixed(1)}x${bbox.height.toFixed(1)} -> scaled ${scaledWidth.toFixed(1)}x${scaledHeight.toFixed(1)}`);

        labels.push({
          x: (cx - facetMinX + 25 + Math.cos(angle) * distance) / 5, // Scale down by 5x to match label scaling
          y: (cy - facetMinY + 25 + Math.sin(angle) * distance) / 5, // Scale down by 5x to match label scaling
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
      console.log(`Algorithm: ${algorithm}, Iterations: ${iterations}`);
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

      // Apply selected optimization algorithm for this facet
      const labeler = createSchoolLabeler()
        .label(labels)
        .anchor(anchors) 
        .width(facetWidth)
        .height(facetHeight)
        .algorithm(algorithm)
        .start(iterations);
      
      // Post-process labels to ensure they never overlap their own anchor points
      labels.forEach((label, i) => {
        const anchor = anchors[i];
        
        // Calculate label bounding box in scaled coordinates
        const labelLeft = label.x - label.width / 2;
        const labelRight = label.x + label.width / 2;
        const labelTop = label.y - label.height * 0.7;
        const labelBottom = label.y + label.height * 0.3;
        
        // Check if label bounding box overlaps with anchor circle
        const closestX = Math.max(labelLeft, Math.min(anchor.x, labelRight));
        const closestY = Math.max(labelTop, Math.min(anchor.y, labelBottom));
        const distanceToLabel = Math.sqrt((anchor.x - closestX) ** 2 + (anchor.y - closestY) ** 2);
        
        // If anchor circle overlaps with label, push label away
        if (distanceToLabel < anchor.r + 0.1) { // Small buffer for clearance
          // Find the direction from anchor center to label center
          const dx = label.x - anchor.x;
          const dy = label.y - anchor.y;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          
          if (currentDist > 0) {
            // Calculate minimum distance needed (from anchor center to label edge + circle radius + buffer)
            const minDistToLabelEdge = Math.max(label.width / 2, label.height / 2); // Distance to farthest label edge
            const minRequired = anchor.r + minDistToLabelEdge + 0.2; // Circle radius + label size + buffer
            
            // Try different angles to find a position that keeps label in bounds
            const originalAngle = Math.atan2(dy, dx);
            const angleSteps = [0, Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2, 3*Math.PI/4, -3*Math.PI/4, Math.PI];
            let bestAngle = originalAngle;
            let bestX = anchor.x + Math.cos(originalAngle) * minRequired;
            let bestY = anchor.y + Math.sin(originalAngle) * minRequired;
            
            // Check if original position is in bounds
            const bounds = { x1: 0.5, y1: 0.5, x2: facetWidth - 0.5, y2: facetHeight - 0.5 };
            const testLabelLeft = bestX - label.width / 2;
            const testLabelRight = bestX + label.width / 2;
            const testLabelTop = bestY - label.height * 0.7;
            const testLabelBottom = bestY + label.height * 0.3;
            
            const isOriginalInBounds = testLabelLeft >= bounds.x1 && testLabelRight <= bounds.x2 && 
                                     testLabelTop >= bounds.y1 && testLabelBottom <= bounds.y2;
            
            if (!isOriginalInBounds) {
              // Try alternative angles to find a position that stays in bounds
              for (const angleOffset of angleSteps) {
                const testAngle = originalAngle + angleOffset;
                const testX = anchor.x + Math.cos(testAngle) * minRequired;
                const testY = anchor.y + Math.sin(testAngle) * minRequired;
                
                const testLeft = testX - label.width / 2;
                const testRight = testX + label.width / 2;
                const testTop = testY - label.height * 0.7;
                const testBottom = testY + label.height * 0.3;
                
                if (testLeft >= bounds.x1 && testRight <= bounds.x2 && 
                    testTop >= bounds.y1 && testBottom <= bounds.y2) {
                  bestX = testX;
                  bestY = testY;
                  break;
                }
              }
            }
            
            // Apply the best position found
            label.x = bestX;
            label.y = bestY;
          }
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
      
      // Final boundary enforcement - ensure ALL labels are within plot bounds
      labels.forEach((label, i) => {
        const bounds = { x1: 0.5, y1: 0.5, x2: facetWidth - 0.5, y2: facetHeight - 0.5 };
        
        // Calculate label bounding box
        let labelLeft = label.x - label.width / 2;
        let labelRight = label.x + label.width / 2;
        let labelTop = label.y - label.height * 0.7;
        let labelBottom = label.y + label.height * 0.3;
        
        // Clamp to boundaries if needed
        let adjusted = false;
        
        if (labelLeft < bounds.x1) {
          label.x = bounds.x1 + label.width / 2;
          adjusted = true;
        } else if (labelRight > bounds.x2) {
          label.x = bounds.x2 - label.width / 2;
          adjusted = true;
        }
        
        if (labelTop < bounds.y1) {
          label.y = bounds.y1 + label.height * 0.7;
          adjusted = true;
        } else if (labelBottom > bounds.y2) {
          label.y = bounds.y2 - label.height * 0.3;
          adjusted = true;
        }
        
        if (adjusted) {
          console.log(`Boundary adjustment for label "${label.name}": moved to stay within plot bounds`);
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
          // Label bounding box (scaled coordinates, need to scale back up and translate)
          const labelLeft = (labels[i].x * 5) + facetMinX - 25 - (labels[i].width * 5) / 2;
          const labelRight = (labels[i].x * 5) + facetMinX - 25 + (labels[i].width * 5) / 2;
          const labelTop = (labels[i].y * 5) + facetMinY - 25 - (labels[i].height * 5) * 0.7;
          const labelBottom = (labels[i].y * 5) + facetMinY - 25 + (labels[i].height * 5) * 0.3;
          
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
      
      // DEBUG: Draw bounding boxes for points (only if debug is enabled)
      if (showDebugBoxes) {
        const pointBoxes = labelGroup.selectAll(".point-bbox")
          .data(anchors)
          .enter()
          .append("rect")
          .attr("class", "point-bbox")
          .attr("x", d => d.bbox.x) // Keep original scale - this was already correct
          .attr("y", d => d.bbox.y) // Keep original scale - this was already correct
          .attr("width", d => d.bbox.width) // Keep original scale - this was already correct
          .attr("height", d => d.bbox.height) // Keep original scale - this was already correct
          .attr("fill", "none")
          .attr("stroke", "red")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2,2")
          .attr("opacity", 0.7);
      }
      
      // Add leader lines with optimal endpoints using bounding box
      const leaderLines = labelGroup.selectAll(".leader-line")
        .data(labels)
        .enter()
        .append("line")
        .attr("class", "leader-line")
        .attr("x1", (d, i) => (anchors[i].x * 5) + facetMinX - 25) // Point position (scale by 5x)
        .attr("y1", (d, i) => (anchors[i].y * 5) + facetMinY - 25) // Point position (scale by 5x)
        .attr("x2", (d, i) => {
          // Point coordinates
          const pointX = (anchors[i].x * 5) + facetMinX - 25;
          const pointY = (anchors[i].y * 5) + facetMinY - 25;
          
          // Label bounding box (center-justified, scaled up)
          const labelCenterX = (d.x * 5) + facetMinX - 25;
          const labelWidth = d.width * 5;
          
          const labelLeft = labelCenterX - labelWidth / 2;
          const labelRight = labelCenterX + labelWidth / 2;
          
          // Find optimal x-coordinate: clamp point's x to be within label's x bounds
          const optimalX = Math.max(labelLeft, Math.min(labelRight, pointX));
          
          return optimalX;
        })
        .attr("y2", (d, i) => {
          // Label bounding box (center-justified, scaled up)
          const labelCenterY = (d.y * 5) + facetMinY - 25;
          const labelHeight = d.height * 5;
          
          const labelTop = labelCenterY - labelHeight * 0.7; // Match text positioning
          const labelBottom = labelCenterY + labelHeight * 0.3;
          
          // Use averaged y-coordinate of bounding box
          const averageY = (labelTop + labelBottom) / 2;
          
          return averageY;
        })
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
        .attr("x", d => (d.x * 5) + facetMinX - 25) // Scale back up and translate to absolute coordinates
        .attr("y", d => (d.y * 5) + facetMinY - 25) // Scale back up and translate to absolute coordinates
        .text(d => d.name)
        .style("font", "7px var(--sans-serif)")
        .style("fill", d => getSchoolLevelColor(d.schoolLevel)) // Use school level color
        .style("text-anchor", "middle")
        .style("white-space", "pre")
        .style("stroke", "var(--plot-background, white)")
        .style("stroke-width", "3px")
        .style("paint-order", "stroke")
        .style("opacity", "1.0");
      
      // DEBUG: Draw plot boundary rectangle and label bounding boxes (only if debug is enabled)
      if (showDebugBoxes) {
        labelGroup.append("rect")
          .attr("class", "plot-boundary")
          .attr("x", facetMinX - 25) // Position at actual facet origin (with margin)
          .attr("y", facetMinY - 25) // Position at actual facet origin (with margin)
          .attr("width", facetWidth * 5) // Scale back up to visual coordinates
          .attr("height", facetHeight * 5) // Scale back up to visual coordinates
          .attr("fill", "none")
          .attr("stroke", "red")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5")
          .attr("opacity", 0.8);

        const labelBoxes = labelGroup.selectAll(".label-bbox")
          .data(labels)
          .enter()
          .append("rect")
          .attr("class", "label-bbox")
          .attr("x", d => (d.x * 5) + facetMinX - 25 - (d.width * 5) / 2) // Center-justified: subtract half width, translate to absolute coordinates
          .attr("y", d => (d.y * 5) + facetMinY - 25 - (d.height * 5) * 0.7) // Scale back up and adjust positioning, translate to absolute coordinates
          .attr("width", d => d.width * 5) // Scale back up to match actual label size
          .attr("height", d => d.height * 5) // Scale back up to match actual label size
          .attr("fill", "none")
          .attr("stroke", "blue")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,3")
          .attr("opacity", 0.8);
      }
      

    }); // End facet group processing
    
  }, 150);
  
  return plotElement;
}
