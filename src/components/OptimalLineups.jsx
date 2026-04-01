import React, { useMemo } from 'react';
import { extractProbability, combinations, permutations } from '../utils';

function OptimalLineups({ team1Name = 'Team 1', team2Name = 'Team 2', team1Players, team2Players, matchupData, maxPoints = 1900, numMatches = 4, selectedMatches = [] }) {

  // Generate optimal lineups for each team separately
  const generateTeamLineups = useMemo(() => {
    if (!team1Players || !team2Players || !matchupData) {
      return { team1Lineups: [], team2Lineups: [] };
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

    // Check if we have enough players
    const availableTeam1Players = team1Players.filter((_, i) => !selectedTeam1Indices.has(i));
    const availableTeam2Players = team2Players.filter((_, i) => !selectedTeam2Indices.has(i));

    if (availableTeam1Players.length < remainingMatches || availableTeam2Players.length < remainingMatches) {
      console.log(`Not enough players: ${team1Name} has ${availableTeam1Players.length} available, ${team2Name} has ${availableTeam2Players.length} available, need ${remainingMatches} each`);
      return { team1Lineups: [], team2Lineups: [] };
    }

    // If all matches are selected, return lineups with just selected matches
    if (remainingMatches === 0) {
      const selectedTeam1Players = Array.from(selectedTeam1Indices).map(i => team1Players[i]);
      const selectedTeam2Players = Array.from(selectedTeam2Indices).map(i => team2Players[i]);

      // Calculate win probability for selected matches
      let team1WinProb = 0;
      let team2WinProb = 0;
      const team1Matchups = [];
      const team2Matchups = [];

      selectedMatches.forEach((match, idx) => {
        const matchup = matchupData[match.team1Index]?.[match.team2Index];
        if (matchup) {
          const prob = extractProbability(matchup.odds);
          if (prob !== null) {
            team1WinProb += prob;
            team2WinProb += (1 - prob);
            team1Matchups.push({
              playerIndex: match.team1Index,
              player: team1Players[match.team1Index],
              opponent: team2Players[match.team2Index],
              winProb: prob,
              race: matchup.race
            });
            team2Matchups.push({
              playerIndex: match.team2Index,
              player: team2Players[match.team2Index],
              opponent: team1Players[match.team1Index],
              winProb: 1 - prob,
              race: matchup.race
            });
          }
        }
      });

      return {
        team1Lineups: [{
          players: selectedTeam1Players,
          totalPoints: selectedTeam1Points,
          bestWinProb: team1WinProb,
          avgWinProb: team1WinProb / numMatches,
          matchups: team1Matchups
        }],
        team2Lineups: [{
          players: selectedTeam2Players,
          totalPoints: selectedTeam2Points,
          bestWinProb: team2WinProb,
          avgWinProb: team2WinProb / numMatches,
          matchups: team2Matchups
        }]
      };
    }

    // Create arrays with indices for easier combination generation (excluding selected players)
    const team1WithIndices = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !selectedTeam1Indices.has(p.index));
    const team2WithIndices = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !selectedTeam2Indices.has(p.index));

    // Generate all combinations of remaining players
    const team1Combinations = combinations(team1WithIndices, remainingMatches);
    const team2Combinations = combinations(team2WithIndices, remainingMatches);

    // Filter combinations to only those that meet the remaining point constraint per team
    const validTeam1Combinations = team1Combinations.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam1Points;
    });

    const validTeam2Combinations = team2Combinations.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam2Points;
    });

    // Calculate win probability for selected matches
    const getSelectedMatchupsWinProb = (isTeam1) => {
      let totalWinProb = 0;
      const matchups = [];

      selectedMatches.forEach(match => {
        const matchup = matchupData[match.team1Index]?.[match.team2Index];
        if (matchup) {
          const prob = extractProbability(matchup.odds);
          if (prob !== null) {
            const winProb = isTeam1 ? prob : (1 - prob);
            totalWinProb += winProb;
            matchups.push({
              playerIndex: isTeam1 ? match.team1Index : match.team2Index,
              player: isTeam1 ? team1Players[match.team1Index] : team2Players[match.team2Index],
              opponent: isTeam1 ? team2Players[match.team2Index] : team1Players[match.team1Index],
              winProb: winProb,
              race: matchup.race
            });
          }
        }
      });

      return { winProb: totalWinProb, matchups };
    };

    // Calculate best matchup win probability for each team's lineup
    const calculateBestMatchupWinProb = (teamSelection, isTeam1) => {
      const selectedWinProb = getSelectedMatchupsWinProb(isTeam1);
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
          let totalWinProb = selectedWinProb.winProb;
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
            bestPermMatchups = [...selectedWinProb.matchups, ...matchups];
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
      const comboPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      const totalPoints = selectedTeam1Points + comboPoints;
      const result = calculateBestMatchupWinProb(combo, true);

      // Combine selected players with combo players
      const selectedPlayers = Array.from(selectedTeam1Indices).map(i => team1Players[i]);
      const comboPlayers = combo.map(p => team1Players[p.index]);
      const allPlayers = [...selectedPlayers, ...comboPlayers];

      return {
        players: allPlayers,
        totalPoints,
        bestWinProb: result ? result.winProb : 0,
        avgWinProb: result ? result.winProb / numMatches : 0,
        matchups: result ? result.matchups : []
      };
    }).filter(lineup => lineup.bestWinProb > 0)
      .sort((a, b) => b.bestWinProb - a.bestWinProb)
      .slice(0, 3);

    // Generate team 2 lineups
    const team2Lineups = validTeam2Combinations.map(combo => {
      const comboPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      const totalPoints = selectedTeam2Points + comboPoints;
      const result = calculateBestMatchupWinProb(combo, false);

      // Combine selected players with combo players
      const selectedPlayers = Array.from(selectedTeam2Indices).map(i => team2Players[i]);
      const comboPlayers = combo.map(p => team2Players[p.index]);
      const allPlayers = [...selectedPlayers, ...comboPlayers];

      return {
        players: allPlayers,
        totalPoints,
        bestWinProb: result ? result.winProb : 0,
        avgWinProb: result ? result.winProb / numMatches : 0,
        matchups: result ? result.matchups : []
      };
    }).filter(lineup => lineup.bestWinProb > 0)
      .sort((a, b) => b.bestWinProb - a.bestWinProb)
      .slice(0, 3);

    return { team1Lineups, team2Lineups };
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches, selectedMatches]);

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
                            <span className="player-rating">Robustness: {player.robustness}</span>
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

