#!/usr/bin/env node
/**
 * Express server that provides API endpoints and serves the React app
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const LEAGUE_ID = '570cec8b-dc44-4bfa-a103-b317012291b1';

app.use(cors());
app.use(express.json());

/**
 * Get match information including teams.
 */
async function getMatch(matchId) {
    const url = `https://lms.fargorate.com/api/matches/${matchId}`;
    const response = await axios.get(url);
    return response.data;
}

/**
 * Get team information.
 */
async function getTeam(teamId) {
    const url = `https://lms.fargorate.com/api/teams/${teamId}`;
    const response = await axios.get(url);
    return response.data;
}

/**
 * Get list of players for a team.
 */
async function getTeamPlayers(teamId) {
    const url = `https://lms.fargorate.com/api/teams/${teamId}/players`;
    const response = await axios.get(url);
    return response.data;
}

/**
 * Get the closest race for a matchup.
 */
async function getRacesByLengthAndType(length, typeVal, ratingOne, ratingTwo) {
    const url = "https://lms.fargorate.com/api/ratingcalc/racesbylengthandtype";
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
async function getOdds(playerOneRank, playerTwoRank, playerOneRaceTo, playerTwoRaceTo) {
    const url = `https://lms.fargorate.com/api/ratingcalc/odds/${playerOneRank}/${playerTwoRank}/${playerOneRaceTo}/${playerTwoRaceTo}`;
    const response = await axios.get(url);
    return response.data;
}

/**
 * Extract player rating from player data.
 */
function getPlayerRating(player) {
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

function getPlayerRobustness(player) {
    return Number(player.robustness)
}

// API endpoint to get divisions
app.get('/api/divisions', async (req, res) => {
    try {
        const url = `https://lms.fargorate.com/api/leagues/${LEAGUE_ID}/divisions`;
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching divisions:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get division schedule
app.post('/api/division-schedule', async (req, res) => {
    try {
        const { divisionId } = req.body;
        if (!divisionId) {
            return res.status(400).json({ error: 'divisionId is required' });
        }

        const url = 'https://lms.fargorate.com/PublicReport/GenerateDivisionScheduleReport';
        const response = await axios.post(url,
            new URLSearchParams({ divisionId }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // FargoRate returns the schedule as an HTML table.
        const html = response.data;
        const matches = [];
        const cleanText = (value) => value
            .replace(/<[^>]+>/g, '')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
        const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let rowMatch;
        while ((rowMatch = rowPattern.exec(html)) !== null) {
            const row = rowMatch[1];
            const linkMatch = row.match(/href=['"][^'"]*matchId=([^&'"]+)/i);
            if (!linkMatch) continue;

            const cells = [];
            let cellMatch;
            while ((cellMatch = cellPattern.exec(row)) !== null) {
                cells.push(cleanText(cellMatch[1]));
            }

            if (cells.length >= 2) {
                matches.push({
                    matchId: linkMatch[1],
                    team1: cells[0],
                    team2: cells[1],
                    location: cells[2] || '',
                    date: null
                });
            }
        }

        res.json(matches);
    } catch (error) {
        console.error('Error fetching division schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get matchup data
app.get('/api/matchups/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
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
            const row = [];
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
            matchupData.push(row);
        }

        // Wait for all promises
        const results = await Promise.all(promises);
        let resultIndex = 0;

        for (let i = 0; i < team1Players.length; i++) {
            for (let j = 0; j < team2Players.length; j++) {
                matchupData[i][j] = results[resultIndex++];
            }
        }

        res.json({
            team1Name: team1?.name || team1?.teamName || 'Team 1',
            team2Name: team2?.name || team2?.teamName || 'Team 2',
            team1Players: team1Players.map(p => ({
                id: p.id,
                name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                rating: getPlayerRating(p),
                robustness: getPlayerRobustness(p)
            })),
            team2Players: team2Players.map(p => ({
                id: p.id,
                name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                rating: getPlayerRating(p),
                robustness: getPlayerRobustness(p)
            })),
            matchupData
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// In production, serve static files
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(join(__dirname, 'dist', 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Frontend dev server runs separately on port 5173`);
    console.log(`Run 'npm run dev' to start both servers`);
});

