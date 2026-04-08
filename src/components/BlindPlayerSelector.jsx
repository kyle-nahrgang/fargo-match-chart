import React, { useMemo } from 'react';
import { MINIMUM_WINNING_ODDS, getBlindPlayerScores } from '../blindThrowRankings';

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
          <span className="blind-player-rating">Robustness: {score.player.robustness}</span>
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
              key={score.player.index}
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
  selectedMatches = [],
  availableTeam1Players = new Set(),
  availableTeam2Players = new Set(),
  lockedTeam1Players = new Set(),
  lockedTeam2Players = new Set(),
  selectedTeam = 'home', // 'home' or 'away'
  lockedOpponentTeam1Index = null, // If set, assume this team1 player will be the opponent
  lockedOpponentTeam2Index = null  // If set, assume this team2 player will be the opponent
}) {

  // Stable signature so memo always recomputes when matchups change (even if array identity were reused).
  const selectedMatchesKey = selectedMatches
    .map(m => `${m.team1Index}-${m.team2Index}`)
    .join('|');

  // Away throws blind on matches 1 & 3, Home on 2 & 4 (same rule as Predicted Matchups).
  const nextBlindTeam = selectedMatches.length % 2 === 0 ? 1 : 2;
  const viewingTeam = selectedTeam === 'home' ? 1 : 2;
  const remainingToSchedule = numMatches - selectedMatches.length;

  const blindPlayerScoresTeam1 = useMemo(
    () => getBlindPlayerScores(1, {
      team1Players,
      team2Players,
      matchupData,
      maxPoints,
      numMatches,
      selectedMatches,
      availableTeam1Players,
      availableTeam2Players,
      lockedTeam1Players,
      lockedTeam2Players,
      lockedOpponentTeam1Index,
      lockedOpponentTeam2Index
    }),
    [
      team1Players,
      team2Players,
      matchupData,
      maxPoints,
      numMatches,
      selectedMatchesKey,
      availableTeam1Players,
      availableTeam2Players,
      lockedTeam1Players,
      lockedTeam2Players,
      lockedOpponentTeam1Index,
      lockedOpponentTeam2Index
    ]
  );

  const blindPlayerScoresTeam2 = useMemo(
    () => getBlindPlayerScores(2, {
      team1Players,
      team2Players,
      matchupData,
      maxPoints,
      numMatches,
      selectedMatches,
      availableTeam1Players,
      availableTeam2Players,
      lockedTeam1Players,
      lockedTeam2Players,
      lockedOpponentTeam1Index,
      lockedOpponentTeam2Index
    }),
    [
      team1Players,
      team2Players,
      matchupData,
      maxPoints,
      numMatches,
      selectedMatchesKey,
      availableTeam1Players,
      availableTeam2Players,
      lockedTeam1Players,
      lockedTeam2Players,
      lockedOpponentTeam1Index,
      lockedOpponentTeam2Index
    ]
  );

  const selectedTeamScores = viewingTeam === 1 ? blindPlayerScoresTeam1 : blindPlayerScoresTeam2;

  if (!team1Players || !team2Players || !matchupData) {
    return (
      <div className="blind-player-selector-container">
        <p className="no-blind-players">Waiting for matchup data...</p>
      </div>
    );
  }

  const selectedTeamName = viewingTeam === 1 ? team1Name : team2Name;
  const nextBlindTeamName = nextBlindTeam === 1 ? team1Name : team2Name;

  if (remainingToSchedule === 0) {
    return (
      <div className="blind-player-selector-container">
        <p className="no-blind-players">
          All {numMatches} matches are set — there is no upcoming blind pick.
        </p>
      </div>
    );
  }

  if (selectedTeamScores.length === 0) {
    return (
      <div className="blind-player-selector-container">
        <p className="no-blind-players">
          No valid blind players found for {selectedTeamName}.
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
      <p className="blind-explanation">
        Next blind pick (by draft order): <strong>{nextBlindTeamName}</strong>.
        <br />
        Below: best players for <strong>{selectedTeamName}</strong> to throw blind given the matches already on the grid — rankings refresh when you add or remove selections.
        The algorithm maximizes the number of matches won ({'>'}60% win probability) rather than total win probability.
        The opponent is assumed to counter with the lowest-rated player with ≥60% win probability as their counter-pick.
      </p>
      {viewingTeam !== nextBlindTeam && (
        <p className="blind-explanation" style={{ marginTop: '-0.5rem', opacity: 0.9 }}>
          You are viewing a hypothetical for {selectedTeamName}; the next blind is {nextBlindTeamName}.
        </p>
      )}
      <div className="blind-players-columns">
        <BlindPlayerColumn
          teamName={selectedTeamName}
          scores={selectedTeamScores}
          numMatches={numMatches}
          selectedMatches={selectedMatches}
        />
      </div>
    </div>
  );
}

export default BlindPlayerSelector;

