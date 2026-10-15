import React, { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
import { patchDish } from '../api/dishApi';

// Fallback SVG placeholder for broken dish images (Required)
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
  // Local draft states - edits remain local until Save is clicked
  const [draftName, setDraftName] = useState(dish.dishName);
  const [draftIsPublished, setDraftIsPublished] = useState(dish.isPublished);

  // Version this draft was originally based on
  const [loadedVersion, setLoadedVersion] = useState(dish.version);

  // Interaction and error states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [conflictError, setConflictError] = useState(null);
  const [imgSrc, setImgSrc] = useState(dish.imageUrl);

  // Clearly distinguish unsaved changes from saved values
  const isDirty =
    draftName !== dish.dishName || draftIsPublished !== dish.isPublished;

  // Sync state if dish prop changes and user has no active unsaved edits
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

  // Handle Save: sends draft with originally loaded version
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setConflictError(null);

    try {
      const updated = await patchDish(dish.dishId, {
        dishName: draftName,
        isPublished: draftIsPublished,
        expectedVersion: loadedVersion
      });

      // On success: update saved dish, sync draft state, increment version, clear unsaved indicator
      onDishUpdated(updated);
      setDraftName(updated.dishName);
      setDraftIsPublished(updated.isPublished);
      setLoadedVersion(updated.version);
      setSaveError(null);
      setConflictError(null);
    } catch (err) {
      if (err.status === 409) {
        // 409 Conflict: preserve draft and explain another update occurred
        setConflictError({
          message:
            err.message ||
            'Conflict: Another user or session updated this dish.',
          serverDish: err.data?.currentDish
        });
      } else {
        // 400 Validation or Network/Server Error: preserve draft and show error
        setSaveError(
          err.message || 'Failed to save changes. Please check input and retry.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Discard: restore last loaded values
  const handleDiscard = () => {
    setDraftName(dish.dishName);
    setDraftIsPublished(dish.isPublished);
    setLoadedVersion(dish.version);
    setSaveError(null);
    setConflictError(null);
  };

  // Handle Reload: reload latest server data with explicit discard of local draft
  const handleReloadServer = () => {
    if (conflictError?.serverDish) {
      onDishUpdated(conflictError.serverDish);
      setDraftName(conflictError.serverDish.dishName);
      setDraftIsPublished(conflictError.serverDish.isPublished);
      setLoadedVersion(conflictError.serverDish.version);
    } else {
      onRefreshNeeded();
    }
    setSaveError(null);
    setConflictError(null);
  };

  return (
    <div className={`dish-card ${isDirty ? 'card-dirty' : ''} ${conflictError ? 'card-conflict' : ''}`}>
      {/* Card Header: Identifier, Version, and Badges */}
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

      {/* 409 Conflict Banner: explains external update and warns that reload discards draft */}
      {conflictError && (
        <div className="banner banner-conflict">
          <div className="banner-title">
            ⚠️ <strong>409 Conflict Detected</strong>
          </div>
          <p className="banner-text">
            {conflictError.message}
          </p>
          <p className="banner-subtext">
            Your draft changes are preserved below.
          </p>

          <div className="confirm-box">
            <span className="confirm-warning">
              ⚠️ Warning: Reloading will discard your current local draft.
            </span>
            <button
              type="button"
              className="btn btn-warning-action"
              onClick={handleReloadServer}
            >
              🔄 Discard Draft & Reload Latest
            </button>
          </div>
        </div>
      )}

      {/* Validation or Server Error Banner: preserves draft */}
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
