#!/usr/bin/env python3
"""
Script to calculate race lengths and odds for all player matchups in a FargoRate match.
"""

import argparse
import requests
import sys
from typing import List, Dict, Any, Optional
import matplotlib.pyplot as plt


def get_match(match_id: str) -> Dict[str, Any]:
    """Get match information including teams."""
    url = f"https://lms.fargorate.com/api/matches/{match_id}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def get_team_players(team_id: str) -> List[Dict[str, Any]]:
    """Get list of players for a team."""
    url = f"https://lms.fargorate.com/api/teams/{team_id}/players"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def get_races_by_length_and_type(length: str, type_val: int, rating_one: int, rating_two: int) -> Optional[Dict[str, Any]]:
    """Get the closest race for a matchup."""
    url = "https://lms.fargorate.com/api/ratingcalc/racesbylengthandtype"
    params = {
        "length": length,
        "type": type_val,
        "ratingOne": rating_one,
        "ratingTwo": rating_two
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    races = response.json()

    # Find and return only the race where closest = True
    for race in races:
        if race.get("closest") == True:
            return race

    # If no closest race found, return None
    return None


def get_odds(player_one_rank: int, player_two_rank: int, player_one_race_to: int, player_two_race_to: int) -> Dict[str, Any]:
    """Get odds for a matchup."""
    url = f"https://lms.fargorate.com/api/ratingcalc/odds/{player_one_rank}/{player_two_rank}/{player_one_race_to}/{player_two_race_to}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def get_player_rating(player: Dict[str, Any]) -> int:
    """Extract player rating from player data."""
    # Try different possible field names for rating
    if "rating" in player:
        return int(player["rating"])
    elif "fargoRating" in player:
        return int(player["fargoRating"])
    elif "fargo" in player:
        return int(player["fargo"])
    else:
        # If no rating found, raise an error
        raise ValueError(f"Could not find rating for player: {player}")


def format_odds(odds: Dict[str, Any]) -> str:
    """Format odds data into a compact string."""
    # Try to extract meaningful odds information
    if isinstance(odds, dict):
        # Common odds fields might be: winProbability, odds, etc.
        if "winProbability" in odds:
            prob = odds["winProbability"]
            if isinstance(prob, (int, float)):
                return f"{prob:.1%}"
        if "odds" in odds:
            return str(odds["odds"])
        # If it's a dict, try to get a meaningful value
        values = [str(v) for v in odds.values() if v is not None]
        if values:
            return ", ".join(values[:2])  # Limit to first 2 values
    return str(odds)


def plot_matchup_grid(team1_players: List[Dict[str, Any]], team2_players: List[Dict[str, Any]],
                      matchup_data: List[List[Dict[str, Any]]]):
    """Create a matplotlib visualization of the matchup grid."""
    # Ensure we have exactly 8 players per team (pad if necessary)
    max_players = 8
    team1_display = team1_players[:max_players]
    team2_display = team2_players[:max_players]

    # Pad if needed
    while len(team1_display) < max_players:
        team1_display.append(None)
    while len(team2_display) < max_players:
        team2_display.append(None)

    # Get player names
    team1_names = []
    for p in team1_display:
        if p:
            name = f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
            team1_names.append(name)
        else:
            team1_names.append("")

    team2_names = []
    for p in team2_display:
        if p:
            name = f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
            team2_names.append(name)
        else:
            team2_names.append("")

    # Create figure and axis
    fig, ax = plt.subplots(figsize=(16, 12))
    ax.axis('tight')
    ax.axis('off')

    # Prepare table data
    table_data = []
    for i in range(len(team1_names)):
        row = []
        for j in range(len(team2_names)):
            if i < len(matchup_data) and j < len(matchup_data[i]):
                data = matchup_data[i][j]
                if data and "race" in data and "odds" in data:
                    race_str = data["race"]
                    odds_str = format_odds(data["odds"])
                    # Truncate odds if too long
                    if len(odds_str) > 15:
                        odds_str = odds_str[:12] + "..."
                    cell_text = f"{race_str}\n{odds_str}"
                    row.append(cell_text)
                else:
                    row.append("")
            else:
                row.append("")
        table_data.append(row)

    # Create table
    table = ax.table(cellText=table_data,
                     rowLabels=team1_names,
                     colLabels=team2_names,
                     cellLoc='center',
                     loc='center',
                     bbox=[0, 0, 1, 1])

    # Style the table
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 2)

    # Get all cells to style them safely
    cells = table.get_celld()

    # Rotate column headers vertically (row 0, columns 1 to len(team2_names))
    for j in range(len(team2_names)):
        pos = (0, j + 1)
        if pos in cells:
            cell = cells[pos]
            cell.set_text_props(rotation=90, ha='center', va='bottom')
            cell.set_facecolor('#E8E8E8')
            cell.set_height(0.1)

    # Style row headers (rows 1 to len(team1_names), column 0)
    for i in range(len(team1_names)):
        pos = (i + 1, 0)
        if pos in cells:
            cell = cells[pos]
            cell.set_facecolor('#E8E8E8')
            cell.set_width(0.15)

    # Style corner cell (0, 0)
    if (0, 0) in cells:
        cells[(0, 0)].set_facecolor('#E8E8E8')

    # Style data cells
    for i in range(len(team1_names)):
        for j in range(len(team2_names)):
            pos = (i + 1, j + 1)
            if pos in cells:
                cell = cells[pos]
                if i < len(matchup_data) and j < len(matchup_data[i]) and matchup_data[i][j]:
                    cell.set_facecolor('#FFFFFF')
                else:
                    cell.set_facecolor('#F5F5F5')
                cell.set_height(0.12)

    # Set title
    plt.title('Matchup Grid: Race and Odds', fontsize=16, fontweight='bold', pad=20)

    # Adjust layout
    plt.tight_layout()

    # Show the plot
    plt.show()


