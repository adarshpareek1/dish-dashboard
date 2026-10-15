import React, { useState, useEffect, useCallback } from 'react';
import { getDishes } from './api/dishApi';
import { DishCard } from './components/DishCard';
import { Navbar } from './components/Navbar';

export function App() {
  const [dishes, setDishes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Load dishes from backend
  const loadDishes = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await getDishes();
      setDishes(data);
      setFetchError(null);
    } catch (err) {
      console.error('[Fetch Error]:', err.message);
      setFetchError('Unable to connect to backend server. Make sure MongoDB and backend are running.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch on component mount
  useEffect(() => {
    loadDishes();
  }, [loadDishes]);

  // Update single dish in state after save or reload
  const handleDishUpdated = (updatedDish) => {
    setDishes((prev) =>
      prev.map((d) => (d.dishId === updatedDish.dishId ? updatedDish : d))
    );
  };

  const publishedCount = dishes.filter((d) => d.isPublished).length;

  return (
    <div className="app-container">
      <Navbar
        totalDishes={dishes.length}
        publishedCount={publishedCount}
        onRefresh={loadDishes}
        isRefreshing={isRefreshing}
      />

      <main className="main-content">
        {/* Architecture Information Banner */}
        <div className="info-banner">
          <div className="info-badge">Core Architecture</div>
          <p>
            Edits remain as <strong>local drafts</strong> until you explicitly click <strong>Save Changes</strong>. 
            The backend verifies the document <strong>version</strong> atomically to prevent conflicting updates across concurrent sessions.
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
                onClick={loadDishes}
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
        ) : fetchError ? null : dishes.length === 0 ? (
          /* Empty State (only shown when server responded with empty list) */
          <div className="empty-state">
            <span className="empty-icon">🍽️</span>
            <h3>No Dishes Found</h3>
            <p>No dishes found in database. Run "npm run seed" in the server directory to populate initial data.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={loadDishes}
            >
              Refresh Data
            </button>
          </div>
        ) : (
          /* Dish Cards Grid */
          <div className="dishes-grid">
            {dishes.map((dish) => (
              <DishCard
                key={dish.dishId}
                dish={dish}
                onDishUpdated={handleDishUpdated}
                onRefreshNeeded={loadDishes}
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
