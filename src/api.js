/**
 * API client for FargoRate API
 * Used when deployed to GitHub Pages (no backend server)
 */

import axios from 'axios';

const API_BASE_URL = 'https://lms.fargorate.com/api';
const LEAGUE_ID = '570cec8b-dc44-4bfa-a103-b317012291b1';

// https://lms.fargorate.com/api/leagues/570cec8b-dc44-4bfa-a103-b317012291b1/divisions

/**
 * Get list of divisions for the league.
 */
export async function getDivisions() {
  try {
    const url = `${API_BASE_URL}/leagues/${LEAGUE_ID}/divisions`;
    const response = await axios.get(url);
    // Check if response is actually JSON (not HTML error page)
    if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE')) {
      throw new Error('Received HTML instead of JSON. The API may be unavailable.');
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      throw new Error(`Failed to fetch divisions: ${error.response.status} ${error.response.statusText}`);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Failed to fetch divisions: No response from server');
    } else {
      // Something else happened
      throw new Error(`Failed to fetch divisions: ${error.message}`);
    }
  }
}

/**
 * Get match information including teams.
 */
export async function getMatch(matchId) {
  const url = `${API_BASE_URL}/matches/${matchId}`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Get team information.
 */
export async function getTeam(teamId) {
  const url = `${API_BASE_URL}/teams/${teamId}`;
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
 * Get division schedule HTML and parse matches from it
 * Uses a CORS proxy for GitHub Pages deployment since the API blocks direct browser requests
 */
export async function getDivisionSchedule(divisionId) {
  const targetUrl = 'https://lms.fargorate.com/PublicReport/GenerateDivisionScheduleReport';

  // Helper function to try a proxy and parse the response
  const tryProxy = async (proxyName, makeRequest) => {
    try {
      const response = await makeRequest();

      // Check if response is valid
      if (response.status >= 200 && response.status < 300) {
        let html = response.data;

        // Handle case where AllOrigins or other proxies wrap response in JSON
        if (typeof html === 'object' && html.contents) {
          html = html.contents;
        }

        // Ensure html is a string
        if (typeof html !== 'string') {
          html = String(html);
        }

        // Check if we got an error page instead of schedule HTML
        if (typeof html === 'string' && (html.includes('<!DOCTYPE') && html.includes('error'))) {
          throw new Error('Failed to fetch division schedule: Server returned an error page');
        }

        // Parse HTML to extract matches
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const matchBlocks = doc.querySelectorAll('.schedule-team-block[data-url]');

        const matches = [];
        let currentDate = null;

        matchBlocks.forEach((block) => {
          const url = block.getAttribute('data-url');
          const matchIdMatch = url.match(/matchId=([^&]+)/);
          if (!matchIdMatch) return;

          const matchId = matchIdMatch[1];
          const teamElements = block.querySelectorAll('.schedule-team');
          const locationElement = block.querySelector('.schedule-location');

          // Check if there's a date header before this match (traverse backwards past hr tags)
          let prevElement = block.previousElementSibling;
          while (prevElement) {
            if (prevElement.classList && prevElement.classList.contains('schedule-date')) {
              currentDate = prevElement.textContent.trim();
              break;
            }
            prevElement = prevElement.previousElementSibling;
          }

          const team1 = teamElements[0]?.textContent.trim() || '';
          const team2 = teamElements[1]?.textContent.trim() || '';
          const location = locationElement?.textContent.trim() || '';

          matches.push({
            matchId,
            team1,
            team2,
            location,
            date: currentDate
          });
        });

        return matches;
      }
      throw new Error(`Invalid response status: ${response.status}`);
    } catch (error) {
      console.warn(`CORS proxy ${proxyName} failed:`, error.message);
      throw error;
    }
  };

  // Try multiple CORS proxies in order until one works
  // Note: We need proxies that support POST requests with form data
  const proxies = [
    // Proxy 1: CORS Anywhere (upgraded service, supports POST)
    async () => {
      return tryProxy('cors-anywhere', async () => {
        return axios.post(`https://cors-anywhere.com/${targetUrl}`,
          new URLSearchParams({ divisionId }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 15000 // 15 second timeout
          }
        );
      });
    },

    // Proxy 2: CorsProxy.org (free, supports POST, Cloudflare CDN)
    async () => {
      return tryProxy('corsproxy-org', async () => {
        return axios.post(`https://corsproxy.org/?${encodeURIComponent(targetUrl)}`,
          new URLSearchParams({ divisionId }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
          }
        );
      });
    },

    // Proxy 3: corsproxy.io (may have 403 issues but worth trying)
    async () => {
      return tryProxy('corsproxy-io', async () => {
        return axios.post('https://corsproxy.io/?' + encodeURIComponent(targetUrl),
          new URLSearchParams({ divisionId }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
          }
        );
      });
    },

    // Proxy 4: CORS Anywhere Heroku (fallback, may require opt-in)
    async () => {
      return tryProxy('cors-anywhere-heroku', async () => {
        return axios.post(`https://cors-anywhere.herokuapp.com/${targetUrl}`,
          new URLSearchParams({ divisionId }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 15000
          }
        );
      });
    }
  ];

  // Try each proxy until one succeeds
  let lastError = null;
  let proxyAttempts = [];
  for (const proxyFn of proxies) {
    try {
      const result = await proxyFn();
      console.log(`Successfully fetched division schedule using proxy`);
      return result;
    } catch (error) {
      const errorInfo = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        code: error.code
      };
      proxyAttempts.push(errorInfo);
      console.warn(`Proxy attempt failed:`, errorInfo);
      lastError = error;
      // Continue to next proxy
      continue;
    }
  }

  // Log all failed attempts for debugging
  console.error('All proxy attempts failed:', proxyAttempts);

  // All proxies failed - provide helpful error message
  // Note: We avoid using "CORS" in the error message to prevent App.jsx from showing generic CORS error
  if (lastError) {
    if (lastError.response) {
      const status = lastError.response.status;
      const statusText = lastError.response.statusText;
      throw new Error(
        `Failed to fetch division schedule: All proxy services failed. ` +
        `Last error: ${status} ${statusText}. ` +
        `This may be due to proxy service limitations or the target server blocking requests. ` +
        `Consider deploying with a backend server instead of static hosting.`
      );
    } else if (lastError.request) {
      throw new Error(
        'Failed to fetch division schedule: No response from server after trying all proxy services. ' +
        'The proxy services may be temporarily unavailable.'
      );
    } else {
      // Check if it's actually a CORS error (network error with no response)
      const errorMsg = lastError.message || String(lastError);
      if (errorMsg.includes('Network Error') || errorMsg.includes('Failed to fetch')) {
        throw new Error(
          `Failed to fetch division schedule: Network error. ` +
          `All proxy services failed. This may indicate a connectivity issue or that the target server is blocking proxy requests.`
        );
      }
      throw new Error(`Failed to fetch division schedule: ${errorMsg}`);
    }
  }

  throw new Error('Failed to fetch division schedule: Unknown error');
}

/**
 * Get matchup data for a match ID (client-side version)
 */
export async function getMatchupData(matchId) {
  const match = await getMatch(matchId);

  const team1Id = match.teamOneId;
  const team2Id = match.teamTwoId;

  const [team1, team2, team1Players, team2Players] = await Promise.all([
    getTeam(team1Id),
    getTeam(team2Id),
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
            if (rating1 >= 500 && rating2 >= 500) {
              length = "5";
              typeVal = 1;
            } else if (rating1 < 400 && rating2 < 400) {
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
                  rating2,
                  length,
                  type: typeVal
                };
              } catch (error) {
                return {
                  race: `${p1RaceTo}-${p2RaceTo}`,
                  odds: { error: error.message },
                  rating1,
                  rating2,
                  length,
                  type: typeVal
                };
              }
            } else {
              return { race: null, odds: null, rating1, rating2, length, type: typeVal };
            }
          } catch (error) {
            return { race: "Error", odds: { error: error.message }, rating1: null, rating2: null, length: null, type: null };
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
    team1Name: team1?.name || team1?.teamName || 'Team 1',
    team2Name: team2?.name || team2?.teamName || 'Team 2',
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

