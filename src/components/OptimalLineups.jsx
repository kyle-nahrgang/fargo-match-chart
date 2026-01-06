import React, { useMemo } from 'react';
import './OptimalLineups.css';

function OptimalLineups({ team1Name = 'Team 1', team2Name = 'Team 2', team1Players, team2Players, matchupData, maxPoints = 1900, numMatches = 4 }) {
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

  // Generate optimal lineups for each team separately
  const generateTeamLineups = useMemo(() => {
    if (!team1Players || !team2Players || !matchupData) {
      return { team1Lineups: [], team2Lineups: [] };
    }

    // Check if we have enough players
    if (team1Players.length < numMatches || team2Players.length < numMatches) {
      console.log(`Not enough players: ${team1Name} has ${team1Players.length}, ${team2Name} has ${team2Players.length}, need ${numMatches} each`);
      return { team1Lineups: [], team2Lineups: [] };
    }

    // Create arrays with indices for easier combination generation
    const team1WithIndices = team1Players.map((p, i) => ({ ...p, index: i }));
    const team2WithIndices = team2Players.map((p, i) => ({ ...p, index: i }));

    // Generate all combinations of 4 players from each team
    const team1Combinations = combinations(team1WithIndices, numMatches);
    const team2Combinations = combinations(team2WithIndices, numMatches);

    // Filter combinations to only those that meet the point constraint per team
    const validTeam1Combinations = team1Combinations.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= maxPoints;
    });

    const validTeam2Combinations = team2Combinations.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= maxPoints;
    });

    // Calculate best matchup win probability for each team's lineup
    const calculateBestMatchupWinProb = (teamSelection, isTeam1) => {
      let bestTotalWinProb = -1;
      let bestMatchups = null;

      // Try against all valid combinations of the opposing team
      const opposingCombinations = isTeam1 ? validTeam2Combinations : validTeam1Combinations;

      for (const opposingSelection of opposingCombinations) {
        const team2Perms = permutations(opposingSelection);
        let bestPermWinProb = -1;
        let bestPermMatchups = null;

        for (const team2Perm of team2Perms) {
          const matchups = [];
          let totalWinProb = 0;
          let valid = true;

          for (let i = 0; i < teamSelection.length; i++) {
            const p1Idx = isTeam1 ? teamSelection[i].index : team2Perm[i].index;
            const p2Idx = isTeam1 ? team2Perm[i].index : teamSelection[i].index;
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

            // For team 1, use the win prob as-is; for team 2, use inverse
            const winProb = isTeam1 ? prob : (1 - prob);
            totalWinProb += winProb;

            // Store matchup info - map by index for easier lookup
            const teamPlayer = isTeam1 ? team1Players[p1Idx] : team2Players[p2Idx];
            const opponentPlayer = isTeam1 ? team2Players[p2Idx] : team1Players[p1Idx];
            const playerIndex = isTeam1 ? p1Idx : p2Idx;

            matchups.push({
              playerIndex: playerIndex,
              player: teamPlayer,
              opponent: opponentPlayer,
              winProb: winProb,
              race: matchup.race
            });
          }

          if (valid && totalWinProb > bestPermWinProb) {
            bestPermWinProb = totalWinProb;
            bestPermMatchups = matchups;
          }
        }

        if (bestPermWinProb > bestTotalWinProb) {
          bestTotalWinProb = bestPermWinProb;
          bestMatchups = bestPermMatchups;
        }
      }

      return bestTotalWinProb >= 0 ? { winProb: bestTotalWinProb, matchups: bestMatchups } : null;
    };

    // Generate Team 1 lineups
    const team1Lineups = validTeam1Combinations.map(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      const result = calculateBestMatchupWinProb(combo, true);

      return {
        players: combo.map(p => team1Players[p.index]),
        totalPoints,
        bestWinProb: result ? result.winProb : 0,
        avgWinProb: result ? result.winProb / numMatches : 0,
        matchups: result ? result.matchups : []
      };
    }).filter(lineup => lineup.bestWinProb > 0)
      .sort((a, b) => b.bestWinProb - a.bestWinProb)
      .slice(0, 10);

    // Generate team 2 lineups
    const team2Lineups = validTeam2Combinations.map(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      const result = calculateBestMatchupWinProb(combo, false);

      return {
        players: combo.map(p => team2Players[p.index]),
        totalPoints,
        bestWinProb: result ? result.winProb : 0,
        avgWinProb: result ? result.winProb / numMatches : 0,
        matchups: result ? result.matchups : []
      };
    }).filter(lineup => lineup.bestWinProb > 0)
      .sort((a, b) => b.bestWinProb - a.bestWinProb)
      .slice(0, 10);

    return { team1Lineups, team2Lineups };
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches]);

  if (!team1Players || !team2Players || !matchupData) {
    return (
      <div className="optimal-lineups-container">
        <h2>Optimal Lineups</h2>
        <p className="no-lineups">Waiting for matchup data...</p>
      </div>
    );
  }

  const { team1Lineups, team2Lineups } = generateTeamLineups;

  if (team1Lineups.length === 0 && team2Lineups.length === 0) {
    return (
      <div className="optimal-lineups-container">
        <h2>Optimal Lineups</h2>
        <p className="no-lineups">
          No valid lineups found within the constraints.
          <br />
          <small>
            Requirements: {numMatches} matches, max {maxPoints} points per team.
            <br />
            {team1Name}: {team1Players.length} players, {team2Name}: {team2Players.length} players.
            <br />
            Check the browser console for debugging information.
          </small>
        </p>
      </div>
    );
  }

  return (
    <div className="optimal-lineups-container">
      <h2>Optimal Lineups</h2>
      <p className="lineup-constraints">
        Max {maxPoints} points per team across {numMatches} matches
      </p>

      <div className="lineups-columns">
        <div className="lineup-column">
          <h3>{team1Name}</h3>
          {team1Lineups.length === 0 ? (
            <p className="no-lineups">No valid lineups found for {team1Name}</p>
          ) : (
            <div className="lineups-list">
              {team1Lineups.map((lineup, idx) => (
                <div key={idx} className="lineup-card">
                  <div className="lineup-header">
                    <span className="lineup-rank">#{idx + 1}</span>
                    <div className="lineup-stats">
                      <span className="stat">
                        <strong>Best Win Prob:</strong> {(lineup.bestWinProb * 100).toFixed(1)}%
                      </span>
                      <span className="stat">
                        <strong>Avg Win Prob:</strong> {(lineup.avgWinProb * 100).toFixed(1)}%
                      </span>
                      <span className="stat">
                        <strong>Total Points:</strong> {lineup.totalPoints} / {maxPoints}
                      </span>
                    </div>
                  </div>

                  <div className="players-list">
                    {lineup.players.map((player, pIdx) => {
                      // Find matchup by index position (players are in same order as matchups)
                      const matchup = lineup.matchups[pIdx];
                      return (
                        <div key={pIdx} className="player-item">
                          <div className="player-info">
                            <span className="player-name">{player.name}</span>
                            <span className="player-rating">Rating: {player.rating}</span>
                          </div>
                          {matchup && (
                            <div className="matchup-info">
                              <span className="vs-label">vs</span>
                              <span className="opponent-name">{matchup.opponent.name}</span>
                              <span className="opponent-rating">({matchup.opponent.rating})</span>
                              <span className="matchup-winprob">{(matchup.winProb * 100).toFixed(1)}%</span>
                              <span className="matchup-race">{matchup.race}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lineup-column">
          <h3>{team2Name}</h3>
          {team2Lineups.length === 0 ? (
            <p className="no-lineups">No valid lineups found for {team2Name}</p>
          ) : (
            <div className="lineups-list">
              {team2Lineups.map((lineup, idx) => (
                <div key={idx} className="lineup-card">
                  <div className="lineup-header">
                    <span className="lineup-rank">#{idx + 1}</span>
                    <div className="lineup-stats">
                      <span className="stat">
                        <strong>Best Win Prob:</strong> {(lineup.bestWinProb * 100).toFixed(1)}%
                      </span>
                      <span className="stat">
                        <strong>Avg Win Prob:</strong> {(lineup.avgWinProb * 100).toFixed(1)}%
                      </span>
                      <span className="stat">
                        <strong>Total Points:</strong> {lineup.totalPoints} / {maxPoints}
                      </span>
                    </div>
                  </div>

                  <div className="players-list">
                    {lineup.players.map((player, pIdx) => {
                      // Find matchup by index position (players are in same order as matchups)
                      const matchup = lineup.matchups[pIdx];
                      return (
                        <div key={pIdx} className="player-item">
                          <div className="player-info">
                            <span className="player-name">{player.name}</span>
                            <span className="player-rating">Rating: {player.rating}</span>
                          </div>
                          {matchup && (
                            <div className="matchup-info">
                              <span className="vs-label">vs</span>
                              <span className="opponent-name">{matchup.opponent.name}</span>
                              <span className="opponent-rating">({matchup.opponent.rating})</span>
                              <span className="matchup-winprob">{(matchup.winProb * 100).toFixed(1)}%</span>
                              <span className="matchup-race">{matchup.race}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
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

export default OptimalLineups;

