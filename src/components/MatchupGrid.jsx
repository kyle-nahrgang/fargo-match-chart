import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import './MatchupGrid.css';

const columnHelper = createColumnHelper();

function MatchupGrid({ data }) {
  const { team1Players, team2Players, matchupData } = data;

  // Extract probability value from odds object
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

    // Try winProbability first
    if (odds.winProbability !== undefined) {
      const prob = odds.winProbability;
      if (typeof prob === 'number') {
        return prob >= 0 && prob <= 1 ? prob : prob / 100;
      }
    }

    // Try odds field
    if (odds.odds !== undefined) {
      const oddsValue = odds.odds;
      if (typeof oddsValue === 'number') {
        return oddsValue >= 0 && oddsValue <= 1 ? oddsValue : oddsValue / 100;
      }
    }

    // Try to find any numeric value
    const numericValues = Object.values(odds)
      .filter(v => v !== null && v !== undefined && typeof v === 'number')
      .slice(0, 1);

    if (numericValues.length > 0) {
      const value = numericValues[0];
      return value >= 0 && value <= 1 ? value : value / 100;
    }

    return null;
  };

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

  // Create columns dynamically
  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor('player', {
        header: '',
        cell: (info) => {
          const rowIndex = parseInt(info.row.id);
          const player = team1Players[rowIndex];
          return (
            <div className="row-header-cell">
              <div className="player-name">{player.name}</div>
              <div className="player-rating">Rating: {player.rating}</div>
            </div>
          );
        },
        size: 160,
        enableSorting: false,
      }),
    ];

    // Add a column for each team 2 player
    team2Players.forEach((player, index) => {
      cols.push(
        columnHelper.accessor(`matchup_${index}`, {
          header: () => (
            <div className="col-header-cell">
              <div className="player-name">{player.name}</div>
              <div className="player-rating">Rating: {player.rating}</div>
            </div>
          ),
          cell: (info) => {
            const rowIndex = parseInt(info.row.id);
            const matchup = matchupData[rowIndex]?.[index];

            if (!matchup || !matchup.race || matchup.race === null) {
              return <div className="matchup-cell empty">
                <div className="cell-top"></div>
                <div className="cell-bottom"></div>
              </div>;
            }

            // Parse race: "p1RaceTo-p2RaceTo" from Team 1's perspective
            const [p1RaceTo, p2RaceTo] = matchup.race.split('-');

            return (
              <div className="matchup-cell split-cell">
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
  }, [team1Players, team2Players, matchupData]);

  // Create table data
  const tableData = useMemo(() => {
    return team1Players.map((_, index) => ({
      id: index,
      player: team1Players[index],
    }));
  }, [team1Players]);

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
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      minWidth: cell.column.getSize(),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MatchupGrid;

