import React from 'react';

export function Navbar({ totalDishes, publishedCount, onRefresh, isRefreshing }) {
  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-logo">
            <span className="logo-icon">🍲</span>
            <span className="brand-name">Nosh</span>
          </div>
          <span className="brand-badge">Dish Dashboard</span>
        </div>

        {/* Dish Count Summary */}
        <div className="navbar-stats">
          <div className="stat-pill">
            <span className="stat-label">Total Dishes:</span>
            <span className="stat-value">{totalDishes}</span>
          </div>
          <div className="stat-pill stat-published">
            <span className="stat-label">Published:</span>
            <span className="stat-value">{publishedCount}</span>
          </div>
        </div>

        {/* Manual Refresh Control */}
        <div className="navbar-controls">
          <button
            type="button"
            className={`btn btn-refresh ${isRefreshing ? 'is-spinning' : ''}`}
            onClick={onRefresh}
            title="Reload dishes from database"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
