import React, { useState, useEffect, useMemo } from 'react';
import MatchupGrid from './components/MatchupGrid';
import BlindPlayerSelector from './components/BlindPlayerSelector';
import LineupPermutations from './components/LineupPermutations';
import PredictedMatchups from './components/PredictedMatchups';
import RosterList from './components/RosterList';

const DEFAULT_DIVISION_ID = 'c3012308-61dc-4ca5-b304-b3a00150a4f9';

// Helper function to parse date and categorize matches
const parseMatchDate = (dateString) => {
  if (!dateString) return null;

  // Try JavaScript's Date constructor first (handles most formats)
  let date = new Date(dateString);

  // If date is invalid, try parsing common formats manually
  if (isNaN(date.getTime())) {
    // Try MM/DD/YYYY or MM-DD-YYYY format
    const parts = dateString.trim().split(/[\/\-]/);
    if (parts.length === 3) {
      const part1 = parseInt(parts[0], 10);
      const part2 = parseInt(parts[1], 10);
      const part3 = parseInt(parts[2], 10);

      // Determine format: if part1 > 12, likely DD/MM/YYYY
      if (part1 > 12 && part2 <= 12) {
        date = new Date(part3, part2 - 1, part1);
      } else {
        // Assume MM/DD/YYYY
        date = new Date(part3, part1 - 1, part2);
      }
    }

    // If still invalid, return null
    if (isNaN(date.getTime())) {
      return null;
    }
  }

  return date;
};

const categorizeMatches = (matches, currentMatchId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const current = [];
  const future = [];
  const past = [];

  // First pass: categorize all matches by date
  const matchesByDate = [];

  matches.forEach(match => {
    const matchDate = parseMatchDate(match.date);

    if (!matchDate) {
      // If no date, put in future by default
      future.push(match);
      return;
    }

    const matchDateOnly = new Date(matchDate);
    matchDateOnly.setHours(0, 0, 0, 0);

    const diffTime = matchDateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      past.push({ match, date: matchDateOnly });
    } else {
      matchesByDate.push({ match, date: matchDateOnly, diffDays });
    }
  });

  // Find matches for today
  const todayMatches = matchesByDate.filter(m => m.diffDays === 0);

  // Determine which date to use for "current" group
  let currentDate = null;
  if (todayMatches.length > 0) {
    // Use today's date
    currentDate = today;
  } else {
    // Find the earliest future date
    const futureMatches = matchesByDate.filter(m => m.diffDays > 0);
    if (futureMatches.length > 0) {
      // Sort by date and get the earliest
      futureMatches.sort((a, b) => a.date.getTime() - b.date.getTime());
      currentDate = futureMatches[0].date;
    }
  }

  // Second pass: assign matches to groups
  matchesByDate.forEach(({ match, date, diffDays }) => {
    // If it's the current match, always put it in current group
    if (match.matchId === currentMatchId) {
      current.push(match);
      return;
    }

    if (currentDate && date.getTime() === currentDate.getTime()) {
      // Matches on the current date (today or next date)
      current.push(match);
    } else if (diffDays > 0) {
      // Future matches (but not on the current date)
      future.push(match);
    }
    // Past matches were already added in first pass
  });

  past.sort((a, b) => b.date.getTime() - a.date.getTime());

  return { current, future, past: past.map(({ match }) => match) };
};

// Helper functions for localStorage caching
const getCacheKey = (matchId, key) => `fargo_match_${matchId}_${key}`;

const LOCKED_PLAYER_KEYS = new Set([
  'availableTeam1Players',
  'availableTeam2Players',
  'lockedTeam1Players',
  'lockedTeam2Players',
]);

const loadFromCache = (matchId, key, defaultValue) => {
  if (!matchId) return defaultValue;
  try {
    const cached = localStorage.getItem(getCacheKey(matchId, key));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (LOCKED_PLAYER_KEYS.has(key)) {
        return new Set(parsed);
      }
      return parsed;
    }
  } catch (error) {
    console.warn(`Failed to load cache for ${key}:`, error);
  }
  return defaultValue;
};

const saveToCache = (matchId, key, value) => {
  if (!matchId) return;
  try {
    // Convert Sets to arrays for storage
    const toStore = value instanceof Set ? Array.from(value) : value;
    localStorage.setItem(getCacheKey(matchId, key), JSON.stringify(toStore));
  } catch (error) {
    console.warn(`Failed to save cache for ${key}:`, error);
  }
};

