import React, { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
import { patchDish } from '../api/dishApi';

// Fallback SVG placeholder for broken dish images
const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260" fill="none">
  <rect width="400" height="260" fill="#f1f5f9"/>
  <circle cx="200" cy="115" r="45" stroke="#94a3b8" stroke-width="3" stroke-dasharray="6 6"/>
  <path d="M175 145c10 12 40 12 50 0" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
  <circle cx="188" cy="105" r="4" fill="#94a3b8"/>
  <circle cx="212" cy="105" r="4" fill="#94a3b8"/>
  <text x="200" y="195" text-anchor="middle" fill="#64748b" font-family="system-ui, sans-serif" font-size="14" font-weight="500">Dish Image Not Found</text>
  <text x="200" y="215" text-anchor="middle" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">Fallback Placeholder</text>
</svg>
`);

export function DishCard({ dish, onDishUpdated, onRefreshNeeded }) {
  // Local draft states
  const [draftName, setDraftName] = useState(dish.dishName);
  const [draftIsPublished, setDraftIsPublished] = useState(dish.isPublished);
  
  // Track the version this draft was originally based on
  const [loadedVersion, setLoadedVersion] = useState(dish.version);

  // Interaction and error states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [conflictError, setConflictError] = useState(null);
  const [imgSrc, setImgSrc] = useState(dish.imageUrl);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);

  // Detect whether user has unsaved modifications
  const isDirty =
    draftName !== dish.dishName || draftIsPublished !== dish.isPublished;

  // Detect if server has a newer version than when this draft was started
  const isServerNewer = dish.version > loadedVersion;

  // When parent dish prop updates (e.g. from polling or external save):
  // If user has NO unsaved draft, update local state automatically.
  // If user HAS unsaved draft, PRESERVE IT and indicate newer data available.
  useEffect(() => {
    if (!isDirty) {
      setDraftName(dish.dishName);
      setDraftIsPublished(dish.isPublished);
      setLoadedVersion(dish.version);
      setImgSrc(dish.imageUrl);
      setSaveError(null);
      setConflictError(null);
    }
  }, [dish.dishName, dish.isPublished, dish.version, dish.imageUrl, isDirty]);

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setConflictError(null);
    setShowReloadConfirm(false);

    try {
      // Send draft with the version it was originally loaded with
      const updated = await patchDish(dish.dishId, {
        dishName: draftName,
        isPublished: draftIsPublished,
        expectedVersion: loadedVersion
      });

      // Save succeeded: update parent and local version
      onDishUpdated(updated);
      setLoadedVersion(updated.version);
      setSaveError(null);
      setConflictError(null);
    } catch (err) {
      if (err.status === 409) {
        // 409 Conflict: preserve draft and explain external update
        setConflictError({
          message:
            err.message ||
            'Conflict: Another user or session updated this dish.',
          serverDish: err.data?.currentDish
        });
      } else {
        // 400 Validation or 500 / Network Error: preserve draft and show message
        setSaveError(
          err.message || 'Failed to save changes. Please check your input and retry.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Discard: restore pristine server values
  const handleDiscard = () => {
    setDraftName(dish.dishName);
    setDraftIsPublished(dish.isPublished);
    setLoadedVersion(dish.version);
    setSaveError(null);
    setConflictError(null);
    setShowReloadConfirm(false);
  };

  // Handle Reload Server Version (explicit user action after conflict)
  const handleReloadServer = () => {
    if (conflictError?.serverDish) {
      onDishUpdated(conflictError.serverDish);
      setDraftName(conflictError.serverDish.dishName);
      setDraftIsPublished(conflictError.serverDish.isPublished);
      setLoadedVersion(conflictError.serverDish.version);
    } else {
      // Fallback: trigger parent refresh
      onRefreshNeeded();
      setDraftName(dish.dishName);
      setDraftIsPublished(dish.isPublished);
      setLoadedVersion(dish.version);
    }
    setSaveError(null);
    setConflictError(null);
    setShowReloadConfirm(false);
  };

  return (
    <div className={`dish-card ${isDirty ? 'card-dirty' : ''} ${conflictError ? 'card-conflict' : ''}`}>
      {/* Top Banner for Unsaved Drafts */}
      <div className="card-header">
        <div className="card-id-group">
          <span className="dish-id">ID: {dish.dishId}</span>
          <StatusBadge type="version" label={`v${dish.version}`} />
        </div>

        <div className="card-badges">
          {draftIsPublished ? (
            <StatusBadge type="published" label="Published" />
          ) : (
            <StatusBadge type="unpublished" label="Draft Status" />
          )}
          {isDirty && <StatusBadge type="unsaved" label="Unsaved Edits" />}
        </div>
      </div>

      {/* Dish Image with broken image fallback */}
      <div className="dish-image-wrapper">
        <img
          src={imgSrc}
          alt={dish.dishName}
          className="dish-image"
          onError={() => setImgSrc(FALLBACK_IMAGE)}
        />
        {isDirty && (
          <div className="image-overlay-pill">Drafting Changes</div>
        )}
      </div>

      {/* External Update Notice (Bonus requirement) */}
      {isDirty && isServerNewer && !conflictError && (
        <div className="banner banner-warning">
          <strong>⚡ Newer Server Data Available (v{dish.version}):</strong>
          <span> Another user saved changes. Your local draft is preserved below. Discard or Save to reconcile.</span>
        </div>
      )}

      {/* 409 Conflict Banner */}
      {conflictError && (
        <div className="banner banner-conflict">
          <div className="banner-title">
            ⚠️ <strong>409 Conflict Detected</strong>
          </div>
          <p className="banner-text">
            {conflictError.message}
          </p>
          <p className="banner-subtext">
            Your draft changes are preserved below so you don’t lose work.
          </p>

          {!showReloadConfirm ? (
            <button
              type="button"
              className="btn btn-warning-action"
              onClick={() => setShowReloadConfirm(true)}
            >
              🔄 Reload Server Version
            </button>
          ) : (
            <div className="confirm-box">
              <span className="confirm-warning">
                ⚠️ Warning: Reloading will discard your current draft edits. Proceed?
              </span>
              <div className="confirm-buttons">
                <button
                  type="button"
                  className="btn btn-danger-sm"
                  onClick={handleReloadServer}
                >
                  Yes, Discard Draft & Reload
                </button>
                <button
                  type="button"
                  className="btn btn-secondary-sm"
                  onClick={() => setShowReloadConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* General / Validation Error Banner */}
      {saveError && (
        <div className="banner banner-error">
          <strong>❌ Save Failed:</strong> {saveError}
          <div className="error-note">Your draft is preserved. You can correct it and retry.</div>
        </div>
      )}

      {/* Form with Draft Inputs */}
      <form onSubmit={handleSave} className="card-form">
        <div className="form-group">
          <label htmlFor={`dish-name-${dish.dishId}`} className="form-label">
            Dish Name:
          </label>
          <input
            id={`dish-name-${dish.dishId}`}
            type="text"
            className="input-text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            disabled={isSaving}
            placeholder="Enter dish name..."
          />
          {draftName.trim() === '' && draftIsPublished && (
            <span className="field-hint hint-error">
              * Published dishes cannot have an empty name.
            </span>
          )}
        </div>

        <div className="form-group-checkbox">
          <label className="checkbox-container">
            <input
              id={`dish-publish-${dish.dishId}`}
              type="checkbox"
              checked={draftIsPublished}
              onChange={(e) => setDraftIsPublished(e.target.checked)}
              disabled={isSaving}
            />
            <span className="checkbox-label">
              Publish on Menu
            </span>
          </label>
        </div>

        {/* Action Buttons: Save & Discard */}
        <div className="card-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving}
            title={isDirty ? 'Reset to last saved server values' : 'No unsaved changes'}
          >
            Discard
          </button>

          <button
            type="submit"
            className={`btn btn-primary ${isSaving ? 'btn-loading' : ''}`}
            disabled={!isDirty || isSaving}
            title={!isDirty ? 'No unsaved changes to save' : 'Persist changes to server'}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
