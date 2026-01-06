import React, { useMemo } from 'react';
import './OptimalLineups.css';

function OptimalLineups({ team1Players, team2Players, matchupData, maxPoints = 1900, numMatches = 4 }) {
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

  // Generate all possible lineups
  const generateLineups = useMemo(() => {
    // Find optimal matching for a given set of players (prioritizing win probability)
    const findOptimalMatching = (team1Selection, team2Selection) => {
      // Generate all possible matchings (permutations of team2 against team1)
      const team2Perms = permutations(team2Selection);
      let bestMatching = null;
      let bestWinProb = -1;

      for (const team2Perm of team2Perms) {
        const matchups = [];
        let totalWinProb = 0;
        let valid = true;

        for (let i = 0; i < team1Selection.length; i++) {
          const p1Idx = team1Selection[i].index;
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

          const p1Rating = team1Players[p1Idx].rating;
          const p2Rating = team2Players[p2Idx].rating;
          const points = p1Rating + p2Rating;

          matchups.push({
            team1Player: team1Players[p1Idx],
            team2Player: team2Players[p2Idx],
            race: matchup.race,
            winProb: prob,
            points: points
          });

          totalWinProb += prob;
        }

        if (valid && totalWinProb > bestWinProb) {
          bestWinProb = totalWinProb;
          const team1TotalPoints = team1Selection.reduce((sum, p) => sum + p.rating, 0);
          const team2TotalPoints = team2Selection.reduce((sum, p) => sum + p.rating, 0);

          bestMatching = {
            matchups,
            team1Points: team1TotalPoints,
            team2Points: team2TotalPoints,
            totalPoints: team1TotalPoints + team2TotalPoints,
            totalWinProb,
            avgWinProb: totalWinProb / numMatches
          };
        }
      }

      return bestMatching;
    };
    if (!team1Players || !team2Players || !matchupData) {
      return [];
    }

    // Check if we have enough players
    if (team1Players.length < numMatches || team2Players.length < numMatches) {
      console.log(`Not enough players: Team 1 has ${team1Players.length}, Team 2 has ${team2Players.length}, need ${numMatches} each`);
      return [];
    }

    const lineups = [];

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

    console.log(`Team 1: ${team1Players.length} players, ${validTeam1Combinations.length} valid combinations (<=${maxPoints} points)`);
    console.log(`Team 2: ${team2Players.length} players, ${validTeam2Combinations.length} valid combinations (<=${maxPoints} points)`);
    console.log(`Total combinations to check: ${validTeam1Combinations.length * validTeam2Combinations.length}`);

    console.log(`Team 1: ${team1Players.length} players, ${team1Combinations.length} combinations of ${numMatches}`);
    console.log(`Team 2: ${team2Players.length} players, ${team2Combinations.length} combinations of ${numMatches}`);
    console.log(`Total combinations to check: ${team1Combinations.length * team2Combinations.length}`);

    // For each valid combination of team selections, find optimal matching
    for (const team1Selection of validTeam1Combinations) {
      for (const team2Selection of validTeam2Combinations) {
        const matching = findOptimalMatching(team1Selection, team2Selection);
        if (matching) {
          lineups.push(matching);
        }
      }
    }

    console.log(`Found ${lineups.length} valid lineups`);

    // Sort by total win probability (descending)
    return lineups.sort((a, b) => b.totalWinProb - a.totalWinProb).slice(0, 10);
  }, [team1Players, team2Players, matchupData, maxPoints, numMatches]);

  if (!team1Players || !team2Players || !matchupData) {
    return (
      <div className="optimal-lineups-container">
        <h2>Optimal Lineups</h2>
        <p className="no-lineups">Waiting for matchup data...</p>
      </div>
    );
  }

  if (generateLineups.length === 0) {
    return (
      <div className="optimal-lineups-container">
        <h2>Optimal Lineups</h2>
        <p className="no-lineups">
          No valid lineups found within the constraints.
          <br />
          <small>
            Requirements: {numMatches} matches, max {maxPoints} points per team.
            <br />
            Team 1: {team1Players.length} players, Team 2: {team2Players.length} players.
            <br />
            Check the browser console for debugging information.
          </small>
        </p>
      </div>
    );
  }

  return (
    <div className="optimal-lineups-container">
      <h2>Top Optimal Lineups</h2>
      <p className="lineup-constraints">
        Max {maxPoints} points per team across {numMatches} matches
      </p>

      <div className="lineups-list">
        {generateLineups.map((lineup, idx) => (
          <div key={idx} className="lineup-card">
            <div className="lineup-header">
              <span className="lineup-rank">#{idx + 1}</span>
              <div className="lineup-stats">
                <span className="stat">
                  <strong>Total Win Prob:</strong> {(lineup.totalWinProb * 100).toFixed(1)}%
                </span>
                <span className="stat">
                  <strong>Avg Win Prob:</strong> {(lineup.avgWinProb * 100).toFixed(1)}%
                </span>
                <span className="stat">
                  <strong>Team 1 Points:</strong> {lineup.team1Points} / {maxPoints}
                </span>
                <span className="stat">
                  <strong>Team 2 Points:</strong> {lineup.team2Points} / {maxPoints}
                </span>
              </div>
            </div>

            <div className="matchups-list">
              {lineup.matchups.map((matchup, mIdx) => (
                <div key={mIdx} className="matchup-item">
                  <div className="matchup-players">
                    <span className="player-name">
                      {matchup.team1Player.name} ({matchup.team1Player.rating})
                    </span>
                    <span className="vs">vs</span>
                    <span className="player-name">
                      {matchup.team2Player.name} ({matchup.team2Player.rating})
                    </span>
                  </div>
                  <div className="matchup-details">
                    <span className="race">Race: {matchup.race}</span>
                    <span className={`win-prob ${matchup.winProb > 0.5 ? 'bold' : ''}`}>
                      Win Prob: {(matchup.winProb * 100).toFixed(1)}%
                    </span>
                    <span className="points">Points: {matchup.points}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OptimalLineups;

