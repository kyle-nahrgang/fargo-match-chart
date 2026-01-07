import React, { useMemo } from 'react';
import { extractProbability, combinations, permutations } from '../utils';

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

  // Calculate best remaining lineup after blind pick
  // Finds the best possible outcome for the specified team (teamNumber: 1 or 2)
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

    // Find best possible outcome for the specified team: maximize win probability across all valid combinations
    let bestWinProb = -1;
    let bestMatchups = null;

    // Determine which team's combinations to iterate first based on perspective
    const firstTeamCombos = teamNumber === 1 ? validTeam1Combos : validTeam2Combos;
    const secondTeamCombos = teamNumber === 1 ? validTeam2Combos : validTeam1Combos;

    // Try all combinations and find the best possible matchups
    for (const firstTeamCombo of firstTeamCombos) {
      for (const secondTeamCombo of secondTeamCombos) {
        const secondTeamPerms = permutations(secondTeamCombo);

        for (const secondTeamPerm of secondTeamPerms) {
          const matchups = [];
          let totalWinProb = 0;
          let valid = true;

          for (let i = 0; i < firstTeamCombo.length; i++) {
            const p1Idx = teamNumber === 1 ? firstTeamCombo[i].index : secondTeamPerm[i].index;
            const p2Idx = teamNumber === 1 ? secondTeamPerm[i].index : firstTeamCombo[i].index;
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

            // Calculate win probability from the specified team's perspective
            const winProb = teamNumber === 1 ? prob : (1 - prob);
            totalWinProb += winProb;

            // Build matchup object with the correct team as "player"
            matchups.push({
              playerIndex: teamNumber === 1 ? p1Idx : p2Idx,
              player: teamNumber === 1 ? team1Players[p1Idx] : team2Players[p2Idx],
              opponent: teamNumber === 1 ? team2Players[p2Idx] : team1Players[p1Idx],
              winProb: winProb,
              race: matchup.race
            });
          }

          // Track the best possible outcome for the specified team
          if (valid && totalWinProb > bestWinProb) {
            bestWinProb = totalWinProb;
            bestMatchups = matchups;
          }
        }
      }
    }

    return bestWinProb >= 0 ? { winProb: bestWinProb, matchups: bestMatchups || [] } : null;
  };

  // Calculate blind player scores for the specified team (teamNumber: 1 or 2)
  const calculateBlindPlayerScores = useMemo(() => {
    return (teamNumber) => {
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

      // Determine which team's players to iterate (blind players) and which to counter-pick from
      const blindPlayers = teamNumber === 1 ? availableTeam1Players : availableTeam2Players;
      const counterPlayers = teamNumber === 1 ? availableTeam2Players : availableTeam1Players;
      const remainingBlindPoints = teamNumber === 1 ? remainingTeam1Points : remainingTeam2Points;
      const remainingCounterPoints = teamNumber === 1 ? remainingTeam2Points : remainingTeam1Points;

      const blindPlayerScores = [];
      const REASONABLE_WIN_THRESHOLD = 0.6;

      // For each available blind player, simulate them being picked blind
      for (const blindPlayer of blindPlayers) {
        const blindPlayerIndex = blindPlayer.index;
        const blindPlayerRating = blindPlayer.rating;

        // Check if picking this player would exceed point limit
        if (blindPlayerRating > remainingBlindPoints) {
          continue;
        }

        // Find counter-pick: lowest-rated player with >= 60% win probability (from counter team's perspective)
        // If no player has >= 60%, fall back to best counter-pick
        let counterPick = null;
        let counterPickWinProb = null;
        let bestFallbackPick = null;
        // For Team 1: worst case is highest prob (1.0), for Team 2: worst case is lowest prob (0.0)
        let bestFallbackWinProb = teamNumber === 1 ? 1.0 : 0.0;

        for (const counterPlayer of counterPlayers) {
          const counterPlayerIndex = counterPlayer.index;
          const counterPlayerRating = counterPlayer.rating;

          // Check if counter-pick would exceed point limit
          if (counterPlayerRating > remainingCounterPoints) {
            continue;
          }

          // Get matchup data - order depends on which team is blind picking
          const matchup = teamNumber === 1
            ? matchupData[blindPlayerIndex]?.[counterPlayerIndex]
            : matchupData[counterPlayerIndex]?.[blindPlayerIndex];

          if (!matchup || !matchup.race) {
            continue;
          }

          const prob = extractProbability(matchup.odds);
          if (prob === null) {
            continue;
          }

          // Calculate win probability from counter team's perspective
          const counterTeamWinProb = teamNumber === 1 ? (1 - prob) : prob;

          // Check if this player meets the reasonable win threshold
          if (counterTeamWinProb >= REASONABLE_WIN_THRESHOLD) {
            // If we haven't found a counter-pick yet, or this one has a lower rating
            if (!counterPick || counterPlayerRating < counterPick.rating) {
              counterPick = counterPlayer;
              // Store win prob from blind team's perspective
              counterPickWinProb = teamNumber === 1 ? prob : (1 - prob);
            }
          }

          // Track best fallback based on blind team's perspective
          // For Team 1: want lowest prob (worst case), for Team 2: want highest prob (worst case for Team 2)
          const blindTeamWinProb = teamNumber === 1 ? prob : (1 - prob);
          if (teamNumber === 1) {
            if (prob < bestFallbackWinProb) {
              bestFallbackWinProb = prob;
              bestFallbackPick = counterPlayer;
            }
          } else {
            if (prob > bestFallbackWinProb) {
              bestFallbackWinProb = prob;
              bestFallbackPick = counterPlayer;
            }
          }
        }

        // Use counter-pick if found, otherwise use fallback
        const finalCounterPick = counterPick || bestFallbackPick;
        const blindMatchWinProb = counterPickWinProb !== null
          ? counterPickWinProb
          : (teamNumber === 1 ? bestFallbackWinProb : (1 - bestFallbackWinProb));

        if (!finalCounterPick) {
          continue; // No valid counter-pick found
        }

        // Now calculate best remaining lineup after this blind match
        const newRemainingMatches = remainingMatches - 1;
        const newRemainingTeam1Points = teamNumber === 1
          ? remainingTeam1Points - blindPlayerRating
          : remainingTeam1Points - finalCounterPick.rating;
        const newRemainingTeam2Points = teamNumber === 1
          ? remainingTeam2Points - finalCounterPick.rating
          : remainingTeam2Points - blindPlayerRating;

        const newUsedTeam1Indices = teamNumber === 1
          ? new Set([...selectedTeam1Indices, blindPlayerIndex])
          : new Set([...selectedTeam1Indices, finalCounterPick.index]);
        const newUsedTeam2Indices = teamNumber === 1
          ? new Set([...selectedTeam2Indices, finalCounterPick.index])
          : new Set([...selectedTeam2Indices, blindPlayerIndex]);

        const blindTeam1Index = teamNumber === 1 ? blindPlayerIndex : finalCounterPick.index;
        const blindTeam2Index = teamNumber === 1 ? finalCounterPick.index : blindPlayerIndex;

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

        if (!bestRemaining) {
          continue; // No valid remaining lineup
        }

        // Calculate overall score
        const totalWinProb = blindMatchWinProb + bestRemaining.winProb;
        const avgWinProb = totalWinProb / numMatches;

        const flexibilityScore = bestRemaining.matchups.length > 0 ? 1 : 0;

        // Get matchup race for display
        const blindMatchRace = teamNumber === 1
          ? matchupData[blindPlayerIndex]?.[finalCounterPick.index]?.race
          : matchupData[finalCounterPick.index]?.[blindPlayerIndex]?.race;

        blindPlayerScores.push({
          player: blindPlayer,
          counterPick: finalCounterPick,
          blindMatchWinProb: blindMatchWinProb,
          remainingLineupWinProb: bestRemaining.winProb,
          totalWinProb,
          avgWinProb,
          flexibilityScore,
          remainingMatchups: bestRemaining.matchups,
          blindMatchRace: blindMatchRace
        });
      }

      // Sort by total win probability (descending), then by flexibility
      return blindPlayerScores.sort((a, b) => {
        if (Math.abs(a.totalWinProb - b.totalWinProb) < 0.001) {
          return b.flexibilityScore - a.flexibilityScore;
        }
        return b.totalWinProb - a.totalWinProb;
      });
    };
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches, selectedMatches]);

  if (!team1Players || !team2Players || !matchupData) {
    return (
      <div className="blind-player-selector-container">
        <h2>Best Blind Players</h2>
        <p className="no-blind-players">Waiting for matchup data...</p>
      </div>
    );
  }

  const blindPlayerScoresTeam1 = calculateBlindPlayerScores(1);
  const blindPlayerScoresTeam2 = calculateBlindPlayerScores(2);

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

