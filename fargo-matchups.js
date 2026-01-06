#!/usr/bin/env node
/**
 * Script to calculate race lengths and odds for all player matchups in a FargoRate match.
 */

import axios from 'axios';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get match information including teams.
 */
async function getMatch(matchId) {
    const url = `https://lms.fargorate.com/api/matches/${matchId}`;
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

    // If no closest race found, return null
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

/**
 * Format odds data into a compact string.
 */
function formatOdds(odds) {
    if (typeof odds === 'object' && odds !== null) {
        if (odds.winProbability !== undefined) {
            const prob = odds.winProbability;
            if (typeof prob === 'number') {
                return `${(prob * 100).toFixed(1)}%`;
            }
        }
        if (odds.odds !== undefined) {
            return String(odds.odds);
        }
        // If it's an object, try to get meaningful values
        const values = Object.values(odds).filter(v => v !== null && v !== undefined).map(String);
        if (values.length > 0) {
            return values.slice(0, 2).join(', ');
        }
    }
    return String(odds);
}

/**
 * Create an HTML visualization of the matchup grid.
 */
function createMatchupGridHTML(team1Players, team2Players, matchupData) {
    const maxPlayers = 8;
    const team1Display = team1Players.slice(0, maxPlayers);
    const team2Display = team2Players.slice(0, maxPlayers);

    // Pad if needed
    while (team1Display.length < maxPlayers) {
        team1Display.push(null);
    }
    while (team2Display.length < maxPlayers) {
        team2Display.push(null);
    }

    // Get player names
    const team1Names = team1Display.map(p => {
        if (p) {
            const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
            return name;
        }
        return '';
    });

    const team2Names = team2Display.map(p => {
        if (p) {
            const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
            return name;
        }
        return '';
    });

    // Build table rows
    let tableRows = '';
    for (let i = 0; i < team1Names.length; i++) {
        tableRows += '<tr>';
        // Row header
        tableRows += `<th class="row-header">${team1Names[i] || ''}</th>`;

        // Data cells
        for (let j = 0; j < team2Names.length; j++) {
            if (i < matchupData.length && j < matchupData[i].length && matchupData[i][j]) {
                const data = matchupData[i][j];
                const race = data.race || '';
                const odds = formatOdds(data.odds || '');
                const oddsDisplay = odds.length > 15 ? odds.substring(0, 12) + '...' : odds;
                tableRows += `<td class="data-cell"><div class="race">${race}</div><div class="odds">${oddsDisplay}</div></td>`;
            } else {
                tableRows += '<td class="data-cell empty"></td>';
            }
        }
        tableRows += '</tr>';
    }

    // Build column headers
    let colHeaders = '<tr><th class="corner"></th>';
    for (const name of team2Names) {
        colHeaders += `<th class="col-header"><div class="rotated">${name || ''}</div></th>`;
    }
    colHeaders += '</tr>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Matchup Grid: Race and Odds</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f5;
        }

        h1 {
            text-align: center;
            margin-bottom: 20px;
            color: #333;
        }

        .container {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow-x: auto;
        }

        table {
            border-collapse: collapse;
            width: 100%;
            margin: 0 auto;
        }

        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: center;
            min-width: 120px;
        }

        .corner {
            background-color: #E8E8E8;
            width: 150px;
        }

        .row-header {
            background-color: #E8E8E8;
            font-weight: bold;
            text-align: right;
            padding-right: 15px;
            width: 150px;
        }

        .col-header {
            background-color: #E8E8E8;
            height: 150px;
            vertical-align: bottom;
            padding: 5px;
        }

        .rotated {
            transform: rotate(-90deg);
            transform-origin: center;
            white-space: nowrap;
            display: inline-block;
            width: 140px;
            text-align: left;
        }

        .data-cell {
            background-color: #FFFFFF;
            height: 80px;
            vertical-align: middle;
        }

        .data-cell.empty {
            background-color: #F5F5F5;
        }

        .race {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .odds {
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>Matchup Grid: Race and Odds</h1>
    <div class="container">
        <table>
            ${colHeaders}
            ${tableRows}
        </table>
    </div>
</body>
</html>`;

    return html;
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const matchIdIndex = args.indexOf('--match-id');

    if (matchIdIndex === -1 || matchIdIndex === args.length - 1) {
        console.error('Error: --match-id argument is required');
        process.exit(1);
    }

    const matchId = args[matchIdIndex + 1];

    try {
        // Get match information
        console.log(`Fetching match ${matchId}...`);
        const match = await getMatch(matchId);

        const team1Id = match.teamOneId;
        const team2Id = match.teamTwoId;

        console.log(`Team 1 ID: ${team1Id}`);
        console.log(`Team 2 ID: ${team2Id}`);

        // Get players for each team
        console.log('\nFetching players for team 1...');
        const team1Players = await getTeamPlayers(team1Id);
        console.log(`Found ${team1Players.length} players`);

        console.log('\nFetching players for team 2...');
        const team2Players = await getTeamPlayers(team2Id);
        console.log(`Found ${team2Players.length} players`);

        console.log(`\nAnalyzing ${team1Players.length} x ${team2Players.length} potential matchups...`);

        // Collect matchup data in a 2D array
        const matchupData = [];
        for (const p1 of team1Players) {
            const row = [];
            for (const p2 of team2Players) {
                try {
                    const rating1 = getPlayerRating(p1);
                    const rating2 = getPlayerRating(p2);

                    // Determine race length and type based on player ratings
                    // If both players are under 400: length = 3, type = 2 (hot)
                    // Otherwise: length = 4, type = 1 (medium)
                    let length, typeVal;
                    if (rating1 < 400 && rating2 < 400) {
                        length = "3";
                        typeVal = 2;
                    } else {
                        length = "4";
                        typeVal = 1;
                    }

                    try {
                        const race = await getRacesByLengthAndType(length, typeVal, rating1, rating2);

                        if (race) {
                            const highPlayerRaceTo = race.highPlayerRaceTo;
                            const lowPlayerRaceTo = race.lowPlayerRaceTo;

                            // Determine which player is higher rated
                            let p1RaceTo, p2RaceTo;
                            if (rating1 >= rating2) {
                                p1RaceTo = highPlayerRaceTo;
                                p2RaceTo = lowPlayerRaceTo;
                            } else {
                                p1RaceTo = lowPlayerRaceTo;
                                p2RaceTo = highPlayerRaceTo;
                            }

                            // Get odds for this race
                            try {
                                const odds = await getOdds(rating1, rating2, p1RaceTo, p2RaceTo);
                                row.push({
                                    race: `${p1RaceTo}-${p2RaceTo}`,
                                    odds: odds
                                });
                            } catch (error) {
                                row.push({
                                    race: `${p1RaceTo}-${p2RaceTo}`,
                                    odds: `Error: ${error.message}`
                                });
                            }
                        } else {
                            row.push(null);
                        }
                    } catch (error) {
                        row.push({ race: "Error", odds: error.message });
                    }
                } catch (error) {
                    row.push({ race: "Error", odds: error.message });
                }
            }
            matchupData.push(row);
        }

        // Create HTML visualization
        const html = createMatchupGridHTML(team1Players, team2Players, matchupData);
        const outputPath = join(__dirname, 'matchup-grid.html');
        writeFileSync(outputPath, html, 'utf8');

        console.log(`\nVisualization saved to ${outputPath}`);

        // Try to open in browser
        try {
            const { default: open } = await import('open');
            console.log('Opening in browser...');
            await open(outputPath);
        } catch (error) {
            console.log(`Please open ${outputPath} in your browser to view the visualization.`);
        }

    } catch (error) {
        if (error.response) {
            console.error(`Error making API request: ${error.message}`, error.response.data);
        } else {
            console.error(`Error: ${error.message}`);
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run main function
main();

