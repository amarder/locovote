// ggrepel-style force-based labeler implementation

// Global seedable random number generator for consistent label placement
var globalSeededRandom = {
  seed: 12345,
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
      labelerObj = {};

  // ggrepel-style physics simulation parameters (optimized for SHORT leader lines with acceptable overlaps)
  var physics = {
    force_push: 2e-6,     // Repulsion force magnitude (doubled based on low velocity)
    force_pull: 1.5e-7,   // Spring force magnitude (increased significantly to pull labels closer)
    max_time: 0.3,        // Maximum simulation time in seconds (more time for convergence)
    max_iter: 4000,       // Maximum iterations (increased further)
    velocity_decay: 0.75, // Velocity damping factor (reduced to maintain momentum)
    temperature: 10.0,    // Simulated annealing temperature
    cooling_rate: 0.99995, // Temperature cooling rate (slower cooling to maintain forces)
    force_point_size: 250.0, // Multiplier for point repulsion forces (much stronger based on diagnostics)
    min_improvement_threshold: 0.01, // Minimum improvement to continue
    distance_pull_strength: 5.0, // Multiplier for distance-squared anchor pull force (much stronger!)
    
    // Use global seeded random for consistency
    seededRandom: function() {
      return globalSeededRandom.random();
    },
    
    // Initialize physics state
    velocities: [],
    original_positions: [],
    
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
    
    // Calculate repulsion force between two points
    repelForce: function(a, b, force_magnitude) {
      var dx = a.x - b.x;
      var dy = a.y - b.y;
      var d2 = Math.max(dx * dx + dy * dy, 0.0004); // Minimum distance constraint
      var d = Math.sqrt(d2);
      
      // Unit vector in direction of force
      var ux = dx / d;
      var uy = dy / d;
      
      // Force magnitude inversely proportional to squared distance
      var force = force_magnitude / d2;
      
      return {
        x: ux * force,
        y: uy * force
      };
    },
    
    // Calculate spring force pulling toward original position
    springForce: function(current, original, force_magnitude) {
      var dx = original.x - current.x;
      var dy = original.y - current.y;
      
      return {
        x: dx * force_magnitude,
        y: dy * force_magnitude
      };
    },
    
    // Calculate distance-squared spring force (stronger pull for distant labels)
    distanceSquaredSpringForce: function(current, target, force_magnitude) {
      var dx = target.x - current.x;
      var dy = target.y - current.y;
      var distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 0.1) return { x: 0, y: 0 }; // Avoid division by zero
      
      // Force increases with square of distance
      var distance_squared_multiplier = distance * distance;
      var unit_x = dx / distance;
      var unit_y = dy / distance;
      
      return {
        x: unit_x * force_magnitude * distance_squared_multiplier,
        y: unit_y * force_magnitude * distance_squared_multiplier
      };
    },
    
    // Keep box within boundaries
    putWithinBounds: function(box, bounds) {
      var width = box.x2 - box.x1;
      var height = box.y2 - box.y1;
      
      if (box.x1 < bounds.x1) {
        box.x1 = bounds.x1;
        box.x2 = box.x1 + width;
      } else if (box.x2 > bounds.x2) {
        box.x2 = bounds.x2;
        box.x1 = box.x2 - width;
      }
      
      if (box.y1 < bounds.y1) {
        box.y1 = bounds.y1;
        box.y2 = box.y1 + height;
      } else if (box.y2 > bounds.y2) {
        box.y2 = bounds.y2;
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
    
    // Main physics simulation step
    simulationStep: function(iter) {
      var n_overlaps = 0;
      var bounds = { x1: 1, y1: 1, x2: w - 1, y2: h - 1 };
      
      // Process each label
      for (var i = 0; i < lab.length; i++) {
        var label = lab[i];
        var labelBox = this.labelToBox(label);
        var labelCenter = this.centroid(labelBox);
        
        var force = { x: 0, y: 0 };
        var hasOverlap = false;
        var overlap_count = 0; // Count overlaps for this specific label
        
        // Repulsion from other labels (with MASSIVE overlap penalties)
        for (var j = 0; j < lab.length; j++) {
          if (i === j) continue;
          
          var otherBox = this.labelToBox(lab[j]);
          if (this.boxesOverlap(labelBox, otherBox)) {
            n_overlaps++;
            hasOverlap = true;
            overlap_count++;
            
            var otherCenter = this.centroid(otherBox);
            
            // Calculate overlap area for proportional force
            var overlap_x = Math.max(0, Math.min(labelBox.x2, otherBox.x2) - Math.max(labelBox.x1, otherBox.x1));
            var overlap_y = Math.max(0, Math.min(labelBox.y2, otherBox.y2) - Math.max(labelBox.y1, otherBox.y1));
            var overlap_area = overlap_x * overlap_y;
            
            // MODERATE force multiplier - prioritize shorter leader lines over perfect overlap avoidance
            var base_multiplier = 10.0; // Base penalty for any overlap (reduced to allow some overlap for shorter lines)
            var area_multiplier = overlap_area * 20.0; // Penalty proportional to overlap area (reduced significantly)
            var count_multiplier = Math.pow(overlap_count, 2) * 2.0; // Exponential penalty for multiple overlaps (reduced)
            var time_multiplier = 1.0 + Math.min(iter / 500, 3.0); // Increasing penalty over time (reduced and slower)
            
            var total_multiplier = base_multiplier + area_multiplier + count_multiplier;
            total_multiplier *= time_multiplier;
            
            var adaptiveForce = this.force_push * total_multiplier;
            var repel = this.repelForce(labelCenter, otherCenter, adaptiveForce);
            force.x += repel.x;
            force.y += repel.y;
          }
        }
        
        // Repulsion from OTHER anchor points (not the label's own point) - only when overlapping
        for (var j = 0; j < anc.length; j++) {
          if (j === i) continue; // Skip the label's own anchor point - it only attracts, never repels
          
          var anchorCircle = this.anchorToCircle(anc[j]);
          if (this.circleBoxOverlap(anchorCircle, labelBox)) {
            n_overlaps++;
            hasOverlap = true;
            overlap_count++;
            
            // Calculate penetration depth into circle
            var dx = labelCenter.x - anchorCircle.x;
            var dy = labelCenter.y - anchorCircle.y;
            var distance = Math.sqrt(dx * dx + dy * dy);
            var penetration = Math.max(0, anchorCircle.r + 0.2 - distance);
            
            // MODERATE penalty for overlapping with OTHER points
            var base_point_multiplier = 40.0; // Moderate base penalty for other points
            var penetration_multiplier = penetration * 100.0; // Moderate penalty for deep penetration
            var point_time_multiplier = 1.0 + Math.min(iter / 200, 5.0); // Slower escalation for points
            
            var total_point_multiplier = (base_point_multiplier + penetration_multiplier) * point_time_multiplier;
            
            var adaptiveForce = this.force_push * total_point_multiplier;
            var repel = this.repelForce(labelCenter, anchorCircle, adaptiveForce);
            force.x += repel.x;
            force.y += repel.y;
          }
        }
        
        // ALWAYS apply attractive force from the label's own anchor point (regardless of overlaps)
        if (i < anc.length) {
          var anchor_pos = { x: anc[i].x, y: anc[i].y };
          var anchor_pull = this.distanceSquaredSpringForce(labelCenter, anchor_pos, this.force_pull * this.distance_pull_strength);
          force.x += anchor_pull.x;
          force.y += anchor_pull.y;
        }
        
        // Update velocity with damping (reduced damping for overlapping labels)
        var effective_decay = hasOverlap ? this.velocity_decay * 0.9 : this.velocity_decay; // Less damping for overlapping labels
        this.velocities[i].x = this.velocities[i].x * effective_decay + force.x;
        this.velocities[i].y = this.velocities[i].y * effective_decay + force.y;
        
        // Velocity boost for overlapping labels (they MUST move faster)
        if (hasOverlap && overlap_count > 0) {
          var velocity_boost = 1.0 + (overlap_count * 0.5); // 50% boost per overlap
          this.velocities[i].x *= velocity_boost;
          this.velocities[i].y *= velocity_boost;
        }
        
        // CRITICAL: Velocity clamping to prevent numerical explosion
        var max_velocity = 2.0; // Maximum allowed velocity per iteration
        var velocity_magnitude = Math.sqrt(this.velocities[i].x * this.velocities[i].x + this.velocities[i].y * this.velocities[i].y);
        if (velocity_magnitude > max_velocity) {
          var scale = max_velocity / velocity_magnitude;
          this.velocities[i].x *= scale;
          this.velocities[i].y *= scale;
        }
        
        // Add small random perturbation to break oscillations in late iterations
        if (iter > 2000 && iter % 100 === 0) {
          var perturbation = hasOverlap ? 0.1 : 0.05; // Larger perturbation for overlapping labels
          this.velocities[i].x += (this.seededRandom() - 0.5) * perturbation;
          this.velocities[i].y += (this.seededRandom() - 0.5) * perturbation;
        }
        
        // Update position
        label.x += this.velocities[i].x;
        label.y += this.velocities[i].y;
        
        // Keep within bounds
        var newBox = this.labelToBox(label);
        newBox = this.putWithinBounds(newBox, bounds);
        label.x = (newBox.x1 + newBox.x2) / 2;
        label.y = newBox.y2 - 0.2;
      }
      
      // Decay forces over time (slower decay to maintain effectiveness)
      this.force_push *= 0.999995;
      this.force_pull *= 0.99999;
      this.temperature *= this.cooling_rate;
      
      return n_overlaps;
    },
    
    // Initialize physics simulation
    initializeSimulation: function() {
      this.velocities = [];
      this.original_positions = [];
      
      // Reset random seed for consistent results
      globalSeededRandom.reset();
      
      for (var i = 0; i < lab.length; i++) {
        this.velocities.push({ x: 0, y: 0 });
        this.original_positions.push({ x: lab[i].x, y: lab[i].y });
      }
      
      // Reset force parameters to initial values
      this.force_push = 2e-6;
      this.force_pull = 1.5e-7;
      this.temperature = 10.0;
    },
    
    // Run complete simulation with detailed diagnostics
    runSimulation: function() {
      console.log(`=== STARTING GGREPEL-STYLE PHYSICS SIMULATION ===`);
      console.log(`Parameters: force_push=${this.force_push}, force_pull=${this.force_pull}, max_iter=${this.max_iter}`);
      console.log(`Simulation area: ${w.toFixed(1)} x ${h.toFixed(1)}, Label density: ${(lab.length / (w * h)).toFixed(3)} labels/unit²`);
      
      this.initializeSimulation();
      
      var start_time = Date.now();
      var max_time_ms = this.max_time * 1000;
      var iter = 0;
      var n_overlaps = 1;
      var prev_overlaps = Infinity;
      var stagnant_iterations = 0;
      var max_stagnant = 400; // Increased based on diagnostics showing early termination
      var best_overlaps = Infinity;
      var total_velocity = 0;
      var force_history = [];
      var overlap_history = []; // Track overlap oscillations
      
      // Initial diagnostics
      var initial_overlaps = this.simulationStep(0);
      console.log(`Initial state: ${initial_overlaps} overlaps detected`);
      
      while (n_overlaps > 0 && iter < this.max_iter) {
        iter++;
        n_overlaps = this.simulationStep(iter);
        
        // Calculate total system velocity for convergence analysis
        total_velocity = 0;
        for (var i = 0; i < this.velocities.length; i++) {
          total_velocity += Math.sqrt(this.velocities[i].x * this.velocities[i].x + this.velocities[i].y * this.velocities[i].y);
        }
        
        // Track best result
        if (n_overlaps < best_overlaps) {
          best_overlaps = n_overlaps;
        }
        
        // Track overlap history for oscillation detection
        overlap_history.push(n_overlaps);
        if (overlap_history.length > 50) overlap_history.shift(); // Keep last 50 values
        
        // Detect oscillation patterns
        var is_oscillating = false;
        if (overlap_history.length >= 20) {
          var recent_range = Math.max(...overlap_history.slice(-20)) - Math.min(...overlap_history.slice(-20));
          var recent_avg = overlap_history.slice(-20).reduce((a,b) => a+b) / 20;
          is_oscillating = recent_range > 5 && Math.abs(n_overlaps - recent_avg) < recent_range * 0.3;
        }
        
        // Enhanced stagnation detection
        if ((n_overlaps >= prev_overlaps && total_velocity < 0.001) || is_oscillating) {
          stagnant_iterations++;
        } else {
          stagnant_iterations = 0;
        }
        prev_overlaps = n_overlaps;
        
        // Store force history for analysis
        if (iter % 100 === 0) {
          force_history.push({
            iter: iter,
            overlaps: n_overlaps,
            velocity: total_velocity,
            force_push: this.force_push,
            force_pull: this.force_pull
          });
        }
        
        // Enhanced progress logging with overlap penalties
        if (iter % 200 === 0) {
          // Calculate average force multiplier being applied
          var total_force_multiplier = 0;
          var overlapping_labels = 0;
          for (var i = 0; i < lab.length; i++) {
            var labelBox = this.labelToBox(lab[i]);
            var label_overlaps = 0;
            for (var j = 0; j < lab.length; j++) {
              if (i !== j && this.boxesOverlap(labelBox, this.labelToBox(lab[j]))) label_overlaps++;
            }
            for (var j = 0; j < anc.length; j++) {
              if (this.circleBoxOverlap(this.anchorToCircle(anc[j]), labelBox)) label_overlaps++;
            }
            if (label_overlaps > 0) {
              overlapping_labels++;
              var multiplier = 50.0 + Math.pow(label_overlaps, 2) * 10.0;
              total_force_multiplier += multiplier;
            }
          }
          var avg_multiplier = overlapping_labels > 0 ? (total_force_multiplier / overlapping_labels) : 1.0;
          
          console.log(`Iter ${iter}: ${n_overlaps} overlaps, velocity=${total_velocity.toFixed(4)}, forces=${this.force_push.toExponential(1)}/${this.force_pull.toExponential(1)}, avg_penalty=${avg_multiplier.toFixed(1)}x`);
        }
        
        // Early termination with enhanced diagnostics
        if (stagnant_iterations > max_stagnant) {
          console.log(`Early termination: no progress for ${max_stagnant} iterations`);
          console.log(`Stagnation analysis: velocity=${total_velocity.toFixed(4)}, best_overlaps=${best_overlaps}, oscillating=${is_oscillating}`);
          if (overlap_history.length >= 10) {
            var recent_overlaps = overlap_history.slice(-10).join(',');
            console.log(`Recent overlap pattern: [${recent_overlaps}]`);
          }
          break;
        }
        
        // Check time limit
        if (iter % 10 === 0) {
          var elapsed = Date.now() - start_time;
          if (elapsed > max_time_ms) {
            console.log(`Time limit reached after ${iter} iterations`);
            break;
          }
        }
      }
      
      var elapsed = Date.now() - start_time;
      console.log(`Simulation complete: ${iter} iterations, ${elapsed}ms, ${n_overlaps} remaining overlaps`);
      console.log(`Performance: ${(iter/elapsed*1000).toFixed(0)} iter/sec, best result: ${best_overlaps} overlaps`);
      
      // Final diagnostics
      this.printDetailedDiagnostics();
      
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
    // ggrepel-style physics-based label optimization
    var m = lab.length;
    if (m === 0) return;

    console.log(`=== STARTING GGREPEL-STYLE LABEL OPTIMIZATION: ${m} labels ===`);
    console.log(`Boundary constraints: width=${w.toFixed(2)}, height=${h.toFixed(2)}`);

    // Add small random jitter to initial positions to break symmetries (using seeded random)
    for (var i = 0; i < m; i++) {
      var jitter = 0.1;
      lab[i].x += (globalSeededRandom.random() - 0.5) * jitter;
      lab[i].y += (globalSeededRandom.random() - 0.5) * jitter;
    }

    // Run ggrepel-style physics simulation
    var success = physics.runSimulation();
    
    // Calculate final statistics
    var totalLineLength = 0;
    var labelOverlaps = 0;
    var pointOverlaps = 0;
    var totalOverlapArea = 0;
    
    for (var i = 0; i < m; i++) {
      var dx = lab[i].x - anc[i].x;
      var dy = lab[i].y - anc[i].y;
      totalLineLength += Math.sqrt(dx * dx + dy * dy);
      
      // Calculate label-label overlap areas using physics collision detection
      var labelBox = physics.labelToBox(lab[i]);
      for (var j = i + 1; j < m; j++) {
        var otherBox = physics.labelToBox(lab[j]);
        if (physics.boxesOverlap(labelBox, otherBox)) {
          labelOverlaps++;
          // Calculate overlap area for main results
          var overlap_x = Math.max(0, Math.min(labelBox.x2, otherBox.x2) - Math.max(labelBox.x1, otherBox.x1));
          var overlap_y = Math.max(0, Math.min(labelBox.y2, otherBox.y2) - Math.max(labelBox.y1, otherBox.y1));
          totalOverlapArea += overlap_x * overlap_y;
        }
      }
      
      // Calculate point overlap areas using physics collision detection
      for (var j = 0; j < anc.length; j++) {
        var anchorCircle = physics.anchorToCircle(anc[j]);
        if (physics.circleBoxOverlap(anchorCircle, labelBox)) {
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
    console.log(`Simulation ${success ? 'CONVERGED' : 'INCOMPLETE'}`);
    console.log(`=== END GGREPEL OPTIMIZATION ===`);
    
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

  // Alternative energy and schedule functions removed - not needed for force-directed approach

  return labelerObj;
};

// Simplified auto-labeling function specifically for Cambridge schools plots
export function addSchoolLabels(plotElement, data, xField, yField, textField, d3) {
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
        
        // Start labels in any direction around their points (using seeded random for consistency)
        const minDistance = 25; // Minimum distance from point
        const extraDistance = 15; // Additional random distance
        const angle = globalSeededRandom.random() * 2 * Math.PI; // Full 360° around the point
        const distance = minDistance + globalSeededRandom.random() * extraDistance;
        
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

      // Apply ggrepel-style physics optimization for this facet
      const labeler = createSchoolLabeler()
        .label(labels)
        .anchor(anchors) 
        .width(facetWidth)
        .height(facetHeight)
        .start(100); // Physics simulation iterations (parameter not used in new implementation)
      
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
          // Label bounding box (scaled coordinates, need to scale back up and translate)
          const labelLeft = (labels[i].x * 10) + facetMinX - 25 - (labels[i].width * 10) / 2;
          const labelRight = (labels[i].x * 10) + facetMinX - 25 + (labels[i].width * 10) / 2;
          const labelTop = (labels[i].y * 10) + facetMinY - 25 - (labels[i].height * 10) * 0.7;
          const labelBottom = (labels[i].y * 10) + facetMinY - 25 + (labels[i].height * 10) * 0.3;
          
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
      
      // DEBUG: Draw bounding boxes for points
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
      
      // Add leader lines with optimal endpoints using bounding box
      const leaderLines = labelGroup.selectAll(".leader-line")
        .data(labels)
        .enter()
        .append("line")
        .attr("class", "leader-line")
        .attr("x1", (d, i) => (anchors[i].x * 10) + facetMinX - 25) // Point position
        .attr("y1", (d, i) => (anchors[i].y * 10) + facetMinY - 25) // Point position
        .attr("x2", (d, i) => {
          // Point coordinates
          const pointX = (anchors[i].x * 10) + facetMinX - 25;
          const pointY = (anchors[i].y * 10) + facetMinY - 25;
          
          // Label bounding box (center-justified, scaled up)
          const labelCenterX = (d.x * 10) + facetMinX - 25;
          const labelWidth = d.width * 10;
          
          const labelLeft = labelCenterX - labelWidth / 2;
          const labelRight = labelCenterX + labelWidth / 2;
          
          // Find optimal x-coordinate: clamp point's x to be within label's x bounds
          const optimalX = Math.max(labelLeft, Math.min(labelRight, pointX));
          
          return optimalX;
        })
        .attr("y2", (d, i) => {
          // Label bounding box (center-justified, scaled up)
          const labelCenterY = (d.y * 10) + facetMinY - 25;
          const labelHeight = d.height * 10;
          
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
      
      // DEBUG: Draw plot boundary rectangle
      labelGroup.append("rect")
        .attr("class", "plot-boundary")
        .attr("x", facetMinX - 25) // Position at actual facet origin (with margin)
        .attr("y", facetMinY - 25) // Position at actual facet origin (with margin)
        .attr("width", facetWidth * 10) // Scale back up to visual coordinates
        .attr("height", facetHeight * 10) // Scale back up to visual coordinates
        .attr("fill", "none")
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.8);

      // DEBUG: Draw bounding boxes for labels
      const labelBoxes = labelGroup.selectAll(".label-bbox")
        .data(labels)
        .enter()
        .append("rect")
        .attr("class", "label-bbox")
        .attr("x", d => (d.x * 10) + facetMinX - 25 - (d.width * 10) / 2) // Center-justified: subtract half width, translate to absolute coordinates
        .attr("y", d => (d.y * 10) + facetMinY - 25 - (d.height * 10) * 0.7) // Scale back up and adjust positioning, translate to absolute coordinates
        .attr("width", d => d.width * 10) // Scale back up to match actual label size
        .attr("height", d => d.height * 10) // Scale back up to match actual label size
        .attr("fill", "none")
        .attr("stroke", "blue")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .attr("opacity", 0.8);
      

    }); // End facet group processing
    
  }, 150);
  
  return plotElement;
}
