// D3-Labeler inline implementation
function createSchoolLabeler() {
  var lab = [],
      anc = [],
      w = 1, // box width
      h = 1, // box width
      labelerObj = {};

  // Force simulation parameters (no longer needed - forces are now built-in)

  // Advanced exploration optimizer with multiple strategies
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
    // Advanced multi-start optimization with exploration strategies
    var m = lab.length;
    if (m === 0) return;

    console.log(`=== STARTING ADVANCED LABEL OPTIMIZATION: ${m} labels ===`);
    console.log(`Boundary constraints: width=${w.toFixed(2)}, height=${h.toFixed(2)}`);

    // Run multi-start optimization
    var finalScore = multiStartOptimization();
    
    // Calculate final statistics
    var totalOverlaps = 0;
    var totalLineLength = 0;
    var labelOverlaps = 0;
    var pointOverlaps = 0;
    
    for (var i = 0; i < m; i++) {
      var overlapPenalty = explorationOptimizer.calculateOverlapPenalty(i);
      totalOverlaps += overlapPenalty;
      
      var dx = lab[i].x - anc[i].x;
      var dy = lab[i].y - anc[i].y;
      totalLineLength += Math.sqrt(dx * dx + dy * dy);
      
      // Count label-label overlaps
      for (var j = i + 1; j < m; j++) {
        var x1 = lab[i].x - lab[i].width / 2;
        var y1 = lab[i].y - lab[i].height + 0.2;
        var x2 = lab[i].x + lab[i].width / 2;
        var y2 = lab[i].y + 0.2;
        
        var ox1 = lab[j].x - lab[j].width / 2;
        var oy1 = lab[j].y - lab[j].height + 0.2;
        var ox2 = lab[j].x + lab[j].width / 2;
        var oy2 = lab[j].y + 0.2;
        
        var overlap_x = Math.max(0, Math.min(x2, ox2) - Math.max(x1, ox1));
        var overlap_y = Math.max(0, Math.min(y2, oy2) - Math.max(y1, oy1));
        
        if (overlap_x > 0 && overlap_y > 0) {
          labelOverlaps++;
        }
      }
      
      // Count point overlaps
      for (var j = 0; j < anc.length; j++) {
        var dx = lab[i].x - anc[j].x;
        var dy = lab[i].y - anc[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var minDist = anc[j].r + 1.2;
        
        if (dist < minDist) {
          pointOverlaps++;
        }
      }
    }
    
    console.log(`Results: Avg leader length: ${(totalLineLength / m).toFixed(1)}px, Label overlaps: ${labelOverlaps}, Point overlaps: ${pointOverlaps}`);
    console.log(`=== END DEBUG ===`);
    
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
