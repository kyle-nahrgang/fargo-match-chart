import React, { useState, useEffect } from 'react';
import MatchupGrid from './components/MatchupGrid';
import OptimalLineups from './components/OptimalLineups';
import './App.css';

function App() {
  const [matchId, setMatchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Extract matchId from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMatchId = params.get('matchId');
    if (urlMatchId) {
      setMatchId(urlMatchId);
      fetchMatchData(urlMatchId);
    }
  }, []);

  const fetchMatchData = async (id) => {
    if (!id || !id.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Check if we're in development (has backend server) or production (direct API calls)
      const useBackend = import.meta.env.DEV || window.location.hostname === 'localhost';

      if (useBackend) {
        // Use backend server in development
        const response = await fetch(`/api/matchups/${id.trim()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch matchup data');
        }
        const result = await response.json();
        setData(result);
      } else {
        // Call API directly in production (GitHub Pages)
        const { getMatchupData } = await import('./api');
        const result = await getMatchupData(id.trim());
        setData(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!matchId.trim()) {
      setError('Please enter a match ID');
      return;
    }

    // Update URL with matchId parameter
    const params = new URLSearchParams(window.location.search);
    params.set('matchId', matchId.trim());
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);

    await fetchMatchData(matchId.trim());
  };

  return (
    <div className="app">
      <div className="app-container">
        <header className="app-header">
          <h1>🏆 Fargo Matchups</h1>
          <p>Calculate race lengths and odds for all player matchups</p>
        </header>

        {(!data && !loading) && (
          <form onSubmit={handleSubmit} className="match-form">
            <div className="input-group">
              <label htmlFor="matchId">Match ID:</label>
              <input
                id="matchId"
                type="text"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                placeholder="Enter match ID..."
                disabled={loading}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Loading...' : 'Analyze Matchups'}
              </button>
            </div>
          </form>
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
                  window.history.pushState({}, '', window.location.pathname);
                }}
                className="new-match-btn"
              >
                Analyze New Match
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
            <MatchupGrid data={data} />
            <OptimalLineups
              team1Players={data.team1Players}
              team2Players={data.team2Players}
              matchupData={data.matchupData}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;

