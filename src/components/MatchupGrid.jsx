import React, { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { extractProbability, combinations, permutations } from '../utils';

const columnHelper = createColumnHelper();

function MatchupGrid({ data, selectedMatches = [], onMatchSelect, availableTeam1Players = new Set(), availableTeam2Players = new Set(), lockedTeam1Players = new Set(), lockedTeam2Players = new Set(), onHighlightChange }) {
  const { team1Name, team2Name, team1Players, team2Players, matchupData } = data;
  const maxPoints = 1900;
  const numMatches = 4;
  const [highlightedRow, setHighlightedRow] = useState(null);
  const [highlightedColumn, setHighlightedColumn] = useState(null);

  // Notify parent when highlight changes
  useEffect(() => {
    if (onHighlightChange) {
      onHighlightChange(highlightedRow, highlightedColumn);
    }
  }, [highlightedRow, highlightedColumn, onHighlightChange]);

  const formatOdds = (odds, inverse = false) => {
    const prob = extractProbability(odds);

    if (prob === null) {
      if (odds && odds.error) {
        return <span>Error: {odds.error}</span>;
      }
      return <span>N/A</span>;
    }

    // If inverse is true, show the other player's probability (1 - prob)
    const displayProb = inverse ? (1 - prob) : prob;
    const percentage = (displayProb * 100).toFixed(1);
    const isBold = displayProb > 0.5;

    return (
      <span className={isBold ? 'odds-bold' : ''}>
        {percentage}%
      </span>
    );
  };

  const formatMatchType = (length, type) => {
    const matchTable = "R" + length
    var heat = ""
    if (type == 2) {
      heat = "🔥"
    }

    return matchTable + " " + heat
  }

  // Check if a match is selected
  const isMatchSelected = (team1Index, team2Index) => {
    return selectedMatches.some(m => m.team1Index === team1Index && m.team2Index === team2Index);
  };

  // Check if a player has a selected match
  const hasPlayerSelectedMatch = (playerIndex, isTeam1) => {
    return selectedMatches.some(m =>
      isTeam1 ? m.team1Index === playerIndex : m.team2Index === playerIndex
    );
  };

  // Check if there's a feasible solution with given constraints
  const hasFeasibleSolution = (usedTeam1Indices, usedTeam2Indices, remainingMatches, remainingTeam1Points, remainingTeam2Points) => {
    if (remainingMatches === 0) {
      return remainingTeam1Points >= 0 && remainingTeam2Points >= 0;
    }

    // Get available players (filter by both used indices and availability sets)
    const availableTeam1PlayersFiltered = team1Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam1Indices.has(p.index) && availableTeam1Players.has(p.index));

    const availableTeam2PlayersFiltered = team2Players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !usedTeam2Indices.has(p.index) && availableTeam2Players.has(p.index));

    if (availableTeam1PlayersFiltered.length < remainingMatches || availableTeam2PlayersFiltered.length < remainingMatches) {
      return false;
    }

    // Generate combinations for team1
    const team1Combos = combinations(availableTeam1PlayersFiltered, remainingMatches);

    // Filter to valid point combinations for team1
    const validTeam1Combos = team1Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam1Points;
    });

    if (validTeam1Combos.length === 0) {
      return false;
    }

    // Generate combinations for team2
    const team2Combos = combinations(availableTeam2PlayersFiltered, remainingMatches);

    // Filter to valid point combinations for team2
    const validTeam2Combos = team2Combos.filter(combo => {
      const totalPoints = combo.reduce((sum, p) => sum + p.rating, 0);
      return totalPoints <= remainingTeam2Points;
    });

    if (validTeam2Combos.length === 0) {
      return false;
    }

    // Check if there's at least one valid pairing between team1 and team2 combinations
    // where all matchups exist and are valid
    for (const team1Combo of validTeam1Combos) {
      for (const team2Combo of validTeam2Combos) {
        // Try all permutations of team2 to find valid matchups
        const team2Perms = permutations(team2Combo);

        for (const team2Perm of team2Perms) {
          // Check if we can form valid matchups between these combinations
          let allMatchupsValid = true;
          for (let i = 0; i < team1Combo.length; i++) {
            const p1Idx = team1Combo[i].index;
            const p2Idx = team2Perm[i].index;
            const matchup = matchupData[p1Idx]?.[p2Idx];

            if (!matchup || !matchup.race) {
              allMatchupsValid = false;
              break;
            }
          }

          if (allMatchupsValid) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Check if a player is disabled (selected or cannot be selected due to 1900 limit)
  const isPlayerDisabled = (playerIndex, isTeam1) => {
    const selectedTeam1Indices = new Set(selectedMatches.map(m => m.team1Index));
    const selectedTeam2Indices = new Set(selectedMatches.map(m => m.team2Index));
    const selectedIndices = isTeam1 ? selectedTeam1Indices : selectedTeam2Indices;
    const players = isTeam1 ? team1Players : team2Players;
    const player = players[playerIndex];
    const availablePlayers = isTeam1 ? availableTeam1Players : availableTeam2Players;

    if (!player) return true;

    // If player is not available, they are disabled
    if (!availablePlayers.has(playerIndex)) {
      return true;
    }

    // If player is already selected, they are disabled
    if (selectedIndices.has(playerIndex)) {
      return true;
    }

    // Check if we've already selected max matches
    if (selectedMatches.length >= numMatches) {
      return true;
    }

    // If the player is the highlighted row or column, don't disable them
    if (isTeam1 && highlightedRow !== null && highlightedRow !== undefined && highlightedRow === playerIndex) {
      return false;
    }
    if (!isTeam1 && highlightedColumn !== null && highlightedColumn !== undefined && highlightedColumn === playerIndex) {
      return false;
    }

    // Calculate current points used by selected matches
    var teamPoints = selectedMatches.reduce((sum, m) => {
      return sum + (isTeam1
        ? (team1Players[m.team1Index]?.rating || 0)
        : (team2Players[m.team2Index]?.rating || 0));
    }, 0);

    // include calculation for the selected row or column
    // Track which highlighted player's rating was added so we can exclude their matches from feasibility check
    let highlightedPlayerIndex = null;
    if (isTeam1 && highlightedRow !== null && highlightedRow !== undefined) {
      teamPoints += (team1Players[highlightedRow]?.rating || 0);
      highlightedPlayerIndex = highlightedRow;
    } else if (!isTeam1 && highlightedColumn !== null && highlightedColumn !== undefined) {
      teamPoints += (team2Players[highlightedColumn]?.rating || 0);
      highlightedPlayerIndex = highlightedColumn;
    }

    // Check if adding this player would exceed the 1900 limit
    teamPoints = teamPoints + player.rating;
    if (teamPoints > maxPoints) {
      return true;
    }

    // Check if selecting this player would make it impossible to complete a valid lineup
    const newSelectedIndices = new Set([...selectedIndices, playerIndex]);

    // Filter out matches involving the highlighted player if their rating was added to teamPoints
    const matchesForFeasibilityCheck = highlightedPlayerIndex !== null
      ? selectedMatches.filter(m => {
          if (isTeam1) {
            return m.team1Index !== highlightedPlayerIndex;
          } else {
            return m.team2Index !== highlightedPlayerIndex;
          }
        })
      : selectedMatches;

    // If highlighted player's rating was added, also add them to selected indices for feasibility check
    // and account for them in remaining matches calculation
    let additionalMatchesToAccountFor = 0;
    if (highlightedPlayerIndex !== null && highlightedPlayerIndex !== playerIndex) {
      newSelectedIndices.add(highlightedPlayerIndex);
      // Check if highlighted player is already in selectedMatches
      const highlightedPlayerInMatches = selectedMatches.some(m => {
        if (isTeam1) {
          return m.team1Index === highlightedPlayerIndex;
        } else {
          return m.team2Index === highlightedPlayerIndex;
        }
      });
      // If not already in matches, account for them as an additional selected player
      if (!highlightedPlayerInMatches) {
        additionalMatchesToAccountFor = 1;
      }
    }

    const newRemainingMatches = numMatches - matchesForFeasibilityCheck.length - 1 - additionalMatchesToAccountFor;
    const newRemainingPoints = maxPoints - teamPoints;

    // For feasibility check, we need to check both teams
    if (isTeam1) {
      const selectedTeam2IndicesForCheck = new Set(matchesForFeasibilityCheck.map(m => m.team2Index));
      const remainingTeam2Points = maxPoints - matchesForFeasibilityCheck.reduce((sum, m) => {
        return sum + (team2Players[m.team2Index]?.rating || 0);
      }, 0);

      return !hasFeasibleSolution(
        newSelectedIndices,
        selectedTeam2IndicesForCheck,
        newRemainingMatches,
        newRemainingPoints,
        remainingTeam2Points
      );
    } else {
      const selectedTeam1IndicesForCheck = new Set(matchesForFeasibilityCheck.map(m => m.team1Index));
      const remainingTeam1Points = maxPoints - matchesForFeasibilityCheck.reduce((sum, m) => {
        return sum + (team1Players[m.team1Index]?.rating || 0);
      }, 0);

      return !hasFeasibleSolution(
        selectedTeam1IndicesForCheck,
        newSelectedIndices,
        newRemainingMatches,
        remainingTeam1Points,
        newRemainingPoints
      );
    }
  };

  // Check if a match is disabled (if either player is disabled)
  const isMatchDisabled = (team1Index, team2Index) => {
    // If this exact match is already selected, allow deselecting
    if (isMatchSelected(team1Index, team2Index)) {
      return false;
    }

    // Check if either player is disabled
    return isPlayerDisabled(team1Index, true) || isPlayerDisabled(team2Index, false);
  };

  // Handle match cell click
  const handleMatchClick = (team1Index, team2Index) => {
    if (!onMatchSelect) return;

    if (isMatchDisabled(team1Index, team2Index) && !isMatchSelected(team1Index, team2Index)) {
      return; // Don't allow clicking disabled matches
    }

    // Clear row/column highlights when clicking a cell
    if (highlightedRow === team1Index) {
      setHighlightedRow(null);
    }
    if (highlightedColumn === team2Index) {
      setHighlightedColumn(null);
    }

    const isSelected = isMatchSelected(team1Index, team2Index);

    if (isSelected) {
      // Deselect
      onMatchSelect(selectedMatches.filter(m =>
        !(m.team1Index === team1Index && m.team2Index === team2Index)
      ));
    } else {
      // Select
      onMatchSelect([...selectedMatches, { team1Index, team2Index }]);
    }
  };

  // Handle row header click - highlight/unhighlight the row
  const handleRowHeaderClick = (rowIndex) => {
    if (highlightedRow === rowIndex) {
      setHighlightedRow(null);
    } else {
      setHighlightedRow(rowIndex);
      setHighlightedColumn(null); // Clear column highlight when row is highlighted
    }
  };

  // Handle column header click - highlight/unhighlight the column
  const handleColumnHeaderClick = (colIndex) => {
    if (highlightedColumn === colIndex) {
      setHighlightedColumn(null);
    } else {
      setHighlightedColumn(colIndex);
      setHighlightedRow(null); // Clear row highlight when column is highlighted
    }
  };

  // Create columns dynamically
  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor('player', {
        header: () => (
          <div className="corner-cell split-cell">
            <div className="cell-top">
              <div className="corner-label">Away</div>
            </div>
            <div className="cell-bottom">
              <div className="corner-label">Home</div>
            </div>
          </div>
        ),
        cell: (info) => {
          const rowIndex = parseInt(info.row.id);
          const player = team1Players[rowIndex];
          const playerDisabled = isPlayerDisabled(rowIndex, true);
          const hasSelectedMatch = hasPlayerSelectedMatch(rowIndex, true);
          const isHighlighted = highlightedRow === rowIndex;
          const isLocked = lockedTeam1Players.has(rowIndex);
          const headerDisabled = hasSelectedMatch;

          return (
            <div
              className={`row-header-cell ${playerDisabled ? 'player-disabled' : ''} ${headerDisabled ? 'header-disabled' : ''} ${isHighlighted ? 'highlighted' : ''} ${isLocked ? 'player-locked' : ''}`}
              onClick={() => !headerDisabled && handleRowHeaderClick(rowIndex)}
              style={{ cursor: headerDisabled ? 'not-allowed' : 'pointer' }}
            >
              <div className={`player-name ${playerDisabled ? 'disabled' : ''} ${headerDisabled ? 'disabled' : ''}`}>
                {isLocked && <span className="player-lock-icon">🔒 </span>}{player.name}
              </div>
              <div className={`player-rating ${playerDisabled ? 'disabled' : ''} ${headerDisabled ? 'disabled' : ''}`}>Rating: {player.rating}</div>
              <div className={`player-rating ${playerDisabled ? 'disabled' : ''} ${headerDisabled ? 'disabled' : ''}`}>Robustness: {player.robustness}</div>
            </div>
          );
        },
        size: 160,
        enableSorting: false,
      }),
    ];

    // Add a column for each team 2 player (mark unavailable ones as hidden)
    team2Players.forEach((player, index) => {
      const isHidden = !availableTeam2Players.has(index);
      const playerDisabled = isPlayerDisabled(index, false);

      cols.push(
        columnHelper.accessor(`matchup_${index}`, {
          meta: {
            playerIndex: index, // Store original player index for highlighting
            hidden: isHidden,
          },
          header: () => {
            const isHighlighted = highlightedColumn === index;
            const hasSelectedMatch = hasPlayerSelectedMatch(index, false);
            const isLocked = lockedTeam2Players.has(index);
            const headerDisabled = hasSelectedMatch;
            return (
              <div
                className={`col-header-cell ${playerDisabled ? 'player-disabled' : ''} ${headerDisabled ? 'header-disabled' : ''} ${isHighlighted ? 'highlighted' : ''} ${isLocked ? 'player-locked' : ''}`}
                onClick={() => !headerDisabled && handleColumnHeaderClick(index)}
                style={{ cursor: headerDisabled ? 'not-allowed' : 'pointer' }}
              >
                <div className={`player-name ${playerDisabled ? 'disabled' : ''} ${headerDisabled ? 'disabled' : ''}`}>
                  {isLocked && <span className="player-lock-icon">🔒 </span>}{player.name}
                </div>
                <div className={`player-rating ${playerDisabled ? 'disabled' : ''} ${headerDisabled ? 'disabled' : ''}`}>Rating: {player.rating}</div>
              </div>
            );
          },
          cell: (info) => {
            const rowIndex = parseInt(info.row.id);
            const matchup = matchupData[rowIndex]?.[index];
            const isRowHighlighted = highlightedRow === rowIndex;
            const isColHighlighted = highlightedColumn === index;

            if (!matchup || !matchup.race || matchup.race === null) {
              return <div className={`matchup-cell empty ${isRowHighlighted || isColHighlighted ? 'highlighted' : ''}`}>
                <div className="cell-top"></div>
                <div className="cell-bottom"></div>
              </div>;
            }

            // Parse race: "p1RaceTo-p2RaceTo" from Team 1's perspective
            const [p1RaceTo, p2RaceTo] = matchup.race.split('-');

            const isSelected = isMatchSelected(rowIndex, index);
            const isDisabled = isMatchDisabled(rowIndex, index);

            return (
              <div
                className={`matchup-cell split-cell ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''} ${isRowHighlighted || isColHighlighted ? 'highlighted' : ''}`}
                onClick={() => handleMatchClick(rowIndex, index)}
                style={{ cursor: isDisabled && !isSelected ? 'not-allowed' : 'pointer' }}
              >
                <div className="match-info-bar">
                  {formatMatchType(matchup.length, matchup.type)}
                </div>
                <div className="cell-top">
                  <div className="race-display">{p2RaceTo}</div>
                  <div className="odds-display">{formatOdds(matchup.odds, true)}</div>
                </div>
                <div className="cell-bottom">
                  <div className="race-display">{p1RaceTo}</div>
                  <div className="odds-display">{formatOdds(matchup.odds, false)}</div>
                </div>
              </div>
            );
          },
          size: 140,
          enableSorting: false,
        })
      );
    });

    return cols;
  }, [team1Players, team2Players, matchupData, selectedMatches, highlightedRow, highlightedColumn, availableTeam1Players, availableTeam2Players, lockedTeam1Players, lockedTeam2Players]);

  // Create table data - include all team 1 players, mark unavailable ones as hidden
  const tableData = useMemo(() => {
    return team1Players
      .map((_, index) => ({
        id: index,
        player: team1Players[index],
        hidden: !availableTeam1Players.has(index),
      }));
  }, [team1Players, availableTeam1Players]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  return (
    <div className="matchup-grid-container">
      <div className="table-wrapper">
        <table className="matchup-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, headerIndex) => {
                  // Extract original player index from column meta (for team 2 columns)
                  const colIndex = headerIndex > 0 ? (header.column.columnDef.meta?.playerIndex ?? null) : null;
                  const isColHighlighted = colIndex !== null && highlightedColumn === colIndex;
                  const isHidden = header.column.columnDef.meta?.hidden === true;
                  return (
                    <th
                      key={header.id}
                      className={isColHighlighted ? 'highlighted-column' : ''}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        display: isHidden ? 'none' : undefined,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rowIndex = parseInt(row.id);
              const isRowHighlighted = highlightedRow === rowIndex;
              const isHidden = row.original.hidden;
              return (
                <tr
                  key={row.id}
                  className={isRowHighlighted ? 'highlighted-row' : ''}
                  style={{ display: isHidden ? 'none' : undefined }}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    // Extract original player index from column meta (for team 2 columns)
                    const colIndex = cellIndex > 0 ? (cell.column.columnDef.meta?.playerIndex ?? null) : null;
                    const isColHighlighted = colIndex !== null && highlightedColumn === colIndex;
                    const isHidden = cell.column.columnDef.meta?.hidden === true;
                    return (
                      <td
                        key={cell.id}
                        className={isColHighlighted ? 'highlighted-column' : ''}
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          display: isHidden ? 'none' : undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MatchupGrid;

