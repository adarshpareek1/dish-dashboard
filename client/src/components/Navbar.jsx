import React from 'react';

export function Navbar({ totalDishes, publishedCount, onRefresh, isRefreshing, searchTerm, setSearchTerm, filter, setFilter }) {
  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-logo">
            <span className="logo-icon">🍲</span>
            <span className="brand-name">Nosh</span>
          </div>
          <span className="brand-badge">Dish Control Center</span>
        </div>

        {/* Stats & Sync indicator */}
        <div className="navbar-stats">
          <div className="stat-pill">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{totalDishes}</span>
          </div>
          <div className="stat-pill stat-published">
            <span className="stat-label">Published:</span>
            <span className="stat-value">{publishedCount}</span>
          </div>
          <div className="stat-pill stat-sync" title="External updates automatically checked every 5 seconds">
            <span className="pulse-indicator"></span>
            <span className="stat-label">Auto-Sync (5s)</span>
          </div>
        </div>

        {/* Controls: Search, Filter, Refresh */}
        <div className="navbar-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Dishes</option>
            <option value="published">Published Only</option>
            <option value="unpublished">Drafts Only</option>
          </select>

          <button
            type="button"
            className={`btn btn-refresh ${isRefreshing ? 'is-spinning' : ''}`}
            onClick={onRefresh}
            title="Refresh from server"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
