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

  const formatOdds = (odds) => {
    if (!odds || typeof odds !== 'object') {
      return String(odds || 'N/A');
    }

    if (odds.error) {
      return `Error: ${odds.error}`;
    }

    if (odds.winProbability !== undefined) {
      const prob = odds.winProbability;
      if (typeof prob === 'number') {
        return `${(prob * 100).toFixed(1)}%`;
      }
    }

    if (odds.odds !== undefined) {
      return String(odds.odds);
    }

    const values = Object.values(odds)
      .filter(v => v !== null && v !== undefined)
      .map(String)
      .slice(0, 2);

    return values.length > 0 ? values.join(', ') : 'N/A';
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
        size: 180,
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
              return <div className="matchup-cell empty">-</div>;
            }

            return (
              <div className="matchup-cell">
                <div className="race-display">{matchup.race}</div>
                <div className="odds-display">{formatOdds(matchup.odds)}</div>
              </div>
            );
          },
          size: 150,
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

