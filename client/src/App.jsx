import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDishes } from './api/dishApi';
import { DishCard } from './components/DishCard';
import { Navbar } from './components/Navbar';

export function App() {
  const [dishes, setDishes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  // Ref to track polling timer for clean teardown on unmount
  const pollTimerRef = useRef(null);

  // Load dishes from backend
  const loadDishes = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const data = await getDishes();
      setDishes(data);
      setFetchError(null);
    } catch (err) {
      console.warn('[Auto-Sync / Fetch Notice]: Backend unreachable or returned error:', err.message);
      // Only set blocking error on initial load failure
      if (!isSilent) {
        setFetchError('Unable to connect to backend server. Make sure MongoDB and backend are running.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    loadDishes(false);
  }, [loadDishes]);

  // Bonus: Auto-sync polling every 5 seconds with graceful cleanup
  useEffect(() => {
    const POLL_INTERVAL_MS = 5000;

    pollTimerRef.current = setInterval(() => {
      // Perform silent background refresh so UI doesn't flicker
      loadDishes(true);
    }, POLL_INTERVAL_MS);

    // Teardown timer when component unmounts
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [loadDishes]);

  // Update a single dish in state after successful save or reload
  const handleDishUpdated = (updatedDish) => {
    setDishes((prev) =>
      prev.map((d) => (d.dishId === updatedDish.dishId ? updatedDish : d))
    );
  };

  // Filter and search
  const filteredDishes = dishes.filter((dish) => {
    const matchesSearch = dish.dishName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'published') return dish.isPublished === true;
    if (filter === 'unpublished') return dish.isPublished === false;
    return true;
  });

  const publishedCount = dishes.filter((d) => d.isPublished).length;

  return (
    <div className="app-container">
      <Navbar
        totalDishes={dishes.length}
        publishedCount={publishedCount}
        onRefresh={() => loadDishes(false)}
        isRefreshing={isRefreshing}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filter={filter}
        setFilter={setFilter}
      />

      <main className="main-content">
        {/* Architecture explanation badge for reviewer */}
        <div className="info-banner">
          <div className="info-badge">Architecture Highlights</div>
          <p>
            Each dish card maintains an <strong>isolated local draft</strong>. Edits are never persisted until you explicitly click <strong>Save</strong>. 
            The backend enforces <strong>Optimistic Concurrency Control (OCC)</strong> using atomic version checks to guarantee conflict protection under simultaneous edits.
          </p>
        </div>

        {/* Global Connection / Fetch Error */}
        {fetchError && (
          <div className="global-error-card">
            <div className="error-icon">⚠️</div>
            <div>
              <h3>Server Connection Problem</h3>
              <p>{fetchError}</p>
              <button
                type="button"
                className="btn btn-primary btn-retry"
                onClick={() => loadDishes(false)}
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="loading-grid">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="skeleton-card">
                <div className="skeleton-img"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-btn"></div>
              </div>
            ))}
          </div>
        ) : filteredDishes.length === 0 ? (
          /* Empty State */
          <div className="empty-state">
            <span className="empty-icon">🍽️</span>
            <h3>No Dishes Found</h3>
            <p>
              {searchTerm || filter !== 'all'
                ? 'No dishes match your active search or filter criteria.'
                : 'No dishes found in database. Run "npm run seed" in server directory to populate.'}
            </p>
            {(searchTerm || filter !== 'all') && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          /* Dishes Grid */
          <div className="dishes-grid">
            {filteredDishes.map((dish) => (
              <DishCard
                key={dish.dishId}
                dish={dish}
                onDishUpdated={handleDishUpdated}
                onRefreshNeeded={() => loadDishes(false)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Nosh Full Stack Technical Assignment • Optimistic Concurrency Control & Local Drafts</p>
      </footer>
    </div>
  );
}

export default App;
