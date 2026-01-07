import React, { useMemo } from 'react';
import { extractProbability, combinations, permutations } from '../utils';

const MINIMUM_WINNING_ODDS = 0.6;

// Reusable component for blind match section
function BlindMatchSection({ score }) {
  return (
    <div className="blind-match-section">
      <div className="section-title">Blind Match (Worst Case Counter-Pick)</div>
      <div className="matchup-details">
        <span className="player-vs">
          {score.player.name} ({score.player.rating}) vs {score.counterPick.name} ({score.counterPick.rating})
        </span>
        <span className="matchup-stats">
          <span className={`win-prob ${score.blindMatchWinProb > MINIMUM_WINNING_ODDS ? 'match-won' : ''}`}>
            Win Prob: {score.blindMatchWinPercent.toFixed(1)}%
            {score.blindMatchWon > 0 && <span className="match-won-badge"> ✓ WON</span>}
          </span>
          <span className="race">Race: {score.blindMatchRace}</span>
        </span>
      </div>
    </div>
  );
}

// Reusable component for remaining lineup section
function RemainingLineupSection({ score, numMatches, selectedMatches }) {
  return (
    <div className="remaining-lineup-section">
      <div className="section-title">
        Best Remaining Lineup ({numMatches - selectedMatches.length - 1} matches)
        {score.remainingMatchesWon > 0 && (
          <span className="matches-won-count"> - {score.remainingMatchesWon} matches won ({'>'}60%)</span>
        )}
      </div>
      {score.remainingMatchups.length > 0 ? (
        <div className="remaining-matchups">
          {score.remainingMatchups.map((matchup, mIdx) => {
            const isWon = matchup.winProb > MINIMUM_WINNING_ODDS;
            return (
              <div key={mIdx} className={`remaining-matchup ${isWon ? 'match-won' : ''}`}>
                <span className="matchup-players">
                  {matchup.player.name} ({matchup.player.rating}) vs {matchup.opponent.name} ({matchup.opponent.rating})
                </span>
                <span className={`matchup-winprob ${isWon ? 'match-won' : ''}`}>
                  {(matchup.winProb * 100).toFixed(1)}%
                  {isWon && <span className="match-won-badge"> ✓</span>}
                </span>
                <span className="matchup-race">{matchup.race}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-remaining">No valid remaining matchups found</div>
      )}
    </div>
  );
}

// Reusable component for blind player stats
function BlindPlayerStats({ score, numMatches, showBlindMatchWinPercent = false }) {
  return (
    <div className="blind-player-stats">
      <div className="stat stat-primary">
        <strong>Projected Matches Won:</strong> {score.totalMatchesWon} / {numMatches}
        <span className="stat-detail">
          {' '}(Selected: {score.selectedMatchesWon}, Blind: {score.blindMatchWon}, Remaining: {score.remainingMatchesWon})
        </span>
      </div>
      {showBlindMatchWinPercent && (
        <div className="stat">
          <strong>Blind Match Win %:</strong> {score.blindMatchWinPercent.toFixed(1)}%
        </div>
      )}
      <div className="stat">
        <strong>Avg Remaining Win %:</strong> {(score.avgRemainingWinProb * 100).toFixed(1)}%
      </div>
      <div className="stat stat-secondary">
        <strong>Total Win Prob:</strong> {(score.totalWinProb * 100).toFixed(1)}% ({(score.avgWinProb * 100).toFixed(1)}% avg)
      </div>
    </div>
  );
}

// Reusable component for blind player card
function BlindPlayerCard({ score, rank, numMatches, selectedMatches }) {
  return (
    <div className="blind-player-card">
      <div className="blind-player-header">
        <span className="blind-player-rank">#{rank}</span>
        <div className="blind-player-info">
          <span className="blind-player-name">{score.player.name}</span>
          <span className="blind-player-rating">Rating: {score.player.rating}</span>
        </div>
      </div>

      <BlindMatchSection score={score} />
      <RemainingLineupSection score={score} numMatches={numMatches} selectedMatches={selectedMatches} />
      <BlindPlayerStats score={score} numMatches={numMatches} />
    </div>
  );
}

// Reusable component for team column
function BlindPlayerColumn({ teamName, scores, numMatches, selectedMatches }) {
  return (
    <div className="blind-players-column">
      <h3>{teamName}</h3>
      {scores.length === 0 ? (
        <p className="no-blind-players">No valid blind players found for {teamName}</p>
      ) : (
        <div className="blind-players-list">
          {scores.slice(0, 3).map((score, idx) => (
            <BlindPlayerCard
              key={idx}
              score={score}
              rank={idx + 1}
              numMatches={numMatches}
              selectedMatches={selectedMatches}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * BlindPlayerSelector Component
 *
 * PURPOSE:
 * This component identifies the best players for each team to pick "blind" - meaning the player
 * is selected without knowing who the opponent will counter-pick. This simulates a common draft
 * scenario where teams alternate picks and need to make strategic decisions.
 *
 * ALGORITHM OVERVIEW:
 *
 * 1. COUNTER-PICK ASSUMPTION:
 *    - We assume the opponent will choose the OPTIMAL counter-pick against our blind selection
 *    - Specifically: the lowest-rated player (to save points) with >= 60% win probability
 *    - If no player meets the 60% threshold, the opponent picks their best counter-pick
 *    - This represents the "worst case" scenario for the blind-picking team
 *
 * 2. SCORING METHODOLOGY:
 *    We focus on MATCHES WON (>60% win probability) rather than total win probability.
 *    A 95% chance to win still only counts as 1 match point, so we prioritize maximizing
 *    the number of matches where we have >60% win probability.
 *
 *    For each potential blind pick, we calculate:
 *    a) Blind Match Win: 1 if win prob >60%, 0 otherwise
 *    b) Remaining Matches Won: Count of remaining matches with >60% win prob
 *    c) Total Matches Won: (a) + (b)
 *    d) Win Percentages: Display win % for blind match and average for remaining matches
 *
 * 3. REMAINING LINEUP CALCULATION:
 *    After simulating the blind match, we find the optimal lineup for remaining matches by:
 *    - Generating all valid player combinations (respecting point limits)
 *    - Testing all possible matchup permutations
 *    - Selecting the combination that maximizes win probability for the blind-picking team
 *
 * 4. RANKING:
 *    Players are ranked by total matches won (>60% win prob) in descending order.
 *    Tiebreakers: (1) Total win probability, (2) Flexibility score
 *
 * KEY INSIGHT:
 * A good blind pick is one that:
 *    - Wins the blind match (>60% win prob) even against optimal counter-picks
 *    - Leaves enough flexibility and points for multiple strong remaining matchups (>60% win prob)
 *    - Maximizes the total number of matches won (>60% win prob) rather than total win probability
 */
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

  /**
   * Calculate best remaining lineup after blind pick
   *
   * PURPOSE:
   * After a blind match is simulated, this function finds the optimal lineup for the remaining
   * matches. It explores all possible player combinations and matchups to maximize win probability.
   *
   * HOW IT WORKS:
   * 1. Filters available players (excluding already-used players)
   * 2. Generates all valid combinations of players for both teams (respecting point limits)
   * 3. For each combination pair, tests all possible matchup permutations
   * 4. Selects the matchup configuration that maximizes win probability for the specified team
   *
   * @param {number} blindTeam1Index - Index of Team 1's blind pick (for tracking, not used in calculation)
   * @param {number} blindTeam2Index - Index of Team 2's blind pick (for tracking, not used in calculation)
   * @param {Set} usedTeam1Indices - Set of Team 1 player indices already used
   * @param {Set} usedTeam2Indices - Set of Team 2 player indices already used
   * @param {number} remainingMatches - Number of matches remaining after blind pick
   * @param {number} remainingTeam1Points - Remaining point budget for Team 1
   * @param {number} remainingTeam2Points - Remaining point budget for Team 2
   * @param {number} teamNumber - Which team's perspective to optimize (1 or 2)
   * @returns {Object|null} - { winProb: number, matchups: Array } or null if no valid lineup
   */
  const calculateBestRemainingLineup = (
    blindTeam1Index,
    blindTeam2Index,
    usedTeam1Indices,
    usedTeam2Indices,
    remainingMatches,
    remainingTeam1Points,
    remainingTeam2Points,
    teamNumber
  ) => {
    // Base case: no remaining matches means no win probability to calculate
    if (remainingMatches === 0) {
      return { winProb: 0, matchups: [] };
    }

    // STEP 1: Filter out players that have already been used
    // We need to find which players are still available for the remaining matches
    const availableTeam1Players = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam1Indices.has(p.index));

    const availableTeam2Players = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam2Indices.has(p.index));

    // Early exit if we don't have enough players for remaining matches
    if (availableTeam1Players.length < remainingMatches || availableTeam2Players.length < remainingMatches) {
      return null;
    }

    // STEP 2: Generate all possible player combinations for Team 1
    // A combination is a set of players that could be used together
    // Example: If we need 2 matches and have players [A, B, C], combinations are [A,B], [A,C], [B,C]
    const team1Combos = combinations(availableTeam1Players, remainingMatches);

    // Filter combinations to only include those that fit within the point budget
    // This ensures we only consider valid lineups that respect the maxPoints constraint
    const validTeam1Combos = team1Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam1Points;
    });

    if (validTeam1Combos.length === 0) {
      return null; // No valid Team 1 combinations found
    }

    // STEP 3: Generate all possible player combinations for Team 2
    // Same process as Team 1 - find all valid player sets that fit the point budget
    const team2Combos = combinations(availableTeam2Players, remainingMatches);
    const validTeam2Combos = team2Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam2Points;
    });

    if (validTeam2Combos.length === 0) {
      return null; // No valid Team 2 combinations found
    }

    // STEP 4: Find the best possible matchup configuration
    // We iterate through all valid combinations and test all possible matchup permutations
    // to find the configuration that maximizes win probability for the specified team
    let bestWinProb = -1;
    let bestMatchups = null;

    // Determine iteration order based on which team's perspective we're optimizing
    // This affects which team's combinations we iterate first (affects performance, not correctness)
    const firstTeamCombos = teamNumber === 1 ? validTeam1Combos : validTeam2Combos;
    const secondTeamCombos = teamNumber === 1 ? validTeam2Combos : validTeam1Combos;

    // STEP 5: Exhaustive search through all valid combinations and matchups
    // For each combination pair, we test all possible ways to match players against each other
    for (const firstTeamCombo of firstTeamCombos) {
      for (const secondTeamCombo of secondTeamCombos) {
        // Generate all permutations of the second team's combination
        // Permutations represent different ways to assign players to match positions
        // Example: If Team 2 has [A, B], permutations are [A,B] and [B,A]
        const secondTeamPerms = permutations(secondTeamCombo);

        // Test each permutation to see which matchup configuration is best
        for (const secondTeamPerm of secondTeamPerms) {
          const matchups = [];
          let totalWinProb = 0;
          let valid = true;

          // Calculate win probability for this specific matchup configuration
          for (let i = 0; i < firstTeamCombo.length; i++) {
            // Determine player indices based on team perspective
            const p1Idx = teamNumber === 1 ? firstTeamCombo[i].index : secondTeamPerm[i].index;
            const p2Idx = teamNumber === 1 ? secondTeamPerm[i].index : firstTeamCombo[i].index;

            // Look up the matchup data for this player pair
            const matchup = matchupData[p1Idx]?.[p2Idx];

            // Validate that matchup data exists and is complete
            if (!matchup || !matchup.race) {
              valid = false;
              break;
            }

            // Extract win probability from betting odds
            const prob = extractProbability(matchup.odds);
            if (prob === null) {
              valid = false;
              break;
            }

            // Convert probability to the specified team's perspective
            // Team 1's win prob is prob, Team 2's win prob is (1 - prob)
            const winProb = teamNumber === 1 ? prob : (1 - prob);
            totalWinProb += winProb;

            // Store matchup information for later display
            matchups.push({
              playerIndex: teamNumber === 1 ? p1Idx : p2Idx,
              player: teamNumber === 1 ? team1Players[p1Idx] : team2Players[p2Idx],
              opponent: teamNumber === 1 ? team2Players[p2Idx] : team1Players[p1Idx],
              winProb: winProb,
              race: matchup.race
            });
          }

          // Track the best configuration found so far
          // We want the configuration that maximizes total win probability
          if (valid && totalWinProb > bestWinProb) {
            bestWinProb = totalWinProb;
            bestMatchups = matchups;
          }
        }
      }
    }

    // Return the best lineup found, or null if no valid lineup exists
    return bestWinProb >= 0 ? { winProb: bestWinProb, matchups: bestMatchups || [] } : null;
  };

  /**
   * Calculate blind player scores for the specified team
   *
   * MAIN ALGORITHM:
   * This is the core function that evaluates each potential blind pick. For each candidate:
   *
   * 1. SIMULATE COUNTER-PICK:
   *    - Find the opponent's optimal counter-pick (lowest-rated player with >= 60% win prob)
   *    - This represents the "worst case" scenario for the blind pick
   *
 * 2. CALCULATE BLIND MATCH SCORE:
 *    - Determine win probability of blind pick vs counter-pick
 *    - Count as "won" if win prob >60% (1 match point), otherwise 0
 *    - Store win percentage for display
 *
 * 3. CALCULATE REMAINING LINEUP SCORE:
 *    - After blind match, find best possible lineup for remaining matches
 *    - Uses exhaustive search to find optimal player combinations and matchups
 *    - Count how many remaining matches have >60% win probability
 *
 * 4. COMBINE SCORES:
 *    - Total Matches Won = Blind Match Won (0 or 1) + Remaining Matches Won (count)
 *    - Also calculate win percentages for display purposes
 *
 * 5. RANK PLAYERS:
 *    - Sort by total matches won (descending)
 *    - Tiebreaker 1: Total win probability
 *    - Tiebreaker 2: Flexibility score
   *
   * @param {number} teamNumber - Which team to calculate scores for (1 or 2)
   * @returns {Array} - Sorted array of blind player scores, best first
   */
  const calculateBlindPlayerScores = useMemo(() => {
    return (teamNumber) => {
      // Early exit if required data is missing
      if (!team1Players || !team2Players || !matchupData) {
        return [];
      }

      // STEP 1: Calculate constraints from already-selected matches
      // Track which players have been used and how many points have been spent
      const selectedTeam1Indices = new Set(selectedMatches.map(m => m.team1Index));
      const selectedTeam2Indices = new Set(selectedMatches.map(m => m.team2Index));

      const selectedTeam1Points = selectedMatches.reduce((sum, m) => {
        return sum + (team1Players[m.team1Index]?.rating || 0);
      }, 0);

      const selectedTeam2Points = selectedMatches.reduce((sum, m) => {
        return sum + (team2Players[m.team2Index]?.rating || 0);
      }, 0);

      // Calculate how many selected matches are "won" (>60% win prob) from this team's perspective
      const selectedMatchesWon = selectedMatches.filter(match => {
        const matchup = matchupData[match.team1Index]?.[match.team2Index];
        if (!matchup) return false;
        const prob = extractProbability(matchup.odds);
        if (prob === null) return false;
        // Calculate win prob from the team's perspective
        const winProb = teamNumber === 1 ? prob : (1 - prob);
        return winProb > 0.5;
      }).length;

      // Calculate remaining resources (matches and points) after selected matches
      const remainingMatches = numMatches - selectedMatches.length;
      const remainingTeam1Points = maxPoints - selectedTeam1Points;
      const remainingTeam2Points = maxPoints - selectedTeam2Points;

      // If all matches are already selected, there are no blind picks to evaluate
      if (remainingMatches === 0) {
        return [];
      }

      // STEP 2: Get list of available players (not yet used in selected matches)
      const availableTeam1Players = team1Players
        .map((p, i) => ({ ...p, index: i }))
        .filter(p => !selectedTeam1Indices.has(p.index));

      const availableTeam2Players = team2Players
        .map((p, i) => ({ ...p, index: i }))
        .filter(p => !selectedTeam2Indices.has(p.index));

      // Early exit if no players available
      if (availableTeam1Players.length === 0 || availableTeam2Players.length === 0) {
        return [];
      }

      // STEP 3: Determine which team's players we're evaluating (blind players)
      // and which team will counter-pick (counter players)
      const blindPlayers = teamNumber === 1 ? availableTeam1Players : availableTeam2Players;
      const counterPlayers = teamNumber === 1 ? availableTeam2Players : availableTeam1Players;
      const remainingBlindPoints = teamNumber === 1 ? remainingTeam1Points : remainingTeam2Points;
      const remainingCounterPoints = teamNumber === 1 ? remainingTeam2Points : remainingTeam1Points;

      const blindPlayerScores = [];

      // STEP 4: Evaluate each potential blind pick
      // For each candidate player, simulate the worst-case counter-pick scenario
      for (const blindPlayer of blindPlayers) {
        const blindPlayerIndex = blindPlayer.index;
        const blindPlayerRating = blindPlayer.rating;

        // STEP 4a: Validate that this blind pick fits within point budget
        // If the player's rating exceeds remaining points, skip them
        if (blindPlayerRating > remainingBlindPoints) {
          continue;
        }

        // STEP 4b: Find the opponent's optimal counter-pick
        // This simulates what the opponent would do in response to our blind pick
        //
        // COUNTER-PICK LOGIC:
        // 1. First, look for players with >= 60% win probability (from counter team's perspective)
        //    Among these, pick the LOWEST-RATED player (to save points for other matches)
        // 2. If no player meets the 60% threshold, fall back to the best counter-pick available
        //    (highest win prob for counter team, which is worst for blind team)
        //
        // This represents the "worst case" scenario - we assume optimal opponent play
        let counterPick = null;              // Best counter-pick meeting threshold
        let counterPickWinProb = null;       // Win prob from blind team's perspective
        let bestFallbackPick = null;         // Best counter-pick if threshold not met
        // Initialize fallback to worst case for blind team
        // Team 1 worst case: opponent has 100% win prob (blind team has 0%)
        // Team 2 worst case: opponent has 0% win prob (blind team has 100%)
        let bestFallbackWinProb = teamNumber === 1 ? 1.0 : 0.0;

        // Evaluate all potential counter-picks
        for (const counterPlayer of counterPlayers) {
          const counterPlayerIndex = counterPlayer.index;
          const counterPlayerRating = counterPlayer.rating;

          // Skip if counter-pick would exceed opponent's point budget
          if (counterPlayerRating > remainingCounterPoints) {
            continue;
          }

          // Get matchup data - order depends on which team is blind picking
          // matchupData is indexed as [team1Index][team2Index]
          const matchup = teamNumber === 1
            ? matchupData[blindPlayerIndex]?.[counterPlayerIndex]
            : matchupData[counterPlayerIndex]?.[blindPlayerIndex];

          // Skip if matchup data is missing or incomplete
          if (!matchup || !matchup.race) {
            continue;
          }

          // Extract win probability from betting odds
          // Note: prob is always from Team 1's perspective (Team 1 vs Team 2)
          const prob = extractProbability(matchup.odds);
          if (prob === null) {
            continue;
          }

          // Calculate win probability from counter team's perspective
          // If Team 1 is blind picking, counter team is Team 2, so their win prob is (1 - prob)
          // If Team 2 is blind picking, counter team is Team 1, so their win prob is prob
          const counterTeamWinProb = teamNumber === 1 ? (1 - prob) : prob;

          // CHECK 1: Does this player meet the reasonable win threshold (>= 60%)?
          // If yes, consider it as a potential counter-pick
          if (counterTeamWinProb >= MINIMUM_WINNING_ODDS) {
            // Among threshold-meeting players, prefer the LOWEST-RATED one
            // This simulates opponent saving points for other matches
            if (!counterPick || counterPlayerRating < counterPick.rating) {
              counterPick = counterPlayer;
              // Store win probability from blind team's perspective for scoring
              counterPickWinProb = teamNumber === 1 ? prob : (1 - prob);
            }
          }

          // CHECK 2: Track best fallback counter-pick (if threshold not met)
          // This is the worst-case scenario for the blind team
          const blindTeamWinProb = teamNumber === 1 ? prob : (1 - prob);
          if (teamNumber === 1) {
            // For Team 1: worst case is lowest win prob (lowest prob value)
            if (prob < bestFallbackWinProb) {
              bestFallbackWinProb = prob;
              bestFallbackPick = counterPlayer;
            }
          } else {
            // For Team 2: worst case is highest Team 1 win prob (highest prob value)
            // because Team 2's win prob = 1 - prob, so higher prob = lower Team 2 win prob
            if (prob > bestFallbackWinProb) {
              bestFallbackWinProb = prob;
              bestFallbackPick = counterPlayer;
            }
          }
        }

        // STEP 4c: Determine final counter-pick and blind match win probability
        // Use threshold counter-pick if found, otherwise use fallback
        const finalCounterPick = counterPick || bestFallbackPick;
        const blindMatchWinProb = counterPickWinProb !== null
          ? counterPickWinProb
          : (teamNumber === 1 ? bestFallbackWinProb : (1 - bestFallbackWinProb));

        // Skip if no valid counter-pick was found (shouldn't happen, but safety check)
        if (!finalCounterPick) {
          continue;
        }

        // STEP 5: Calculate best remaining lineup after this blind match
        // After simulating the blind match, we need to find the optimal lineup for remaining matches
        // This tells us how well the team can perform in the matches AFTER the blind pick

        // Update remaining resources after blind match
        const newRemainingMatches = remainingMatches - 1;
        const newRemainingTeam1Points = teamNumber === 1
          ? remainingTeam1Points - blindPlayerRating
          : remainingTeam1Points - finalCounterPick.rating;
        const newRemainingTeam2Points = teamNumber === 1
          ? remainingTeam2Points - finalCounterPick.rating
          : remainingTeam2Points - blindPlayerRating;

        // Track which players are now used (including blind pick and counter-pick)
        const newUsedTeam1Indices = teamNumber === 1
          ? new Set([...selectedTeam1Indices, blindPlayerIndex])
          : new Set([...selectedTeam1Indices, finalCounterPick.index]);
        const newUsedTeam2Indices = teamNumber === 1
          ? new Set([...selectedTeam2Indices, finalCounterPick.index])
          : new Set([...selectedTeam2Indices, blindPlayerIndex]);

        const blindTeam1Index = teamNumber === 1 ? blindPlayerIndex : finalCounterPick.index;
        const blindTeam2Index = teamNumber === 1 ? finalCounterPick.index : blindPlayerIndex;

        // Find optimal remaining lineup using exhaustive search
        // This function explores all possible player combinations and matchups
        // to find the configuration that maximizes win probability for the blind team
        const bestRemaining = calculateBestRemainingLineup(
          blindTeam1Index,
          blindTeam2Index,
          newUsedTeam1Indices,
          newUsedTeam2Indices,
          newRemainingMatches,
          newRemainingTeam1Points,
          newRemainingTeam2Points,
          teamNumber
        );

        // Skip this blind pick if no valid remaining lineup exists
        // This means picking this player would leave the team in an impossible situation
        if (!bestRemaining) {
          continue;
        }

        // STEP 6: Calculate overall score for this blind pick
        // We focus on MATCHES WON (>60% win probability) rather than total win probability
        // A 95% chance to win still only counts as 1 match point, so we prioritize
        // maximizing the number of matches where we have >60% win probability

        // Count matches won in blind match (1 if >60%, 0 otherwise)
        const blindMatchWon = blindMatchWinProb > MINIMUM_WINNING_ODDS ? 1 : 0;

        const remainingMatchesWon = bestRemaining.matchups.filter(
          // count remaining matches as "won" if over 50%
          matchup => matchup.winProb > 0.5
        ).length;

        // Total matches won = selected matches + blind match + remaining matches won
        const totalMatchesWon = selectedMatchesWon + blindMatchWon + remainingMatchesWon;

        // Calculate average win probability for remaining matches (for display)
        const avgRemainingWinProb = bestRemaining.matchups.length > 0
          ? bestRemaining.matchups.reduce((sum, m) => sum + m.winProb, 0) / bestRemaining.matchups.length
          : 0;

        // Calculate total win probability (for reference, but not primary ranking)
        const totalWinProb = blindMatchWinProb + bestRemaining.winProb;
        const avgWinProb = totalWinProb / numMatches;

        // Flexibility score: indicates whether valid remaining matchups exist
        const flexibilityScore = bestRemaining.matchups.length > 0 ? 1 : 0;

        // Get matchup race information for display purposes
        const blindMatchRace = teamNumber === 1
          ? matchupData[blindPlayerIndex]?.[finalCounterPick.index]?.race
          : matchupData[finalCounterPick.index]?.[blindPlayerIndex]?.race;

        // Store score information for this blind pick candidate
        blindPlayerScores.push({
          player: blindPlayer,
          counterPick: finalCounterPick,
          blindMatchWinProb: blindMatchWinProb,
          blindMatchWinPercent: blindMatchWinProb * 100,
          blindMatchWon: blindMatchWon,
          selectedMatchesWon: selectedMatchesWon,
          remainingLineupWinProb: bestRemaining.winProb,
          remainingMatchesWon: remainingMatchesWon,
          remainingMatchups: bestRemaining.matchups,
          totalMatchesWon: totalMatchesWon,
          totalWinProb,
          avgWinProb,
          avgRemainingWinProb,
          flexibilityScore,
          blindMatchRace: blindMatchRace
        });
      }

      // STEP 7: Rank blind picks by matches won (>60% win probability)
      // Primary ranking: Total matches won (descending)
      // Secondary ranking: Total win probability (descending) - for tiebreaking
      // Tertiary ranking: Flexibility score
      return blindPlayerScores.sort((a, b) => {
        // Primary: Sort by total matches won (descending)
        if (a.totalMatchesWon !== b.totalMatchesWon) {
          return b.totalMatchesWon - a.totalMatchesWon;
        }
        // Secondary: If matches won are equal, use total win probability
        if (Math.abs(a.totalWinProb - b.totalWinProb) > 0.001) {
          return b.totalWinProb - a.totalWinProb;
        }
        // Tertiary: Use flexibility as final tiebreaker
        return b.flexibilityScore - a.flexibilityScore;
      });
    };
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches, selectedMatches]);

  if (!team1Players || !team2Players || !matchupData) {
    return (
      <div className="blind-player-selector-container">
        <h2>Best Blind Throws</h2>
        <p className="no-blind-players">Waiting for matchup data...</p>
      </div>
    );
  }

  const blindPlayerScoresTeam1 = calculateBlindPlayerScores(1);
  const blindPlayerScoresTeam2 = calculateBlindPlayerScores(2);

  if (blindPlayerScoresTeam1.length === 0 && blindPlayerScoresTeam2.length === 0) {
    return (
      <div className="blind-player-selector-container">
        <h2>Best Blind Throws</h2>
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
      <h2>Best Blind Throws</h2>
      <p className="blind-explanation">
        These are the best players for each team to pick "blind" (without knowing who the opponent will counter-pick).
        The algorithm maximizes the number of matches won ({'>'}60% win probability) rather than total win probability.
        A 95% chance to win still only counts as 1 match point, so we prioritize picks that give us more matches with {'>'}60% win probability.
        The algorithm assumes the opponent will choose the lowest-rated player with ≥60% win probability as their counter-pick.
      </p>
      <div className="blind-players-columns">
        <BlindPlayerColumn
          teamName={team1Name}
          scores={blindPlayerScoresTeam1}
          numMatches={numMatches}
          selectedMatches={selectedMatches}
        />
        <BlindPlayerColumn
          teamName={team2Name}
          scores={blindPlayerScoresTeam2}
          numMatches={numMatches}
          selectedMatches={selectedMatches}
        />
      </div>
    </div>
  );
}

export default BlindPlayerSelector;

