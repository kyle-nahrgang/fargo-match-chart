import React, { useState, useEffect } from 'react';
import MatchupGrid from './components/MatchupGrid';
import OptimalLineups from './components/OptimalLineups';
import BlindPlayerSelector from './components/BlindPlayerSelector';
import './App.css';

const DEFAULT_DIVISION_ID = 'c3012308-61dc-4ca5-b304-b3a00150a4f9';

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

  // Fetch divisions and extract divisionId and matchId from URL parameters, or use defaults
  useEffect(() => {
    fetchDivisions();

    const params = new URLSearchParams(window.location.search);
    const urlDivisionId = params.get('divisionId');
    const urlMatchId = params.get('matchId');

    // Use URL divisionId if present, otherwise use default
    const finalDivisionId = urlDivisionId || DEFAULT_DIVISION_ID;
    setDivisionId(finalDivisionId);

    // Always fetch division schedule on mount
    fetchDivisionSchedule(finalDivisionId);

    if (urlMatchId) {
      setMatchId(urlMatchId);
      fetchMatchData(urlMatchId);
    }
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

  const fetchDivisionSchedule = async (divId) => {
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
    } catch (err) {
      // Check if it's a CORS error
      if (err.message.includes('CORS') || err.message.includes('Access-Control')) {
        setError('CORS error: The division schedule API does not allow direct browser access. Please use a backend proxy or CORS proxy.');
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
    setMatchId('');
    setMatches([]);
    setSelectedMatches([]);

    await fetchDivisionSchedule(selectedDivisionId);
  };

  const handleMatchSelect = async (selectedMatchId) => {
    if (!selectedMatchId) {
      return;
    }

    setMatchId(selectedMatchId);
    setSelectedMatches([]); // Clear selected matches when switching matches

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

            {matches.length > 0 && (
              <div className="input-group">
                <label htmlFor="matchSelect">Select Match:</label>
                <select
                  id="matchSelect"
                  value={matchId}
                  onChange={(e) => handleMatchSelect(e.target.value)}
                  disabled={loading}
                >
                  <option value="">-- Select a match --</option>
                  {matches.map((match) => (
                    <option key={match.matchId} value={match.matchId}>
                      {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
            {matches.length > 0 && (
              <div className="input-group">
                <label htmlFor="matchSelectCurrent">Switch Match:</label>
                <select
                  id="matchSelectCurrent"
                  value={matchId}
                  onChange={(e) => handleMatchSelect(e.target.value)}
                  disabled={loading}
                >
                  {matches.map((match) => (
                    <option key={match.matchId} value={match.matchId}>
                      {match.date ? `${match.date} - ` : ''}{match.team1} vs {match.team2} {match.location ? `(${match.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {data && (
          <div className="match-info">
            <div className="match-id-display">
              <span>Match ID: <strong>{matchId}</strong></span>
              <button
                onClick={() => {
                  setData(null);
                  setMatchId('');
                  setError(null);
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
            <MatchupGrid
              data={data}
              selectedMatches={selectedMatches}
              onMatchSelect={setSelectedMatches}
            />
            <BlindPlayerSelector
              team1Name={data.team1Name}
              team2Name={data.team2Name}
              team1Players={data.team1Players}
              team2Players={data.team2Players}
              matchupData={data.matchupData}
              selectedMatches={selectedMatches}
            />
            <OptimalLineups
              team1Name={data.team1Name}
              team2Name={data.team2Name}
              team1Players={data.team1Players}
              team2Players={data.team2Players}
              matchupData={data.matchupData}
              selectedMatches={selectedMatches}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;

