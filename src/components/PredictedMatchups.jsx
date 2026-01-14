import React, { useMemo, useState } from 'react';
import { extractProbability, combinations, permutations } from '../utils';

const MINIMUM_WINNING_ODDS = 0.6;

/**
 * PredictedMatchups Component
 *
 * PURPOSE:
 * This component predicts the most likely matchups when teams alternate blind picks:
 * 1. Home team throws blind first
 * 2. Away team counter-picks optimally
 * 3. Home team throws blind again
 * 4. Away team counter-picks optimally
 * 5. Continue alternating until 4 matches total
 *
 * ALGORITHM:
 * For each blind pick, select the player that maximizes that team's overall night outcome.
 * This means evaluating each candidate player by:
 * - Simulating the opponent's optimal counter-pick
 * - Calculating the best remaining lineup after that match
 * - Selecting the player that maximizes total win probability for the night
 *
 * KEY CONSTRAINTS:
 * - Players can only play once
 * - Must respect point limits (maxPoints)
 * - Must consider already selected matches
 * - Each team optimizes for their own overall night outcome
 */
function PredictedMatchups({
  team1Name = 'Team 1',
  team2Name = 'Team 2',
  team1Players,
  team2Players,
  matchupData,
  maxPoints = 1900,
  numMatches = 4,
  selectedMatches = [],
  availableTeam1Players = new Set(),
  availableTeam2Players = new Set()
}) {

  /**
   * Calculate best remaining lineup after a set of matches
   * Similar to BlindPlayerSelector's calculateBestRemainingLineup
   */
  const calculateBestRemainingLineup = (
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

    const availableTeam1PlayersFiltered = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam1Indices.has(p.index) && availableTeam1Players.has(p.index));

    const availableTeam2PlayersFiltered = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam2Indices.has(p.index) && availableTeam2Players.has(p.index));

    if (availableTeam1PlayersFiltered.length < remainingMatches || availableTeam2PlayersFiltered.length < remainingMatches) {
      return null;
    }

    const team1Combos = combinations(availableTeam1PlayersFiltered, remainingMatches);
    const validTeam1Combos = team1Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam1Points;
    });

    if (validTeam1Combos.length === 0) {
      return null;
    }

    const team2Combos = combinations(availableTeam2PlayersFiltered, remainingMatches);
    const validTeam2Combos = team2Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam2Points;
    });

    if (validTeam2Combos.length === 0) {
      return null;
    }

    let bestWinProb = -1;
    let bestMatchups = null;

    const firstTeamCombos = teamNumber === 1 ? validTeam1Combos : validTeam2Combos;
    const secondTeamCombos = teamNumber === 1 ? validTeam2Combos : validTeam1Combos;

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

            const winProb = teamNumber === 1 ? prob : (1 - prob);
            totalWinProb += winProb;

            matchups.push({
              playerIndex: teamNumber === 1 ? p1Idx : p2Idx,
              player: teamNumber === 1 ? team1Players[p1Idx] : team2Players[p2Idx],
              opponent: teamNumber === 1 ? team2Players[p2Idx] : team1Players[p1Idx],
              winProb: winProb,
              race: matchup.race
            });
          }

          if (valid && totalWinProb > bestWinProb) {
            bestWinProb = totalWinProb;
            bestMatchups = matchups;
          }
        }
      }
    }

    return bestWinProb >= 0 ? { winProb: bestWinProb, matchups: bestMatchups || [] } : null;
  };

  /**
   * Find the optimal counter-pick for a blind selection
   * Returns the counter-pick that maximizes the counter team's overall night outcome
   */
  const findOptimalCounterPick = (
    blindPlayerIndex,
    blindTeamNumber,
    usedTeam1Indices,
    usedTeam2Indices,
    remainingMatches,
    remainingTeam1Points,
    remainingTeam2Points
  ) => {
    const counterTeamNumber = blindTeamNumber === 1 ? 2 : 1;
    const counterPlayers = counterTeamNumber === 1
      ? team1Players.map((p, i) => ({ ...p, index: i }))
          .filter(p => !usedTeam1Indices.has(p.index) && availableTeam1Players.has(p.index))
      : team2Players.map((p, i) => ({ ...p, index: i }))
          .filter(p => !usedTeam2Indices.has(p.index) && availableTeam2Players.has(p.index));

    const remainingCounterPoints = counterTeamNumber === 1 ? remainingTeam1Points : remainingTeam2Points;

    let bestCounterPick = null;
    let bestOverallWinProb = -1;
    let bestRemainingLineup = null;

    for (const counterPlayer of counterPlayers) {
      if (counterPlayer.rating > remainingCounterPoints) {
        continue;
      }

      // Get matchup data
      const matchup = blindTeamNumber === 1
        ? matchupData[blindPlayerIndex]?.[counterPlayer.index]
        : matchupData[counterPlayer.index]?.[blindPlayerIndex];

      if (!matchup || !matchup.race) {
        continue;
      }

      const prob = extractProbability(matchup.odds);
      if (prob === null) {
        continue;
      }

      // Calculate win probability from counter team's perspective
      const counterMatchWinProb = counterTeamNumber === 1 ? prob : (1 - prob);

      // Calculate remaining lineup after this match
      const newRemainingMatches = remainingMatches - 1;
      const newUsedTeam1Indices = blindTeamNumber === 1
        ? new Set([...usedTeam1Indices, blindPlayerIndex])
        : new Set([...usedTeam1Indices, counterPlayer.index]);
      const newUsedTeam2Indices = blindTeamNumber === 1
        ? new Set([...usedTeam2Indices, counterPlayer.index])
        : new Set([...usedTeam2Indices, blindPlayerIndex]);

      const newRemainingTeam1Points = blindTeamNumber === 1
        ? remainingTeam1Points - team1Players[blindPlayerIndex].rating
        : remainingTeam1Points - counterPlayer.rating;
      const newRemainingTeam2Points = blindTeamNumber === 1
        ? remainingTeam2Points - counterPlayer.rating
        : remainingTeam2Points - team2Players[blindPlayerIndex].rating;

      const remainingLineup = calculateBestRemainingLineup(
        newUsedTeam1Indices,
        newUsedTeam2Indices,
        newRemainingMatches,
        newRemainingTeam1Points,
        newRemainingTeam2Points,
        counterTeamNumber
      );

      if (!remainingLineup) {
        continue;
      }

      // Total win probability for counter team's night
      const overallWinProb = counterMatchWinProb + remainingLineup.winProb;

      if (overallWinProb > bestOverallWinProb) {
        bestOverallWinProb = overallWinProb;
        bestCounterPick = counterPlayer;
        bestRemainingLineup = remainingLineup;
      }
    }

    if (!bestCounterPick) {
      return null;
    }

    // Get matchup data for the best counter-pick
    const matchup = blindTeamNumber === 1
      ? matchupData[blindPlayerIndex]?.[bestCounterPick.index]
      : matchupData[bestCounterPick.index]?.[blindPlayerIndex];

    return {
      counterPick: bestCounterPick,
      matchWinProb: counterTeamNumber === 1
        ? extractProbability(matchup.odds)
        : (1 - extractProbability(matchup.odds)),
      overallWinProb: bestOverallWinProb,
      remainingLineup: bestRemainingLineup,
      race: matchup.race
    };
  };

  /**
   * Find the best blind pick for a team
   * Returns the player that maximizes that team's overall night outcome
   */
  const findBestBlindPick = (
    blindTeamNumber,
    usedTeam1Indices,
    usedTeam2Indices,
    remainingMatches,
    remainingTeam1Points,
    remainingTeam2Points
  ) => {
    const blindPlayers = blindTeamNumber === 1
      ? team1Players.map((p, i) => ({ ...p, index: i }))
          .filter(p => !usedTeam1Indices.has(p.index) && availableTeam1Players.has(p.index))
      : team2Players.map((p, i) => ({ ...p, index: i }))
          .filter(p => !usedTeam2Indices.has(p.index) && availableTeam2Players.has(p.index));

    const remainingBlindPoints = blindTeamNumber === 1 ? remainingTeam1Points : remainingTeam2Points;

    let bestBlindPick = null;
    let bestOverallWinProb = -1;
    let bestCounterPickResult = null;

    for (const blindPlayer of blindPlayers) {
      if (blindPlayer.rating > remainingBlindPoints) {
        continue;
      }

      // Find optimal counter-pick
      const counterPickResult = findOptimalCounterPick(
        blindPlayer.index,
        blindTeamNumber,
        usedTeam1Indices,
        usedTeam2Indices,
        remainingMatches,
        remainingTeam1Points,
        remainingTeam2Points
      );

      if (!counterPickResult) {
        continue;
      }

      // Calculate blind match win probability from blind team's perspective
      const matchup = blindTeamNumber === 1
        ? matchupData[blindPlayer.index]?.[counterPickResult.counterPick.index]
        : matchupData[counterPickResult.counterPick.index]?.[blindPlayer.index];

      const prob = extractProbability(matchup.odds);
      if (prob === null) {
        continue;
      }

      const blindMatchWinProb = blindTeamNumber === 1 ? prob : (1 - prob);

      // Calculate remaining lineup for blind team after this match
      const newRemainingMatches = remainingMatches - 1;
      const newUsedTeam1Indices = blindTeamNumber === 1
        ? new Set([...usedTeam1Indices, blindPlayer.index])
        : new Set([...usedTeam1Indices, counterPickResult.counterPick.index]);
      const newUsedTeam2Indices = blindTeamNumber === 1
        ? new Set([...usedTeam2Indices, counterPickResult.counterPick.index])
        : new Set([...usedTeam2Indices, blindPlayer.index]);

      const newRemainingTeam1Points = blindTeamNumber === 1
        ? remainingTeam1Points - blindPlayer.rating
        : remainingTeam1Points - counterPickResult.counterPick.rating;
      const newRemainingTeam2Points = blindTeamNumber === 1
        ? remainingTeam2Points - counterPickResult.counterPick.rating
        : remainingTeam2Points - blindPlayer.rating;

      const blindTeamRemainingLineup = calculateBestRemainingLineup(
        newUsedTeam1Indices,
        newUsedTeam2Indices,
        newRemainingMatches,
        newRemainingTeam1Points,
        newRemainingTeam2Points,
        blindTeamNumber
      );

      if (!blindTeamRemainingLineup) {
        continue;
      }

      // Total win probability for blind team's night
      const overallWinProb = blindMatchWinProb + blindTeamRemainingLineup.winProb;

      if (overallWinProb > bestOverallWinProb) {
        bestOverallWinProb = overallWinProb;
        bestBlindPick = blindPlayer;
        bestCounterPickResult = {
          ...counterPickResult,
          blindMatchWinProb,
          blindTeamRemainingLineup
        };
      }
    }

    if (!bestBlindPick) {
      return null;
    }

    return {
      blindPick: bestBlindPick,
      counterPick: bestCounterPickResult.counterPick,
      blindMatchWinProb: bestCounterPickResult.blindMatchWinProb,
      overallWinProb: bestOverallWinProb,
      remainingLineup: bestCounterPickResult.blindTeamRemainingLineup,
      race: bestCounterPickResult.race
    };
  };

  /**
   * Predict the sequence of matchups
   */
  const predictedMatchups = useMemo(() => {
    if (!team1Players || !team2Players || !matchupData) {
      return null;
    }

    // Start with already selected matches
    const selectedTeam1Indices = new Set(selectedMatches.map(m => m.team1Index));
    const selectedTeam2Indices = new Set(selectedMatches.map(m => m.team2Index));

    const selectedTeam1Points = selectedMatches.reduce((sum, m) => {
      return sum + (team1Players[m.team1Index]?.rating || 0);
    }, 0);

    const selectedTeam2Points = selectedMatches.reduce((sum, m) => {
      return sum + (team2Players[m.team2Index]?.rating || 0);
    }, 0);

    const remainingMatches = numMatches - selectedMatches.length;
    let remainingTeam1Points = maxPoints - selectedTeam1Points;
    let remainingTeam2Points = maxPoints - selectedTeam2Points;

    let currentUsedTeam1Indices = new Set(selectedTeam1Indices);
    let currentUsedTeam2Indices = new Set(selectedTeam2Indices);

    const predicted = [];
    // Away team ALWAYS throws blind first, then alternating
    // Pattern: Away → Home → Away → Home
    let currentBlindTeam = 1; // Always start with away team (team1)

    // Predict matches until we have 4 total (including selected matches)
    for (let i = 0; i < remainingMatches; i++) {
      const result = findBestBlindPick(
        currentBlindTeam,
        currentUsedTeam1Indices,
        currentUsedTeam2Indices,
        remainingMatches - i,
        remainingTeam1Points,
        remainingTeam2Points
      );

      if (!result) {
        // Can't find a valid pick, stop prediction
        break;
      }

      // Record the predicted matchup
      const team1Index = currentBlindTeam === 1 ? result.blindPick.index : result.counterPick.index;
      const team2Index = currentBlindTeam === 1 ? result.counterPick.index : result.blindPick.index;

      // Determine which player was picked blind
      const blindPlayer = currentBlindTeam === 1 ? team1Players[team1Index] : team2Players[team2Index];
      const counterPlayer = currentBlindTeam === 1 ? team2Players[team2Index] : team1Players[team1Index];

      predicted.push({
        matchNumber: selectedMatches.length + i + 1,
        team1Index,
        team2Index,
        team1Player: team1Players[team1Index],
        team2Player: team2Players[team2Index],
        team1WinProb: currentBlindTeam === 1 ? result.blindMatchWinProb : (1 - result.blindMatchWinProb),
        team2WinProb: currentBlindTeam === 1 ? (1 - result.blindMatchWinProb) : result.blindMatchWinProb,
        race: result.race,
        blindTeam: currentBlindTeam === 1 ? team1Name : team2Name,
        blindTeamNumber: currentBlindTeam,
        blindPlayerIndex: currentBlindTeam === 1 ? team1Index : team2Index,
        overallWinProb: result.overallWinProb
      });

      // Update used indices and remaining points
      currentUsedTeam1Indices.add(team1Index);
      currentUsedTeam2Indices.add(team2Index);
      remainingTeam1Points -= team1Players[team1Index].rating;
      remainingTeam2Points -= team2Players[team2Index].rating;

      // Alternate teams for next pick
      currentBlindTeam = currentBlindTeam === 1 ? 2 : 1;
    }

    return predicted;
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches, selectedMatches, availableTeam1Players, availableTeam2Players, team1Name, team2Name]);

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!team1Players || !team2Players || !matchupData) {
    return (
      <div className="predicted-matchups-container">
        <h2>Predicted Matchups</h2>
        <p className="no-predictions">Waiting for matchup data...</p>
      </div>
    );
  }

  if (!predictedMatchups || predictedMatchups.length === 0) {
    return (
      <div className="predicted-matchups-container">
        <h2
          className="collapsible-header"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>Predicted Matchups</span>
          <span style={{ fontSize: '1.2rem', transition: 'transform 0.3s ease', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            ▼
          </span>
        </h2>
        {!isCollapsed && (
          <p className="no-predictions">
            Unable to predict matchups. All matches may be selected, or no valid picks are available.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="predicted-matchups-container">
      <h2
        className="collapsible-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Predicted Matchups</span>
        <span style={{ fontSize: '1.2rem', transition: 'transform 0.3s ease', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          ▼
        </span>
      </h2>
      {!isCollapsed && (
        <>
          <p className="prediction-explanation">
            Predicted sequence of matchups assuming alternating blind picks. Away team ALWAYS throws blind first, then Home team, then alternating (Away → Home → Away → Home).
            Each team selects the player that maximizes their overall night outcome, considering optimal counter-picks.
          </p>
          {predictedMatchups && predictedMatchups.length > 0 && (() => {
            // Calculate win probabilities for selected matches
            let selectedTeam1WinProb = 0;
            let selectedTeam2WinProb = 0;
            let selectedTeam1Wins = 0;
            let selectedTeam2Wins = 0;

            selectedMatches.forEach(match => {
              const matchup = matchupData[match.team1Index]?.[match.team2Index];
              if (matchup) {
                const prob = extractProbability(matchup.odds);
                if (prob !== null) {
                  selectedTeam1WinProb += prob;
                  selectedTeam2WinProb += (1 - prob);
                  if (prob > 0.5) selectedTeam1Wins++;
                  if (prob < 0.5) selectedTeam2Wins++;
                }
              }
            });

            // Calculate overall expectations (selected + predicted)
            const team1TotalWinProb = selectedTeam1WinProb + predictedMatchups.reduce((sum, m) => sum + m.team1WinProb, 0);
            const team2TotalWinProb = selectedTeam2WinProb + predictedMatchups.reduce((sum, m) => sum + m.team2WinProb, 0);
            const team1ExpectedWins = selectedTeam1Wins + predictedMatchups.filter(m => m.team1WinProb > 0.5).length;
            const team2ExpectedWins = selectedTeam2Wins + predictedMatchups.filter(m => m.team2WinProb > 0.5).length;
            const totalMatches = numMatches;
            const team1AvgWinProb = team1TotalWinProb / numMatches;
            const team2AvgWinProb = team2TotalWinProb / numMatches;

            return (
              <div className="prediction-summary">
                <div className="summary-header">Overall Expectation</div>
                <div className="summary-stats">
                  <div className="summary-team">
                    <div className="summary-team-name">{team1Name}</div>
                    <div className="summary-team-stats">
                      <div className="summary-stat">
                        <span className="stat-label">Expected Wins:</span>
                        <span className="stat-value">{team1TotalWinProb.toFixed(2)} / {numMatches}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-label">Matches Won ({'>'}50%):</span>
                        <span className="stat-value">{team1ExpectedWins}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-label">Avg Win %:</span>
                        <span className="stat-value">{(team1AvgWinProb * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="summary-team">
                    <div className="summary-team-name">{team2Name}</div>
                    <div className="summary-team-stats">
                      <div className="summary-stat">
                        <span className="stat-label">Expected Wins:</span>
                        <span className="stat-value">{team2TotalWinProb.toFixed(2)} / {numMatches}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-label">Matches Won ({'>'}50%):</span>
                        <span className="stat-value">{team2ExpectedWins}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-label">Avg Win %:</span>
                        <span className="stat-value">{(team2AvgWinProb * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="predicted-matchups-list">
            {predictedMatchups.map((matchup, idx) => {
              const isTeam1Won = matchup.team1WinProb > 0.5;
              const isTeam2Won = matchup.team2WinProb > 0.5;
              return (
                <div key={idx} className="predicted-matchup-card">
                  <div className="predicted-matchup-header">
                    <span className="match-number">Match {matchup.matchNumber}</span>
                  </div>
                  <div className="predicted-matchup-details">
                    <div className={`predicted-player ${isTeam1Won ? 'match-won' : ''} ${matchup.blindTeamNumber === 1 ? 'blind-pick' : ''}`}>
                      <span className="player-name">
                        {matchup.team1Player.name}
                        {matchup.blindTeamNumber === 1 && <span className="blind-badge"> (Blind)</span>}
                      </span>
                      <span className="player-rating">({matchup.team1Player.rating})</span>
                      <span className={`win-prob ${isTeam1Won ? 'match-won' : ''}`}>
                        {(matchup.team1WinProb * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="vs-divider">vs</div>
                    <div className={`predicted-player ${isTeam2Won ? 'match-won' : ''} ${matchup.blindTeamNumber === 2 ? 'blind-pick' : ''}`}>
                      <span className="player-name">
                        {matchup.team2Player.name}
                        {matchup.blindTeamNumber === 2 && <span className="blind-badge"> (Blind)</span>}
                      </span>
                      <span className="player-rating">({matchup.team2Player.rating})</span>
                      <span className={`win-prob ${isTeam2Won ? 'match-won' : ''}`}>
                        {(matchup.team2WinProb * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="race-info">Race: {matchup.race}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default PredictedMatchups;
