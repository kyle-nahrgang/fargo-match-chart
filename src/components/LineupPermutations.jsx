import React, { useMemo, useState } from 'react';
import { combinations, extractProbability } from '../utils';

function medianFour(values) {
  const s = [...values].sort((a, b) => a - b);
  return (s[1] + s[2]) / 2;
}

/**
 * Mean win probability (0–1) over every pairing of a lineup player vs each available
 * opponent (uniform over those pairings). Symmetric pools tend toward 50%.
 */
function averageWinPctAgainstAvailableOpponents(
  rosterIndices,
  isTeam1,
  matchupData,
  opponentIndices
) {
  if (!matchupData?.length || !opponentIndices.length) {
    return null;
  }
  let sum = 0;
  let count = 0;
  for (const i of rosterIndices) {
    for (const j of opponentIndices) {
      const matchup = isTeam1 ? matchupData[i]?.[j] : matchupData[j]?.[i];
      if (!matchup) {
        continue;
      }
      const p = extractProbability(matchup.odds);
      if (p === null) {
        continue;
      }
      const win = isTeam1 ? p : 1 - p;
      sum += win;
      count++;
    }
  }
  if (count === 0) {
    return null;
  }
  return sum / count;
}

/**
 * Lists each distinct set of four available players (order ignored) that satisfies the team
 * point cap (total Fargo rating ≤ maxPoints). Handicap is the Fargo rating used elsewhere.
 */
function LineupPermutations({
  teamName,
  players,
  availablePlayers,
  maxPoints = 1900,
  matchupData,
  opponentPlayers,
  opponentAvailablePlayers,
  isTeam1 = true
}) {
  const { rows, notEnoughPlayers } = useMemo(() => {
    if (!players?.length) {
      return { rows: [], notEnoughPlayers: false };
    }
    const opponentLen = opponentPlayers?.length ?? 0;
    const opponentIndices =
      opponentPlayers != null && opponentAvailablePlayers != null
        ? [...opponentAvailablePlayers]
            .filter((i) => i >= 0 && i < opponentLen)
            .sort((a, b) => a - b)
        : [];

    const indices = [...availablePlayers]
      .filter((i) => i >= 0 && i < players.length)
      .sort((a, b) => a - b);
    if (indices.length < 4) {
      return { rows: [], notEnoughPlayers: true };
    }

    const combos = combinations(indices, 4);
    const result = [];
    for (const combo of combos) {
      const handicaps = combo.map((i) => players[i].rating);
      const total = handicaps.reduce((a, b) => a + b, 0);
      if (total > maxPoints) {
        continue;
      }
      const median = medianFour(handicaps);
      const avgWinPct = averageWinPctAgainstAvailableOpponents(
        combo,
        isTeam1,
        matchupData,
        opponentIndices
      );
      const lineupPlayers = combo
        .map((i) => players[i])
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      result.push({
        key: combo.join('-'),
        players: lineupPlayers,
        handicaps,
        total,
        median,
        avgWinPct
      });
    }
    result.sort((a, b) => {
      const aw = a.avgWinPct;
      const bw = b.avgWinPct;
      if (aw !== null && bw !== null) {
        if (bw !== aw) return bw - aw;
      } else if (aw === null && bw === null) {
        /* fall through */
      } else {
        return aw === null ? 1 : -1;
      }
      if (b.median !== a.median) return b.median - a.median;
      if (b.total !== a.total) return b.total - a.total;
      return a.players.map((p) => p.name).join().localeCompare(b.players.map((p) => p.name).join());
    });
    return { rows: result, notEnoughPlayers: false };
  }, [
    players,
    availablePlayers,
    maxPoints,
    matchupData,
    opponentPlayers,
    opponentAvailablePlayers,
    isTeam1
  ]);

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!players?.length) {
    return null;
  }

  return (
    <div className="lineups-section-container">
      <h2
        className="collapsible-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>Valid Lineups — {teamName}</span>
        <span
          style={{
            fontSize: '1.2rem',
            transition: 'transform 0.3s ease',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
          }}
        >
          ▼
        </span>
      </h2>
      {!isCollapsed && (
        <>
          <p className="lineups-explanation">
            Each row is one set of four players (order does not matter), from those marked available on this team, with total handicap at most{' '}
            {maxPoints} (league cap). Sorted by average win % (highest first; rows without data last). Handicap is Fargo rating (same as roster).
            Average win % is the mean win probability over every pairing of a lineup player vs each available opponent (equal weight per pairing); balanced pools tend toward 50%.
            {rows.length > 0 && (
              <span className="lineups-explanation-count"> {rows.length} valid lineups</span>
            )}
          </p>

          {notEnoughPlayers && (
            <p className="no-lineups">Need at least four available players. Adjust availability in the roster above.</p>
          )}

          {!notEnoughPlayers && rows.length === 0 && (
            <p className="no-lineups">
              No valid lineups: every four-player combination from the available roster exceeds {maxPoints} total handicap.
            </p>
          )}

          {!notEnoughPlayers && rows.length > 0 && (
            <div className="lineups-table-outer">
              <div className="table-wrapper">
                <table className="matchup-table lineups-table">
                  <thead>
                    <tr>
                      <th className="lineups-col-num" scope="col">#</th>
                      <th className="lineups-col-players" scope="col">Players</th>
                      <th className="lineups-col-stat" scope="col">Total handicap</th>
                      <th className="lineups-col-stat" scope="col">Median handicap</th>
                      <th className="lineups-col-stat" scope="col">Avg win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.key}>
                        <td className="lineups-col-num">{idx + 1}</td>
                        <td className="lineups-col-players">
                          {row.players.map((p, i) => (
                            <span key={i} className="lineups-player-chip">
                              {p.name}{' '}
                              <span className="lineups-player-rating">({p.rating})</span>
                              {i < 3 ? ', ' : ''}
                            </span>
                          ))}
                        </td>
                        <td className="lineups-col-stat">{row.total}</td>
                        <td className="lineups-col-stat">{row.median.toFixed(1)}</td>
                        <td className="lineups-col-stat">
                          {row.avgWinPct !== null ? `${(row.avgWinPct * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LineupPermutations;
