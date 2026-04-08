import React from 'react';

/**
 * RosterList Component
 *
 * Tri-state availability per player:
 *   unavailable → available → locked → unavailable (cycles on click)
 *
 * "Locked" means the player is definitely playing and will always be
 * included in lineup calculations regardless of other selections.
 *
 * @param {string} teamName
 * @param {Array} players
 * @param {Set} availablePlayers - Set of available player indices (includes locked)
 * @param {Set} lockedPlayers - Set of locked player indices (subset of available)
 * @param {Function} onAvailabilityChange - (newAvailableSet, newLockedSet) => void
 * @param {string} matchId
 * @param {Array} selectedMatches
 * @param {string} teamType - 'team1' or 'team2'
 * @param {Function} saveToCache
 * @param {Function} onSelectedMatchesChange
 */
function RosterList({
  teamName,
  players,
  availablePlayers,
  lockedPlayers = new Set(),
  onAvailabilityChange,
  matchId,
  selectedMatches,
  teamType,
  saveToCache,
  onSelectedMatchesChange
}) {
  // Cycle: unavailable → available → locked → unavailable
  const handlePlayerClick = (index) => {
    const isAvailable = availablePlayers.has(index);
    const isLocked = lockedPlayers.has(index);

    const newAvailable = new Set(availablePlayers);
    const newLocked = new Set(lockedPlayers);

    if (!isAvailable) {
      // unavailable → available
      newAvailable.add(index);
    } else if (isAvailable && !isLocked) {
      // available → locked
      newLocked.add(index);
    } else {
      // locked → unavailable
      newAvailable.delete(index);
      newLocked.delete(index);

      // Clear any selected matches involving this player when they become unavailable
      const filtered = selectedMatches.filter(m => {
        if (teamType === 'team1') {
          return m.team1Index !== index;
        } else {
          return m.team2Index !== index;
        }
      });
      if (filtered.length !== selectedMatches.length) {
        onSelectedMatchesChange(filtered);
      }
    }

    onAvailabilityChange(newAvailable, newLocked);
    saveToCache(matchId, teamType === 'team1' ? 'availableTeam1Players' : 'availableTeam2Players', newAvailable);
  };

  const getPlayerState = (index) => {
    if (lockedPlayers.has(index)) return 'locked';
    if (availablePlayers.has(index)) return 'available';
    return 'unavailable';
  };

  return (
    <div className="availability-section">
      <h3 className="availability-title">{teamName}</h3>
      <div className="availability-checkboxes">
        {players.map((player, index) => {
          const state = getPlayerState(index);
          return (
            <label
              key={index}
              className={`availability-checkbox availability-checkbox--${state}`}
              onClick={(e) => {
                e.preventDefault();
                handlePlayerClick(index);
              }}
              title={
                state === 'locked'
                  ? 'Locked in — definitely playing. Click to mark unavailable.'
                  : state === 'available'
                  ? 'Available — might play. Click to lock in.'
                  : 'Unavailable. Click to mark available.'
              }
            >
              <span className={`tristate-indicator tristate-indicator--${state}`}>
                {state === 'locked' ? '🔒' : state === 'available' ? '✓' : ''}
              </span>
              <span className="checkbox-label">
                {player.name} <span className="rating-text">({player.rating})</span>
                {state === 'locked' && <span className="locked-badge"> Locked</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default RosterList;