def main():
    parser = argparse.ArgumentParser(description="Calculate race lengths and odds for all player matchups in a match")
    parser.add_argument("--match-id", required=True, help="The match ID to analyze")
    args = parser.parse_args()

    try:
        # Get match information
        print(f"Fetching match {args.match_id}...")
        match = get_match(args.match_id)

        team1_id = match["teamOneId"]
        team2_id = match["teamTwoId"]

        print(f"Team 1 ID: {team1_id}")
        print(f"Team 2 ID: {team2_id}")

        # Get players for each team
        print(f"\nFetching players for team 1...")
        team1_players = get_team_players(team1_id)
        print(f"Found {len(team1_players)} players")

        print(f"\nFetching players for team 2...")
        team2_players = get_team_players(team2_id)
        print(f"Found {len(team2_players)} players")

        print(f"\nAnalyzing {len(team1_players)} x {len(team2_players)} potential matchups...")

        # Collect matchup data in a 2D array
        matchup_data = []
        for p1 in team1_players:
            row = []
            for p2 in team2_players:
                try:
                    rating1 = get_player_rating(p1)
                    rating2 = get_player_rating(p2)

                    # Determine race length and type based on player ratings
                    # If both players are under 400: length = 3, type = 2 (hot)
                    # Otherwise: length = 4, type = 1 (medium)
                    if rating1 < 400 and rating2 < 400:
                        length = "3"
                        type_val = 2
                    else:
                        length = "4"
                        type_val = 1

                    try:
                        race = get_races_by_length_and_type(length, type_val, rating1, rating2)

                        if race:
                            high_player_race_to = race.get("highPlayerRaceTo")
                            low_player_race_to = race.get("lowPlayerRaceTo")

                            # Determine which player is higher rated
                            if rating1 >= rating2:
                                p1_race_to = high_player_race_to
                                p2_race_to = low_player_race_to
                            else:
                                p1_race_to = low_player_race_to
                                p2_race_to = high_player_race_to

                            # Get odds for this race
                            try:
                                odds = get_odds(rating1, rating2, p1_race_to, p2_race_to)
                                row.append({
                                    "race": f"{p1_race_to}-{p2_race_to}",
                                    "odds": odds
                                })
                            except Exception as e:
                                row.append({
                                    "race": f"{p1_race_to}-{p2_race_to}",
                                    "odds": f"Error: {e}"
                                })
                        else:
                            row.append(None)

                    except Exception as e:
                        row.append({"race": "Error", "odds": str(e)})

                except Exception as e:
                    row.append({"race": "Error", "odds": str(e)})

            matchup_data.append(row)

        # Create and display the grid plot
        plot_matchup_grid(team1_players, team2_players, matchup_data)

    except requests.exceptions.RequestException as e:
        print(f"Error making API request: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