const clearCache = (matchId) => {
  if (!matchId) return;
  try {
    localStorage.removeItem(getCacheKey(matchId, 'availableTeam1Players'));
    localStorage.removeItem(getCacheKey(matchId, 'availableTeam2Players'));
    localStorage.removeItem(getCacheKey(matchId, 'lockedTeam1Players'));
    localStorage.removeItem(getCacheKey(matchId, 'lockedTeam2Players'));
    localStorage.removeItem(getCacheKey(matchId, 'selectedMatches'));
    localStorage.removeItem(getCacheKey(matchId, 'selectedTeam'));
  } catch (error) {
    console.warn(`Failed to clear cache for match ${matchId}:`, error);
  }
};

// Helper functions for storing most recent match per division
const getRecentMatchKey = (divisionId) => `fargo_recent_match_${divisionId}`;

const saveRecentMatch = (divisionId, matchId) => {
  if (!divisionId || !matchId) return;
  try {
    localStorage.setItem(getRecentMatchKey(divisionId), matchId);
  } catch (error) {
    console.warn(`Failed to save recent match for division ${divisionId}:`, error);
  }
};

const loadRecentMatch = (divisionId) => {
  if (!divisionId) return null;
  try {
    return localStorage.getItem(getRecentMatchKey(divisionId));
  } catch (error) {
    console.warn(`Failed to load recent match for division ${divisionId}:`, error);
    return null;
  }
};

