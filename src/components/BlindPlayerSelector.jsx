import React, { useMemo } from 'react';

function BlindPlayerSelector({
  team1Name = 'Team 1',
  team2Name = 'Team 2',
  team1Players,
  team2Players,
  matchupData,
  maxPoints = 1900,
  numMatches = 4,
  selectedMatches = []
}) {
  // Generate combinations of k items from array
  const combinations = (arr, k) => {
    if (k === 0) return [[]];
    if (k > arr.length) return [];

    const results = [];
    const generate = (combo, start) => {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        generate(combo, i + 1);
        combo.pop();
      }
    };
    generate([], 0);
    return results;
  };

  // Generate all permutations of an array
  const permutations = (arr) => {
    if (arr.length <= 1) return [arr];
    const results = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      const perms = permutations(rest);
      for (const perm of perms) {
        results.push([arr[i], ...perm]);
      }
    }
    return results;
  };

  // Extract probability from odds
  const extractProbability = (odds) => {
    if (!odds || typeof odds !== 'object') {
      if (typeof odds === 'number') {
        return odds >= 0 && odds <= 1 ? odds : odds / 100;
      }
      return null;
    }

    if (odds.error) {
      return null;
    }

    if (odds.winProbability !== undefined) {
      const prob = odds.winProbability;
      if (typeof prob === 'number') {
        return prob >= 0 && prob <= 1 ? prob : prob / 100;
      }
    }

    if (odds.odds !== undefined) {
      const oddsValue = odds.odds;
      if (typeof oddsValue === 'number') {
        return oddsValue >= 0 && oddsValue <= 1 ? oddsValue : oddsValue / 100;
      }
    }

    const numericValues = Object.values(odds)
      .filter(v => v !== null && v !== undefined && typeof v === 'number')
      .slice(0, 1);

    if (numericValues.length > 0) {
      const value = numericValues[0];
      return value >= 0 && value <= 1 ? value : value / 100;
    }

    return null;
  };

  // Calculate best remaining lineup after blind pick (from Team 1's perspective)
  // Finds the best possible outcome for Team 1
  const calculateBestRemainingLineupTeam1 = (
    blindTeam1Index,
    blindTeam2Index,
    usedTeam1Indices,
    usedTeam2Indices,
    remainingMatches,
    remainingTeam1Points,
    remainingTeam2Points
  ) => {
    if (remainingMatches === 0) {
      return { winProb: 0, matchups: [] };
    }

    // Get available players
    const availableTeam1Players = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam1Indices.has(p.index));

    const availableTeam2Players = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam2Indices.has(p.index));

    if (availableTeam1Players.length < remainingMatches || availableTeam2Players.length < remainingMatches) {
      return null;
    }

    // Generate combinations for team1
    const team1Combos = combinations(availableTeam1Players, remainingMatches);
    const validTeam1Combos = team1Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam1Points;
    });

    if (validTeam1Combos.length === 0) {
      return null;
    }

    // Generate combinations for team2
    const team2Combos = combinations(availableTeam2Players, remainingMatches);
    const validTeam2Combos = team2Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam2Points;
    });

    if (validTeam2Combos.length === 0) {
      return null;
    }

    // Find best possible outcome for Team 1: maximize win probability across all valid combinations
    let bestWinProb = -1;
    let bestMatchups = null;

    // Try all Team 1 combinations and find the best possible matchups
    for (const team1Combo of validTeam1Combos) {
      for (const team2Combo of validTeam2Combos) {
        const team2Perms = permutations(team2Combo);

        for (const team2Perm of team2Perms) {
          const matchups = [];
          let totalWinProb = 0;
          let valid = true;

          for (let i = 0; i < team1Combo.length; i++) {
            const p1Idx = team1Combo[i].index;
            const p2Idx = team2Perm[i].index;
            const matchup = matchupData[p1Idx]?.[p2Idx];

            if (!matchup || !matchup.race) {
              valid = false;
              break;
            }

            const prob = extractProbability(matchup.odds);
            if (prob === null) {
              valid = false;
              break;
            }

            totalWinProb += prob;
            matchups.push({
              playerIndex: p1Idx,
              player: team1Players[p1Idx],
              opponent: team2Players[p2Idx],
              winProb: prob,
              race: matchup.race
            });
          }

          // Track the best possible outcome for Team 1
          if (valid && totalWinProb > bestWinProb) {
            bestWinProb = totalWinProb;
            bestMatchups = matchups;
          }
        }
      }
    }

    return bestWinProb >= 0 ? { winProb: bestWinProb, matchups: bestMatchups || [] } : null;
  };

  // Calculate best remaining lineup after blind pick (from Team 2's perspective)
  // Finds the best possible outcome for Team 2
  const calculateBestRemainingLineupTeam2 = (
    blindTeam1Index,
    blindTeam2Index,
    usedTeam1Indices,
    usedTeam2Indices,
    remainingMatches,
    remainingTeam1Points,
    remainingTeam2Points
  ) => {
    if (remainingMatches === 0) {
      return { winProb: 0, matchups: [] };
    }

    // Get available players
    const availableTeam1Players = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam1Indices.has(p.index));

    const availableTeam2Players = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam2Indices.has(p.index));

    if (availableTeam1Players.length < remainingMatches || availableTeam2Players.length < remainingMatches) {
      return null;
    }

    // Generate combinations for team1
    const team1Combos = combinations(availableTeam1Players, remainingMatches);
    const validTeam1Combos = team1Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam1Points;
    });

    if (validTeam1Combos.length === 0) {
      return null;
    }

    // Generate combinations for team2
    const team2Combos = combinations(availableTeam2Players, remainingMatches);
    const validTeam2Combos = team2Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam2Points;
    });

    if (validTeam2Combos.length === 0) {
      return null;
    }

    // Find best possible outcome for Team 2: maximize win probability across all valid combinations
    let bestWinProb = -1;
    let bestMatchups = null;

    // Try all Team 2 combinations and find the best possible matchups
    for (const team2Combo of validTeam2Combos) {
      for (const team1Combo of validTeam1Combos) {
        const team1Perms = permutations(team1Combo);

        for (const team1Perm of team1Perms) {
          const matchups = [];
          let totalWinProb = 0;
          let valid = true;

          for (let i = 0; i < team2Combo.length; i++) {
            const p1Idx = team1Perm[i].index;
            const p2Idx = team2Combo[i].index;
            const matchup = matchupData[p1Idx]?.[p2Idx];

            if (!matchup || !matchup.race) {
              valid = false;
              break;
            }

            const prob = extractProbability(matchup.odds);
            if (prob === null) {
              valid = false;
              break;
            }

            // From Team 2's perspective, win prob is 1 - prob
            totalWinProb += (1 - prob);
            matchups.push({
              playerIndex: p2Idx,
              player: team2Players[p2Idx],
              opponent: team1Players[p1Idx],
              winProb: 1 - prob,
              race: matchup.race
            });
          }

          // Track the best possible outcome for Team 2
          if (valid && totalWinProb > bestWinProb) {
            bestWinProb = totalWinProb;
            bestMatchups = matchups;
          }
        }
      }
    }

    return bestWinProb >= 0 ? { winProb: bestWinProb, matchups: bestMatchups || [] } : null;
  };

  // Calculate blind player scores for Team 1
  const calculateBlindPlayerScoresTeam1 = useMemo(() => {
    if (!team1Players || !team2Players || !matchupData) {
      return [];
    }

    // Calculate selected players and remaining constraints
    const selectedTeam1Indices = new Set(selectedMatches.map(m => m.team1Index));
    const selectedTeam2Indices = new Set(selectedMatches.map(m => m.team2Index));

    const selectedTeam1Points = selectedMatches.reduce((sum, m) => {
      return sum + (team1Players[m.team1Index]?.rating || 0);
    }, 0);

    const selectedTeam2Points = selectedMatches.reduce((sum, m) => {
      return sum + (team2Players[m.team2Index]?.rating || 0);
    }, 0);

    const remainingMatches = numMatches - selectedMatches.length;
    const remainingTeam1Points = maxPoints - selectedTeam1Points;
    const remainingTeam2Points = maxPoints - selectedTeam2Points;

    // If all matches are selected, return empty
    if (remainingMatches === 0) {
      return [];
    }

    // Get available players
    const availableTeam1Players = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !selectedTeam1Indices.has(p.index));

    const availableTeam2Players = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !selectedTeam2Indices.has(p.index));

    if (availableTeam1Players.length === 0 || availableTeam2Players.length === 0) {
      return [];
    }

    const blindPlayerScores = [];

    // For each available Team 1 player, simulate them being picked blind
    for (const blindPlayer of availableTeam1Players) {
      const blindTeam1Index = blindPlayer.index;
      const blindPlayerRating = blindPlayer.rating;

      // Check if picking this player would exceed point limit
      if (blindPlayerRating > remainingTeam1Points) {
        continue;
      }

      // Find Team 2's counter-pick: lowest-rated player with >= 60% win probability (from Team 2's perspective)
      // If no player has >= 60%, fall back to best counter-pick
      const REASONABLE_WIN_THRESHOLD = 0.6;
      let counterPick = null;
      let counterPickWinProb = null;
      let bestFallbackPick = null;
      let bestFallbackWinProb = 1.0; // Worst case for Team 1

      for (const counterPlayer of availableTeam2Players) {
        const counterTeam2Index = counterPlayer.index;
        const counterPlayerRating = counterPlayer.rating;

        // Check if counter-pick would exceed point limit
        if (counterPlayerRating > remainingTeam2Points) {
          continue;
        }

        const matchup = matchupData[blindTeam1Index]?.[counterTeam2Index];
        if (!matchup || !matchup.race) {
          continue;
        }

        const prob = extractProbability(matchup.odds);
        if (prob === null) {
          continue;
        }

        // From Team 2's perspective, their win probability is 1 - prob
        const team2WinProb = 1 - prob;

        // Check if this player meets the reasonable win threshold
        if (team2WinProb >= REASONABLE_WIN_THRESHOLD) {
          // If we haven't found a counter-pick yet, or this one has a lower rating
          if (!counterPick || counterPlayerRating < counterPick.rating) {
            counterPick = counterPlayer;
            counterPickWinProb = prob; // Team 1's win prob (what we'll use for scoring)
          }
        }

        // Also track best fallback (lowest Team 1 win prob) in case no player meets threshold
        if (prob < bestFallbackWinProb) {
          bestFallbackWinProb = prob;
          bestFallbackPick = counterPlayer;
        }
      }

      // Use counter-pick if found, otherwise use fallback
      const worstCounterPick = counterPick || bestFallbackPick;
      const worstWinProb = counterPickWinProb !== null ? counterPickWinProb : bestFallbackWinProb;

      if (!worstCounterPick) {
        continue; // No valid counter-pick found
      }

      // Now calculate best remaining lineup after this blind match
      const newRemainingMatches = remainingMatches - 1;
      const newRemainingTeam1Points = remainingTeam1Points - blindPlayerRating;
      const newRemainingTeam2Points = remainingTeam2Points - worstCounterPick.rating;

      const newUsedTeam1Indices = new Set([...selectedTeam1Indices, blindTeam1Index]);
      const newUsedTeam2Indices = new Set([...selectedTeam2Indices, worstCounterPick.index]);

      const bestRemaining = calculateBestRemainingLineupTeam1(
        blindTeam1Index,
        worstCounterPick.index,
        newUsedTeam1Indices,
        newUsedTeam2Indices,
        newRemainingMatches,
        newRemainingTeam1Points,
        newRemainingTeam2Points
      );

      if (!bestRemaining) {
        continue; // No valid remaining lineup
      }

      // Calculate overall score
      // Score = blind match win prob + best remaining lineup win prob
      // Also consider flexibility: penalize if remaining lineup options are limited
      const totalWinProb = worstWinProb + bestRemaining.winProb;
      const avgWinProb = totalWinProb / numMatches;

      // Calculate flexibility score (how many valid remaining combinations exist)
      // This is a rough heuristic - we want to avoid picks that severely limit options
      const flexibilityScore = bestRemaining.matchups.length > 0 ? 1 : 0;

      blindPlayerScores.push({
        player: blindPlayer,
        counterPick: worstCounterPick,
        blindMatchWinProb: worstWinProb,
        remainingLineupWinProb: bestRemaining.winProb,
        totalWinProb,
        avgWinProb,
        flexibilityScore,
        remainingMatchups: bestRemaining.matchups,
        blindMatchRace: matchupData[blindTeam1Index]?.[worstCounterPick.index]?.race
      });
    }

    // Sort by total win probability (descending), then by flexibility
    return blindPlayerScores.sort((a, b) => {
      if (Math.abs(a.totalWinProb - b.totalWinProb) < 0.001) {
        return b.flexibilityScore - a.flexibilityScore;
      }
      return b.totalWinProb - a.totalWinProb;
    });
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches, selectedMatches]);

  // Calculate blind player scores for Team 2
  const calculateBlindPlayerScoresTeam2 = useMemo(() => {
    if (!team1Players || !team2Players || !matchupData) {
      return [];
    }

    // Calculate selected players and remaining constraints
    const selectedTeam1Indices = new Set(selectedMatches.map(m => m.team1Index));
    const selectedTeam2Indices = new Set(selectedMatches.map(m => m.team2Index));

    const selectedTeam1Points = selectedMatches.reduce((sum, m) => {
      return sum + (team1Players[m.team1Index]?.rating || 0);
    }, 0);

    const selectedTeam2Points = selectedMatches.reduce((sum, m) => {
      return sum + (team2Players[m.team2Index]?.rating || 0);
    }, 0);

    const remainingMatches = numMatches - selectedMatches.length;
    const remainingTeam1Points = maxPoints - selectedTeam1Points;
    const remainingTeam2Points = maxPoints - selectedTeam2Points;

    // If all matches are selected, return empty
    if (remainingMatches === 0) {
      return [];
    }

    // Get available players
    const availableTeam1Players = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !selectedTeam1Indices.has(p.index));

    const availableTeam2Players = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !selectedTeam2Indices.has(p.index));

    if (availableTeam1Players.length === 0 || availableTeam2Players.length === 0) {
      return [];
    }

    const blindPlayerScores = [];

    // For each available Team 2 player, simulate them being picked blind
    for (const blindPlayer of availableTeam2Players) {
      const blindTeam2Index = blindPlayer.index;
      const blindPlayerRating = blindPlayer.rating;

      // Check if picking this player would exceed point limit
      if (blindPlayerRating > remainingTeam2Points) {
        continue;
      }

      // Find Team 1's counter-pick: lowest-rated player with >= 60% win probability (from Team 1's perspective)
      // If no player has >= 60%, fall back to best counter-pick
      const REASONABLE_WIN_THRESHOLD = 0.6;
      let counterPick = null;
      let counterPickWinProb = null;
      let bestFallbackPick = null;
      let bestFallbackWinProb = 0.0; // Best case for Team 1 (worst for Team 2)

      for (const counterPlayer of availableTeam1Players) {
        const counterTeam1Index = counterPlayer.index;
        const counterPlayerRating = counterPlayer.rating;

        // Check if counter-pick would exceed point limit
        if (counterPlayerRating > remainingTeam1Points) {
          continue;
        }

        const matchup = matchupData[counterTeam1Index]?.[blindTeam2Index];
        if (!matchup || !matchup.race) {
          continue;
        }

        const prob = extractProbability(matchup.odds);
        if (prob === null) {
          continue;
        }

        // From Team 1's perspective, their win probability is prob
        // Check if this player meets the reasonable win threshold
        if (prob >= REASONABLE_WIN_THRESHOLD) {
          // If we haven't found a counter-pick yet, or this one has a lower rating
          if (!counterPick || counterPlayerRating < counterPick.rating) {
            counterPick = counterPlayer;
            counterPickWinProb = prob;
          }
        }

        // Also track best fallback (highest Team 1 win prob) in case no player meets threshold
        if (prob > bestFallbackWinProb) {
          bestFallbackWinProb = prob;
          bestFallbackPick = counterPlayer;
        }
      }

      // Use counter-pick if found, otherwise use fallback
      const bestCounterPick = counterPick || bestFallbackPick;
      // From Team 2's perspective, their win prob is 1 - Team 1's win prob
      const worstWinProb = counterPickWinProb !== null ? (1 - counterPickWinProb) : (1 - bestFallbackWinProb);

      if (!bestCounterPick) {
        continue; // No valid counter-pick found
      }

      // Now calculate best remaining lineup after this blind match
      const newRemainingMatches = remainingMatches - 1;
      const newRemainingTeam1Points = remainingTeam1Points - bestCounterPick.rating;
      const newRemainingTeam2Points = remainingTeam2Points - blindPlayerRating;

      const newUsedTeam1Indices = new Set([...selectedTeam1Indices, bestCounterPick.index]);
      const newUsedTeam2Indices = new Set([...selectedTeam2Indices, blindTeam2Index]);

      const bestRemaining = calculateBestRemainingLineupTeam2(
        bestCounterPick.index,
        blindTeam2Index,
        newUsedTeam1Indices,
        newUsedTeam2Indices,
        newRemainingMatches,
        newRemainingTeam1Points,
        newRemainingTeam2Points
      );

      if (!bestRemaining) {
        continue; // No valid remaining lineup
      }

      // Calculate overall score
      const totalWinProb = worstWinProb + bestRemaining.winProb;
      const avgWinProb = totalWinProb / numMatches;

      const flexibilityScore = bestRemaining.matchups.length > 0 ? 1 : 0;

      blindPlayerScores.push({
        player: blindPlayer,
        counterPick: bestCounterPick,
        blindMatchWinProb: worstWinProb,
        remainingLineupWinProb: bestRemaining.winProb,
        totalWinProb,
        avgWinProb,
        flexibilityScore,
        remainingMatchups: bestRemaining.matchups,
        blindMatchRace: matchupData[bestCounterPick.index]?.[blindTeam2Index]?.race
      });
    }

    // Sort by total win probability (descending), then by flexibility
    return blindPlayerScores.sort((a, b) => {
      if (Math.abs(a.totalWinProb - b.totalWinProb) < 0.001) {
        return b.flexibilityScore - a.flexibilityScore;
      }
      return b.totalWinProb - a.totalWinProb;
    });
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches, selectedMatches]);

  if (!team1Players || !team2Players || !matchupData) {
    return (
      <div className="blind-player-selector-container">
        <h2>Best Blind Players</h2>
        <p className="no-blind-players">Waiting for matchup data...</p>
      </div>
    );
  }

  const blindPlayerScoresTeam1 = calculateBlindPlayerScoresTeam1;
  const blindPlayerScoresTeam2 = calculateBlindPlayerScoresTeam2;

  if (blindPlayerScoresTeam1.length === 0 && blindPlayerScoresTeam2.length === 0) {
    return (
      <div className="blind-player-selector-container">
        <h2>Best Blind Players</h2>
        <p className="no-blind-players">
          No valid blind players found.
          <br />
          <small>
            All matches may be selected, or no players meet the constraints.
          </small>
        </p>
      </div>
    );
  }

  return (
    <div className="blind-player-selector-container">
      <h2>Best Blind Players</h2>
      <p className="blind-explanation">
        These are the best players for each team to pick "blind" (without knowing who the opponent will counter-pick).
        The algorithm assumes the opponent will choose the lowest number most likely to win.
      </p>
      <div className="blind-players-columns">
        <div className="blind-players-column">
          <h3>{team1Name}</h3>
          {blindPlayerScoresTeam1.length === 0 ? (
            <p className="no-blind-players">No valid blind players found for {team1Name}</p>
          ) : (
            <div className="blind-players-list">
              {blindPlayerScoresTeam1.slice(0, 3).map((score, idx) => (
                <div key={idx} className="blind-player-card">
                  <div className="blind-player-header">
                    <span className="blind-player-rank">#{idx + 1}</span>
                    <div className="blind-player-info">
                      <span className="blind-player-name">{score.player.name}</span>
                      <span className="blind-player-rating">Rating: {score.player.rating}</span>
                    </div>
                  </div>

                  <div className="blind-match-section">
                    <div className="section-title">Blind Match (Worst Case Counter-Pick)</div>
                    <div className="matchup-details">
                      <span className="player-vs">
                        {score.player.name} ({score.player.rating}) vs {score.counterPick.name} ({score.counterPick.rating})
                      </span>
                      <span className="matchup-stats">
                        <span className="win-prob">Win Prob: {(score.blindMatchWinProb * 100).toFixed(1)}%</span>
                        <span className="race">Race: {score.blindMatchRace}</span>
                      </span>
                    </div>
                  </div>

                  <div className="remaining-lineup-section">
                    <div className="section-title">Best Remaining Lineup ({numMatches - selectedMatches.length - 1} matches)</div>
                    {score.remainingMatchups.length > 0 ? (
                      <div className="remaining-matchups">
                        {score.remainingMatchups.map((matchup, mIdx) => (
                          <div key={mIdx} className="remaining-matchup">
                            <span className="matchup-players">
                              {matchup.player.name} ({matchup.player.rating}) vs {matchup.opponent.name} ({matchup.opponent.rating})
                            </span>
                            <span className="matchup-winprob">{(matchup.winProb * 100).toFixed(1)}%</span>
                            <span className="matchup-race">{matchup.race}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-remaining">No valid remaining matchups found</div>
                    )}
                  </div>

                  <div className="blind-player-stats">
                    <div className="stat">
                      <strong>Total Win Prob:</strong> {(score.totalWinProb * 100).toFixed(1)}% ({(score.avgWinProb * 100).toFixed(1)}% avg)
                    </div>
                    <div className="stat">
                      <strong>Blind Match:</strong> {(score.blindMatchWinProb * 100).toFixed(1)}%
                    </div>
                    <div className="stat">
                      <strong>Remaining Lineup:</strong> {(score.remainingLineupWinProb * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="blind-players-column">
          <h3>{team2Name}</h3>
          {blindPlayerScoresTeam2.length === 0 ? (
            <p className="no-blind-players">No valid blind players found for {team2Name}</p>
          ) : (
            <div className="blind-players-list">
              {blindPlayerScoresTeam2.slice(0, 3).map((score, idx) => (
                <div key={idx} className="blind-player-card">
                  <div className="blind-player-header">
                    <span className="blind-player-rank">#{idx + 1}</span>
                    <div className="blind-player-info">
                      <span className="blind-player-name">{score.player.name}</span>
                      <span className="blind-player-rating">Rating: {score.player.rating}</span>
                    </div>
                  </div>

                  <div className="blind-match-section">
                    <div className="section-title">Blind Match (Worst Case Counter-Pick)</div>
                    <div className="matchup-details">
                      <span className="player-vs">
                        {score.player.name} ({score.player.rating}) vs {score.counterPick.name} ({score.counterPick.rating})
                      </span>
                      <span className="matchup-stats">
                        <span className="win-prob">Win Prob: {(score.blindMatchWinProb * 100).toFixed(1)}%</span>
                        <span className="race">Race: {score.blindMatchRace}</span>
                      </span>
                    </div>
                  </div>

                  <div className="remaining-lineup-section">
                    <div className="section-title">Best Remaining Lineup ({numMatches - selectedMatches.length - 1} matches)</div>
                    {score.remainingMatchups.length > 0 ? (
                      <div className="remaining-matchups">
                        {score.remainingMatchups.map((matchup, mIdx) => (
                          <div key={mIdx} className="remaining-matchup">
                            <span className="matchup-players">
                              {matchup.player.name} ({matchup.player.rating}) vs {matchup.opponent.name} ({matchup.opponent.rating})
                            </span>
                            <span className="matchup-winprob">{(matchup.winProb * 100).toFixed(1)}%</span>
                            <span className="matchup-race">{matchup.race}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-remaining">No valid remaining matchups found</div>
                    )}
                  </div>

                  <div className="blind-player-stats">
                    <div className="stat">
                      <strong>Total Win Prob:</strong> {(score.totalWinProb * 100).toFixed(1)}% ({(score.avgWinProb * 100).toFixed(1)}% avg)
                    </div>
                    <div className="stat">
                      <strong>Blind Match:</strong> {(score.blindMatchWinProb * 100).toFixed(1)}%
                    </div>
                    <div className="stat">
                      <strong>Remaining Lineup:</strong> {(score.remainingLineupWinProb * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlindPlayerSelector;

