/**
 * API client for FargoRate API
 * Used when deployed to GitHub Pages (no backend server)
 */

import axios from 'axios';

const API_BASE_URL = 'https://lms.fargorate.com/api';

/**
 * Get match information including teams.
 */
export async function getMatch(matchId) {
  const url = `${API_BASE_URL}/matches/${matchId}`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Get list of players for a team.
 */
export async function getTeamPlayers(teamId) {
  const url = `${API_BASE_URL}/teams/${teamId}/players`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Get the closest race for a matchup.
 */
export async function getRacesByLengthAndType(length, typeVal, ratingOne, ratingTwo) {
  const url = `${API_BASE_URL}/ratingcalc/racesbylengthandtype`;
  const params = {
    length: length,
    type: typeVal,
    ratingOne: ratingOne,
    ratingTwo: ratingTwo
  };
  const response = await axios.get(url, { params });
  const races = response.data;

  // Find and return only the race where closest = true
  for (const race of races) {
    if (race.closest === true) {
      return race;
    }
  }

  return null;
}

/**
 * Get odds for a matchup.
 */
export async function getOdds(playerOneRank, playerTwoRank, playerOneRaceTo, playerTwoRaceTo) {
  const url = `${API_BASE_URL}/ratingcalc/odds/${playerOneRank}/${playerTwoRank}/${playerOneRaceTo}/${playerTwoRaceTo}`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Extract player rating from player data.
 */
export function getPlayerRating(player) {
  if (player.rating !== undefined) {
    return parseInt(player.rating);
  } else if (player.fargoRating !== undefined) {
    return parseInt(player.fargoRating);
  } else if (player.fargo !== undefined) {
    return parseInt(player.fargo);
  } else {
    throw new Error(`Could not find rating for player: ${JSON.stringify(player)}`);
  }
}

/**
 * Get matchup data for a match ID (client-side version)
 */
export async function getMatchupData(matchId) {
  const match = await getMatch(matchId);

  const team1Id = match.teamOneId;
  const team2Id = match.teamTwoId;

  const [team1Players, team2Players] = await Promise.all([
    getTeamPlayers(team1Id),
    getTeamPlayers(team2Id)
  ]);

  // Collect matchup data
  const matchupData = [];
  const promises = [];

  for (const p1 of team1Players) {
    for (const p2 of team2Players) {
      promises.push(
        (async () => {
          try {
            const rating1 = getPlayerRating(p1);
            const rating2 = getPlayerRating(p2);

            // Determine race length and type
            let length, typeVal;
            if (rating1 < 400 && rating2 < 400) {
              length = "3";
              typeVal = 2;
            } else {
              length = "4";
              typeVal = 1;
            }

            const race = await getRacesByLengthAndType(length, typeVal, rating1, rating2);

            if (race) {
              const highPlayerRaceTo = race.highPlayerRaceTo;
              const lowPlayerRaceTo = race.lowPlayerRaceTo;

              let p1RaceTo, p2RaceTo;
              if (rating1 >= rating2) {
                p1RaceTo = highPlayerRaceTo;
                p2RaceTo = lowPlayerRaceTo;
              } else {
                p1RaceTo = lowPlayerRaceTo;
                p2RaceTo = highPlayerRaceTo;
              }

              try {
                const odds = await getOdds(rating1, rating2, p1RaceTo, p2RaceTo);
                return {
                  race: `${p1RaceTo}-${p2RaceTo}`,
                  odds: odds,
                  rating1,
                  rating2
                };
              } catch (error) {
                return {
                  race: `${p1RaceTo}-${p2RaceTo}`,
                  odds: { error: error.message },
                  rating1,
                  rating2
                };
              }
            } else {
              return { race: null, odds: null, rating1, rating2 };
            }
          } catch (error) {
            return { race: "Error", odds: { error: error.message }, rating1: null, rating2: null };
          }
        })()
      );
    }
  }

  // Wait for all promises
  const results = await Promise.all(promises);
  let resultIndex = 0;

  for (let i = 0; i < team1Players.length; i++) {
    const row = [];
    for (let j = 0; j < team2Players.length; j++) {
      row.push(results[resultIndex++]);
    }
    matchupData.push(row);
  }

  return {
    team1Players: team1Players.map(p => ({
      id: p.id,
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      rating: getPlayerRating(p)
    })),
    team2Players: team2Players.map(p => ({
      id: p.id,
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      rating: getPlayerRating(p)
    })),
    matchupData
  };
}