function App() {
  const [divisions, setDivisions] = useState([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [divisionId, setDivisionId] = useState(DEFAULT_DIVISION_ID);
  const [matchId, setMatchId] = useState('');
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedMatches, setSelectedMatches] = useState([]);
  const [availableTeam1Players, setAvailableTeam1Players] = useState(new Set());
  const [availableTeam2Players, setAvailableTeam2Players] = useState(new Set());
  const [lockedTeam1Players, setLockedTeam1Players] = useState(new Set());
  const [lockedTeam2Players, setLockedTeam2Players] = useState(new Set());
  const [selectedTeam, setSelectedTeam] = useState('home'); // 'home' or 'away'
  const [highlightedRow, setHighlightedRow] = useState(null); // team1 player index
  const [highlightedColumn, setHighlightedColumn] = useState(null); // team2 player index

  const lockedOpponentTeam1Index = useMemo(() => {
    const hasTeam1PlayerSelectedMatch = highlightedRow !== null &&
      selectedMatches.some(m => m.team1Index === highlightedRow);
    if (highlightedRow !== null && selectedTeam === 'away' && !hasTeam1PlayerSelectedMatch) {
      return highlightedRow;
    }
    return null;
  }, [highlightedRow, selectedTeam, selectedMatches]);

  const lockedOpponentTeam2Index = useMemo(() => {
    const hasTeam2PlayerSelectedMatch = highlightedColumn !== null &&
      selectedMatches.some(m => m.team2Index === highlightedColumn);
    if (highlightedColumn !== null && selectedTeam === 'home' && !hasTeam2PlayerSelectedMatch) {
      return highlightedColumn;
    }
    return null;
  }, [highlightedColumn, selectedTeam, selectedMatches]);

  // Fetch divisions and extract divisionId and matchId from URL parameters, or use defaults
  useEffect(() => {
    const initializeApp = async () => {
      await fetchDivisions();

      const params = new URLSearchParams(window.location.search);
      const urlDivisionId = params.get('divisionId');
      const urlMatchId = params.get('matchId');

      // Use URL divisionId if present, otherwise use default
      const finalDivisionId = urlDivisionId || DEFAULT_DIVISION_ID;
      setDivisionId(finalDivisionId);

      if (urlMatchId) {
        // If matchId is in URL, use it directly and save as recent match
        setMatchId(urlMatchId);
        saveRecentMatch(finalDivisionId, urlMatchId);
        await fetchDivisionSchedule(finalDivisionId, false, urlMatchId);
        await fetchMatchData(urlMatchId);
      } else {
        // If no matchId in URL, try to auto-load recent match
        await fetchDivisionSchedule(finalDivisionId, true, null);
      }
    };

    initializeApp();
  }, []);

  const fetchDivisions = async () => {
    setLoadingDivisions(true);
    setError(null);

    try {
      const { getDivisions } = await import('./api');
      const result = await getDivisions();
      setDivisions(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDivisions(false);
    }
  };

  const fetchDivisionSchedule = async (divId, autoLoadRecent = false, currentMatchId = null) => {
    if (!divId || !divId.trim()) {
      return;
    }

    setLoadingMatches(true);
    setError(null);
    setMatches([]);

    try {
      const { getDivisionSchedule } = await import('./api');
      const result = await getDivisionSchedule(divId.trim());
      setMatches(result);

      // If auto-loading recent match and no matchId is set, try to load the cached recent match
      if (autoLoadRecent && !currentMatchId) {
        const recentMatchId = loadRecentMatch(divId.trim());
        if (recentMatchId) {
          // Verify the match still exists in the schedule
          const matchExists = result.some(m => m.matchId === recentMatchId);
          if (matchExists) {
            setMatchId(recentMatchId);
            // Update URL with matchId parameter
            const params = new URLSearchParams(window.location.search);
            params.set('divisionId', divId.trim());
            params.set('matchId', recentMatchId);
            window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
            await fetchMatchData(recentMatchId);
          }
        }
      }
    } catch (err) {
      // Check if it's a direct CORS error (not a proxy failure)
      // We check for specific CORS-related error patterns, but not generic proxy failures
      const errorMsg = err.message || '';
      if ((errorMsg.includes('CORS') || errorMsg.includes('Access-Control')) &&
          !errorMsg.includes('proxy') && !errorMsg.includes('Proxy')) {
        setError('CORS error: The division schedule API does not allow direct browser access. The app is using CORS proxies, but they may have failed. Please check the console for details.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoadingMatches(false);
    }
  };

  const fetchMatchData = async (id) => {
    if (!id || !id.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const { getMatchupData } = await import('./api');
      const result = await getMatchupData(id.trim());
      setData(result);

      // Try to load from cache, otherwise initialize all players as available
      const cachedAvailableTeam1 = loadFromCache(
        id.trim(),
        'availableTeam1Players',
        new Set(result.team1Players.map((_, idx) => idx))
      );
      const cachedAvailableTeam2 = loadFromCache(
        id.trim(),
        'availableTeam2Players',
        new Set(result.team2Players.map((_, idx) => idx))
      );
      const cachedLockedTeam1 = loadFromCache(id.trim(), 'lockedTeam1Players', new Set());
      const cachedLockedTeam2 = loadFromCache(id.trim(), 'lockedTeam2Players', new Set());
      const cachedSelectedMatches = loadFromCache(id.trim(), 'selectedMatches', []);
      const cachedSelectedTeam = loadFromCache(id.trim(), 'selectedTeam', 'home');

      setAvailableTeam1Players(cachedAvailableTeam1);
      setAvailableTeam2Players(cachedAvailableTeam2);
      setLockedTeam1Players(cachedLockedTeam1);
      setLockedTeam2Players(cachedLockedTeam2);
      setSelectedMatches(cachedSelectedMatches);
      setSelectedTeam(cachedSelectedTeam);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDivisionChange = async (selectedDivisionId) => {
    if (!selectedDivisionId) {
      return;
    }

    setDivisionId(selectedDivisionId);

    // Update URL with divisionId parameter
    const params = new URLSearchParams(window.location.search);
    params.set('divisionId', selectedDivisionId);
    params.delete('matchId'); // Clear matchId when changing division
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);

    // Clear current match data and matches
    setData(null);
    if (matchId) {
      clearCache(matchId);
    }
    setMatchId('');
    setMatches([]);
    setSelectedMatches([]);
    setAvailableTeam1Players(new Set());
    setAvailableTeam2Players(new Set());
    setLockedTeam1Players(new Set());
    setLockedTeam2Players(new Set());
    setSelectedTeam('home');

    await fetchDivisionSchedule(selectedDivisionId);
  };

  const handleMatchSelect = async (selectedMatchId) => {
    if (!selectedMatchId) {
      return;
    }

    // Clear cache for previous match if switching
    if (matchId && matchId !== selectedMatchId) {
      // Cache will be saved automatically via useEffect before clearing
    }

    setMatchId(selectedMatchId);
    setSelectedMatches([]); // Will be restored from cache if available

    // Save as most recent match for this division
    saveRecentMatch(divisionId, selectedMatchId);

    // Update URL with matchId parameter
    const params = new URLSearchParams(window.location.search);
    params.set('matchId', selectedMatchId);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);

    await fetchMatchData(selectedMatchId);
  };

  return (
    <div className="app">
      <div className="app-container">
        <header className="app-header">
          <h1>🏆 Fargo Matchups</h1>
          <p>Calculate race lengths and odds for all player matchups</p>
        </header>

        {(!data && !loading) && (
          <div className="match-form">
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="divisionSelect">Division:</label>
              {loadingDivisions ? (
                <div style={{ flex: 1, padding: '12px 16px' }}>Loading divisions...</div>
              ) : (
                <select
                  id="divisionSelect"
                  value={divisionId}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  disabled={loadingMatches || loadingDivisions}
                >
                  {divisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {loadingMatches && (
              <div className="loading-spinner-container" style={{ minHeight: '100px', padding: '20px' }}>
                <div className="spinner"></div>
                <p>Loading matches...</p>
              </div>
            )}

            {matches.length > 0 && (() => {
              const { current, future, past } = categorizeMatches(matches, matchId);
              return (
                <div className="input-group">
                  <label htmlFor="matchSelect">Select Match:</label>
                  <select
                    id="matchSelect"
                    value={matchId}
                    onChange={(e) => handleMatchSelect(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">-- Select a match --</option>
                    {current.length > 0 && (
                      <optgroup label="Current">
                        {current.map((match) => (
                          <option key={match.matchId} value={match.matchId}>
                            {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {future.length > 0 && (
                      <optgroup label="Future">
                        {future.map((match) => (
                          <option key={match.matchId} value={match.matchId}>
                            {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {past.length > 0 && (
                      <optgroup label="Past">
                        {past.map((match) => (
                          <option key={match.matchId} value={match.matchId}>
                            {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              );
            })()}
          </div>
        )}

        {data && (
          <div className="match-form" style={{ marginBottom: '20px' }}>
            {divisions.length > 0 && (
              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label htmlFor="divisionSelectCurrent">Division:</label>
                <select
                  id="divisionSelectCurrent"
                  value={divisionId}
                  onChange={(e) => handleDivisionChange(e.target.value)}
                  disabled={loadingMatches || loadingDivisions}
                >
                  {divisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {matches.length > 0 && (() => {
              const { current, future, past } = categorizeMatches(matches, matchId);
              return (
                <div className="input-group">
                  <label htmlFor="matchSelectCurrent">Switch Match:</label>
                  <select
                    id="matchSelectCurrent"
                    value={matchId}
                    onChange={(e) => handleMatchSelect(e.target.value)}
                    disabled={loading}
                  >
                    {current.length > 0 && (
                      <optgroup label="Current">
                        {current.map((match) => (
                          <option key={match.matchId} value={match.matchId}>
                            {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {future.length > 0 && (
                      <optgroup label="Future">
                        {future.map((match) => (
                          <option key={match.matchId} value={match.matchId}>
                            {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {past.length > 0 && (
                      <optgroup label="Past">
                        {past.map((match) => (
                          <option key={match.matchId} value={match.matchId}>
                            {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              );
            })()}
          </div>
        )}

        {data && (
          <div className="match-info">
            <div className="match-id-display">
              <span>Match ID: <strong>{matchId}</strong></span>
              <button
                onClick={() => {
                  if (matchId) {
                    clearCache(matchId);
                  }
                  setData(null);
                  setMatchId('');
                  setError(null);
                  setSelectedMatches([]);
                  setAvailableTeam1Players(new Set());
                  setAvailableTeam2Players(new Set());
                  setLockedTeam1Players(new Set());
                  setLockedTeam2Players(new Set());
                  setSelectedTeam('home');
                  // Keep divisionId and matches so user can select another match
                  const params = new URLSearchParams(window.location.search);
                  params.delete('matchId');
                  window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
                }}
                className="new-match-btn"
              >
                Select Different Match
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className="loading-spinner-container">
            <div className="spinner"></div>
            <p>Loading matchup data...</p>
          </div>
        )}

        {data && (
          <>
            <div className="player-availability-container">
              <RosterList
                teamName={data.team1Name}
                players={data.team1Players}
                availablePlayers={availableTeam1Players}
                lockedPlayers={lockedTeam1Players}
                onAvailabilityChange={(newAvailable, newLocked) => {
                  setAvailableTeam1Players(newAvailable);
                  setLockedTeam1Players(newLocked);
                  saveToCache(matchId, 'lockedTeam1Players', newLocked);
                }}
                matchId={matchId}
                selectedMatches={selectedMatches}
                teamType="team1"
                saveToCache={saveToCache}
                onSelectedMatchesChange={(filtered) => {
                  setSelectedMatches(filtered);
                  saveToCache(matchId, 'selectedMatches', filtered);
                }}
              />
              <RosterList
                teamName={data.team2Name}
                players={data.team2Players}
                availablePlayers={availableTeam2Players}
                lockedPlayers={lockedTeam2Players}
                onAvailabilityChange={(newAvailable, newLocked) => {
                  setAvailableTeam2Players(newAvailable);
                  setLockedTeam2Players(newLocked);
                  saveToCache(matchId, 'lockedTeam2Players', newLocked);
                }}
                matchId={matchId}
                selectedMatches={selectedMatches}
                teamType="team2"
                saveToCache={saveToCache}
                onSelectedMatchesChange={(filtered) => {
                  setSelectedMatches(filtered);
                  saveToCache(matchId, 'selectedMatches', filtered);
                }}
              />
            </div>
            <MatchupGrid
              data={data}
              selectedMatches={selectedMatches}
              onMatchSelect={(matches) => {
                setSelectedMatches(matches);
                saveToCache(matchId, 'selectedMatches', matches);
              }}
              availableTeam1Players={availableTeam1Players}
              availableTeam2Players={availableTeam2Players}
              lockedTeam1Players={lockedTeam1Players}
              lockedTeam2Players={lockedTeam2Players}
              onHighlightChange={(row, column) => {
                setHighlightedRow(row);
                setHighlightedColumn(column);
              }}
            />
            <div className="team-selector-container" style={{ marginBottom: '30px', marginTop: '30px', padding: '20px 0', display: 'flex', justifyContent: 'center', width: '100%' }}>
              <div
                className="team-toggle-slider"
                onClick={() => {
                  const newTeam = selectedTeam === 'home' ? 'away' : 'home';
                  setSelectedTeam(newTeam);
                  saveToCache(matchId, 'selectedTeam', newTeam);
                }}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '500px',
                  height: '60px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: selectedTeam === 'home' ? '0' : '50%',
                    width: '50%',
                    height: '100%',
                    backgroundColor: selectedTeam === 'home' ? '#667eea' : '#764ba2',
                    borderRadius: '30px',
                    transition: 'left 0.3s ease',
                    zIndex: 0
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '0',
                    width: '50%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1
                  }}
                >
                  <span
                    style={{
                      color: selectedTeam === 'home' ? 'white' : '#666',
                      fontWeight: selectedTeam === 'home' ? 700 : 500,
                      fontSize: '1.1rem',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      transition: 'color 0.3s ease, font-weight 0.3s ease'
                    }}
                  >
                    {data.team1Name}
                  </span>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    right: '0',
                    width: '50%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1
                  }}
                >
                  <span
                    style={{
                      color: selectedTeam === 'away' ? 'white' : '#666',
                      fontWeight: selectedTeam === 'away' ? 700 : 500,
                      fontSize: '1.1rem',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      transition: 'color 0.3s ease, font-weight 0.3s ease'
                    }}
                  >
                    {data.team2Name}
                  </span>
                </div>
              </div>
            </div>
            <PredictedMatchups
              team1Name={data.team1Name}
              team2Name={data.team2Name}
              team1Players={data.team1Players}
              team2Players={data.team2Players}
              matchupData={data.matchupData}
              selectedMatches={selectedMatches}
              availableTeam1Players={availableTeam1Players}
              availableTeam2Players={availableTeam2Players}
              lockedTeam1Players={lockedTeam1Players}
              lockedTeam2Players={lockedTeam2Players}
              highlightedRow={highlightedRow}
              highlightedColumn={highlightedColumn}
              lockedOpponentTeam1Index={lockedOpponentTeam1Index}
              lockedOpponentTeam2Index={lockedOpponentTeam2Index}
            />
            <BlindPlayerSelector
              team1Name={data.team1Name}
              team2Name={data.team2Name}
              team1Players={data.team1Players}
              team2Players={data.team2Players}
              matchupData={data.matchupData}
              selectedMatches={selectedMatches}
              availableTeam1Players={availableTeam1Players}
              availableTeam2Players={availableTeam2Players}
              lockedTeam1Players={lockedTeam1Players}
              lockedTeam2Players={lockedTeam2Players}
              selectedTeam={selectedTeam}
              lockedOpponentTeam1Index={lockedOpponentTeam1Index}
              lockedOpponentTeam2Index={lockedOpponentTeam2Index}
            />
            <LineupPermutations
              teamName={selectedTeam === 'home' ? data.team1Name : data.team2Name}
              players={selectedTeam === 'home' ? data.team1Players : data.team2Players}
              availablePlayers={selectedTeam === 'home' ? availableTeam1Players : availableTeam2Players}
              lockedPlayers={selectedTeam === 'home' ? lockedTeam1Players : lockedTeam2Players}
              matchupData={data.matchupData}
              opponentPlayers={selectedTeam === 'home' ? data.team2Players : data.team1Players}
              opponentAvailablePlayers={selectedTeam === 'home' ? availableTeam2Players : availableTeam1Players}
              isTeam1={selectedTeam === 'home'}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;

