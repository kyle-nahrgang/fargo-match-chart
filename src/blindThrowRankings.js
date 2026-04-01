import { extractProbability, combinations, permutations } from './utils';

export const MINIMUM_WINNING_ODDS = 0.6;

/**
 * Best remaining lineup after a blind pick (max total win probability for teamNumber).
 */
export function calculateBestRemainingLineup(
  {
    team1Players,
    team2Players,
    matchupData,
    availableTeam1Players,
    availableTeam2Players
  },
  usedTeam1Indices,
  usedTeam2Indices,
  remainingMatches,
  remainingTeam1Points,
  remainingTeam2Points,
  teamNumber
) {
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
}

/**
 * Ranked blind throw candidates for one team (same ordering as Best Blind Throws UI).
 */
export function getBlindPlayerScores(teamNumber, {
  team1Players,
  team2Players,
  matchupData,
  maxPoints,
  numMatches,
  selectedMatches,
  availableTeam1Players,
  availableTeam2Players,
  lockedOpponentTeam1Index,
  lockedOpponentTeam2Index
}) {
  if (!team1Players || !team2Players || !matchupData) {
    return [];
  }

  const selectedTeam1Indices = new Set(selectedMatches.map(m => m.team1Index));
  const selectedTeam2Indices = new Set(selectedMatches.map(m => m.team2Index));

  const selectedTeam1Points = selectedMatches.reduce((sum, m) => {
    return sum + (team1Players[m.team1Index]?.rating || 0);
  }, 0);

  const selectedTeam2Points = selectedMatches.reduce((sum, m) => {
    return sum + (team2Players[m.team2Index]?.rating || 0);
  }, 0);

  const selectedMatchesWon = selectedMatches.filter(match => {
    const matchup = matchupData[match.team1Index]?.[match.team2Index];
    if (!matchup) return false;
    const prob = extractProbability(matchup.odds);
    if (prob === null) return false;
    const winProb = teamNumber === 1 ? prob : (1 - prob);
    return winProb > 0.5;
  }).length;

  const remainingMatches = numMatches - selectedMatches.length;
  const remainingTeam1Points = maxPoints - selectedTeam1Points;
  const remainingTeam2Points = maxPoints - selectedTeam2Points;

  if (remainingMatches === 0) {
    return [];
  }

  const availableTeam1PlayersFiltered = team1Players
    .map((p, i) => ({ ...p, index: i }))
    .filter(p => !selectedTeam1Indices.has(p.index) && availableTeam1Players.has(p.index));

  const availableTeam2PlayersFiltered = team2Players
    .map((p, i) => ({ ...p, index: i }))
    .filter(p => !selectedTeam2Indices.has(p.index) && availableTeam2Players.has(p.index));

  if (availableTeam1PlayersFiltered.length === 0 || availableTeam2PlayersFiltered.length === 0) {
    return [];
  }

  const blindPlayers = teamNumber === 1 ? availableTeam1PlayersFiltered : availableTeam2PlayersFiltered;
  const counterPlayers = teamNumber === 1 ? availableTeam2PlayersFiltered : availableTeam1PlayersFiltered;
  const remainingBlindPoints = teamNumber === 1 ? remainingTeam1Points : remainingTeam2Points;
  const remainingCounterPoints = teamNumber === 1 ? remainingTeam2Points : remainingTeam1Points;

  const lineupCtx = {
    team1Players,
    team2Players,
    matchupData,
    availableTeam1Players,
    availableTeam2Players
  };

  const blindPlayerScores = [];

  for (const blindPlayer of blindPlayers) {
    const blindPlayerIndex = blindPlayer.index;
    const blindPlayerRating = blindPlayer.rating;

    if (blindPlayerRating > remainingBlindPoints) {
      continue;
    }

    let counterPick = null;
    let counterPickWinProb = null;
    let bestFallbackPick = null;
    let bestFallbackWinProb = teamNumber === 1 ? 1.0 : 0.0;

    const lockedOpponentIndex = teamNumber === 1 ? lockedOpponentTeam2Index : lockedOpponentTeam1Index;
    if (lockedOpponentIndex !== null && lockedOpponentIndex !== undefined) {
      const lockedOpponent = counterPlayers.find(p => p.index === lockedOpponentIndex);
      if (lockedOpponent && lockedOpponent.rating <= remainingCounterPoints) {
        const matchup = teamNumber === 1
          ? matchupData[blindPlayerIndex]?.[lockedOpponentIndex]
          : matchupData[lockedOpponentIndex]?.[blindPlayerIndex];

        if (matchup && matchup.race) {
          const prob = extractProbability(matchup.odds);
          if (prob !== null) {
            counterPick = lockedOpponent;
            counterPickWinProb = teamNumber === 1 ? prob : (1 - prob);
          }
        }
      }
    }

    if (counterPick === null) {
      for (const counterPlayer of counterPlayers) {
        const counterPlayerIndex = counterPlayer.index;
        const counterPlayerRating = counterPlayer.rating;

        if (counterPlayerRating > remainingCounterPoints) {
          continue;
        }

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

        const counterTeamWinProb = teamNumber === 1 ? (1 - prob) : prob;

        if (counterTeamWinProb >= MINIMUM_WINNING_ODDS) {
          if (!counterPick || counterPlayerRating < counterPick.rating) {
            counterPick = counterPlayer;
            counterPickWinProb = teamNumber === 1 ? prob : (1 - prob);
          }
        }

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
    }

    const finalCounterPick = counterPick || bestFallbackPick;
    const blindMatchWinProb = counterPickWinProb !== null
      ? counterPickWinProb
      : (teamNumber === 1 ? bestFallbackWinProb : (1 - bestFallbackWinProb));

    if (!finalCounterPick) {
      continue;
    }

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

    const bestRemaining = calculateBestRemainingLineup(
      lineupCtx,
      newUsedTeam1Indices,
      newUsedTeam2Indices,
      newRemainingMatches,
      newRemainingTeam1Points,
      newRemainingTeam2Points,
      teamNumber
    );

    if (!bestRemaining) {
      continue;
    }

    const blindMatchWon = blindMatchWinProb > MINIMUM_WINNING_ODDS ? 1 : 0;

    const remainingMatchesWon = bestRemaining.matchups.filter(
      matchup => matchup.winProb > 0.5
    ).length;

    const totalMatchesWon = selectedMatchesWon + blindMatchWon + remainingMatchesWon;

    const avgRemainingWinProb = bestRemaining.matchups.length > 0
      ? bestRemaining.matchups.reduce((sum, m) => sum + m.winProb, 0) / bestRemaining.matchups.length
      : 0;

    const totalWinProb = blindMatchWinProb + bestRemaining.winProb;
    const avgWinProb = totalWinProb / numMatches;

    const flexibilityScore = bestRemaining.matchups.length > 0 ? 1 : 0;

    const blindMatchRace = teamNumber === 1
      ? matchupData[blindPlayerIndex]?.[finalCounterPick.index]?.race
      : matchupData[finalCounterPick.index]?.[blindPlayerIndex]?.race;

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

  return blindPlayerScores.sort((a, b) => {
    if (a.totalMatchesWon !== b.totalMatchesWon) {
      return b.totalMatchesWon - a.totalMatchesWon;
    }
    if (Math.abs(a.totalWinProb - b.totalWinProb) > 0.001) {
      return b.totalWinProb - a.totalWinProb;
    }
    return b.flexibilityScore - a.flexibilityScore;
  });
}
