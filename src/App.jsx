import React, { useState } from 'react';
import MatchupGrid from './components/MatchupGrid';
import OptimalLineups from './components/OptimalLineups';
import './App.css';

function App() {
  const [matchId, setMatchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!matchId.trim()) {
      setError('Please enter a match ID');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`/api/matchups/${matchId.trim()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch matchup data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="app-container">
        <header className="app-header">
          <h1>🏆 Fargo Matchups</h1>
          <p>Calculate race lengths and odds for all player matchups</p>
        </header>

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

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
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

