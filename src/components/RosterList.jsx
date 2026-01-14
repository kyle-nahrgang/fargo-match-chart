import React from 'react';

/**
 * RosterList Component
 *
 * A reusable component for displaying a team's roster with availability checkboxes.
 *
 * @param {string} teamName - The name of the team
 * @param {Array} players - Array of player objects with name and rating properties
 * @param {Set} availablePlayers - Set of available player indices
 * @param {Function} onAvailabilityChange - Callback when availability changes (newSet) => void
 * @param {string} matchId - Current match ID for caching
 * @param {Array} selectedMatches - Array of selected matches to filter when clearing
 * @param {string} teamType - 'team1' or 'team2' to determine which matches to clear
 * @param {Function} saveToCache - Function to save to cache (matchId, key, value) => void
 * @param {Function} onSelectedMatchesChange - Callback when selected matches need to be updated (filtered) => void
 */
function RosterList({
  teamName,
  players,
  availablePlayers,
  onAvailabilityChange,
  matchId,
  selectedMatches,
  teamType,
  saveToCache,
  onSelectedMatchesChange
}) {
  const handleCheckboxChange = (index, checked) => {
    const newSet = new Set(availablePlayers);
    if (checked) {
      newSet.add(index);
    } else {
      newSet.delete(index);
      // Clear any selected matches involving this player
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
    onAvailabilityChange(newSet);
    saveToCache(matchId, teamType === 'team1' ? 'availableTeam1Players' : 'availableTeam2Players', newSet);
  };

  return (
    <div className="availability-section">
      <h3 className="availability-title">{teamName}</h3>
      <div className="availability-checkboxes">
        {players.map((player, index) => (
          <label key={index} className="availability-checkbox">
            <input
              type="checkbox"
              checked={availablePlayers.has(index)}
              onChange={(e) => handleCheckboxChange(index, e.target.checked)}
            />
            <span className="checkbox-label">
              {player.name} <span className="rating-text">({player.rating})</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default RosterList;
