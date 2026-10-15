# Nosh Full Stack Assignment: Implementation Plan
**Dish Dashboard: Draft Editing and Safe Updates**

---

## 1. Project Overview & Architecture

This project is a Dish Management Dashboard built with the **MERN Stack** (MongoDB, Express, React, Node.js). 

It demonstrates:
- **Optimistic Concurrency Control (OCC)** using document versioning to prevent lost updates under concurrent edits.
- **Client-Side Draft State Management** ensuring local user edits remain separate from server data until explicitly saved or discarded.
- **Atomic Backend Mutation & Validation** guaranteeing data integrity even under simultaneous requests.
- **Idempotent Data Seeding** ensuring re-running the seed script never duplicates dishes or overwrites user edits.

### Monorepo Directory Structure

```text
dish-dashboard/
├── IMPLEMENTATION_PLAN.md      # This detailed roadmap
├── README.md                   # Submission documentation and reviewer guide
├── client/                     # Frontend (Vite + React)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx             # Main dashboard container & state logic
│       ├── index.css           # Clean, responsive CSS styling
│       ├── api/
│       │   └── dishApi.js      # Fetch API client (GET, PATCH)
│       └── components/
│           ├── Navbar.jsx      # Header with stats & refresh button
│           ├── DishCard.jsx    # Card with draft state, save, discard, conflict handling
│           └── StatusBadge.jsx # UI badges (Published, Unpublished, Unsaved, Version)
└── server/                     # Backend (Node.js + Express + Mongoose)
    ├── package.json
    ├── server.js               # Express app entry point
    ├── .env.example            # Sample environment variables
    ├── seedData.json           # Seed dataset
    └── src/
        ├── config/
        │   └── db.js           # MongoDB connection handler
        ├── models/
        │   └── Dish.js         # Mongoose schema with version field
        ├── routes/
        │   └── dishRoutes.js   # GET /dishes & PATCH /dishes/:dishId
        ├── controllers/
        │   └── dishController.js # Validation, atomic update, error handling
        └── seed/
            └── seed.js         # Idempotent seed script
```

---

## 2. Technical Design & Core Logic

### A. Database Model (`Dish`)
```javascript
const dishSchema = new mongoose.Schema({
  dishId: { type: String, required: true, unique: true, index: true },
  dishName: { type: String, required: true, trim: true },
  imageUrl: { type: String, required: true, trim: true },
  isPublished: { type: Boolean, default: false },
  version: { type: Number, required: true, default: 1 }
}, { timestamps: true });
```

### B. Idempotent Seeding Logic
To satisfy: *"Rerunning it must not create duplicates or overwrite existing edits"*:
```javascript
// Uses $setOnInsert so existing dishes remain untouched
const operations = seedData.map(dish => ({
  updateOne: {
    filter: { dishId: dish.dishId },
    update: {
      $setOnInsert: {
        dishId: dish.dishId,
        dishName: dish.dishName,
        imageUrl: dish.imageUrl,
        isPublished: dish.isPublished ?? false,
        version: 1
      }
    },
    upsert: true
  }
}));
await Dish.bulkWrite(operations);
```

### C. Backend APIs & Validation Rules

#### 1. `GET /dishes`
- Returns all dishes sorted by `dishId`.
- Response: `200 OK` with `[ { dishId, dishName, imageUrl, isPublished, version }, ... ]`

#### 2. `PATCH /dishes/:dishId`
- **Request Body:** Accepts only `dishName`, `isPublished`, and `expectedVersion`.
  ```json
  {
    "dishName": "Paneer Butter Masala",
    "isPublished": true,
    "expectedVersion": 1
  }
  ```
- **Validation Checks:**
  1. `expectedVersion` must be an integer >= 1.
  2. `dishName` must be a non-empty string after trimming (`dishName.trim() !== ''`).
  3. `isPublished` must be an explicit boolean (`typeof isPublished === 'boolean'`).
  4. If `isPublished === true`:
     - Database stored `imageUrl` must be a valid HTTP/HTTPS URL.
  5. If validation fails $\rightarrow$ Return **`400 Bad Request`**.
- **Atomic Version Check and Update:**
  ```javascript
  const updatedDish = await Dish.findOneAndUpdate(
    { dishId: req.params.dishId, version: expectedVersion },
    { 
      $set: { dishName: dishName.trim(), isPublished },
      $inc: { version: 1 }
    },
    { new: true, runValidators: true }
  );

  if (updatedDish) {
    return res.status(200).json(updatedDish);
  }

  // If null, determine if it's 404 (Not Found) or 409 (Conflict)
  const existingDish = await Dish.findOne({ dishId: req.params.dishId });
  if (!existingDish) {
    return res.status(404).json({ error: "Dish not found." });
  }

  // Version changed -> 409 Conflict
  return res.status(409).json({
    error: `Conflict: This dish was modified by another session. Current version is ${existingDish.version}, but you sent version ${expectedVersion}.`,
    currentDish: existingDish
  });
  ```

---

## 3. Frontend Architecture & Draft Lifecycle

Each `DishCard` maintains its own isolated state:
- **`dish`**: The pristine server-persisted object (holds `version`, `dishName`, `isPublished`, `imageUrl`).
- **`draftName`**: Local string input.
- **`draftIsPublished`**: Local checkbox state.
- **`isDirty` (Unsaved Changes)**:
  `draftName !== dish.dishName || draftIsPublished !== dish.isPublished`

### Action Flows:

1. **User Edits Fields:**
   - Updates `draftName` / `draftIsPublished`.
   - UI shows an **"Unsaved Edits"** badge and highlights the card.
   - **Discard** button becomes enabled.

2. **User Clicks "Discard":**
   - Resets `draftName = dish.dishName` and `draftIsPublished = dish.isPublished`.
   - Clears unsaved indicator.

3. **User Clicks "Save Changes":**
   - Save button enters loading state (disabled to prevent double-submit).
   - Sends payload with `expectedVersion = dish.version`.
   - **On 200 OK:**
     - Updates `dish` in parent state via `onDishUpdated(updated)`.
     - Syncs local draft states to trimmed saved values (`setDraftName(updated.dishName)`, `setDraftIsPublished(updated.isPublished)`).
     - Clears unsaved indicator and increments displayed version.
   - **On 400 Bad Request / 500 / Network Error:**
     - Draft remains intact in inputs!
     - Displays error message to user so they can correct it and retry.
   - **On 409 Conflict:**
     - Draft remains intact!
     - Displays conflict banner explaining that the server version has changed.
     - Offers **"Discard Draft & Reload Latest"** action with clear warning.

4. **Image Fallback:**
   - Uses `onError` on the `<img>` tag to display a clean fallback dish placeholder SVG if the URL fails to load.

---

## 4. Verification & Acceptance Checklist

| Test Scenario | Steps to Execute | Expected Outcome |
| :--- | :--- | :--- |
| **1. Reseed Idempotency** | 1. Edit Dish 1.<br>2. Run `npm run seed`. | Dish 1 retains edits; no duplicates created. |
| **2. Local Draft & Discard** | 1. Change dish name.<br>2. Click Discard. | Reverts to server value without sending API request. |
| **3. Empty Name Validation** | 1. Clear name.<br>2. Click Save Changes. | Backend returns 400. Draft preserved. |
| **4. Invalid Stored Image URL** | 1. Database has malformed URL, attempt to publish. | Backend returns 400. Stored document remains unchanged. |
| **5. Two-Tab Concurrency** | 1. Open dashboard in Tab A and Tab B.<br>2. Edit and save in Tab A (v1 -> v2).<br>3. Try saving in Tab B (stale v1). | Tab B receives 409 Conflict. Draft preserved. Tab A's save remains intact. |
| **6. Backend Down Simulation**| 1. Stop backend server.<br>2. Click Save. | UI shows network error. Draft remains editable and retryable. |

---

## 5. Interview Preparation Cheat Sheet

### Q1: What is Optimistic Concurrency Control (OCC) and why is it preferred here?
> *"Pessimistic locking locks the database record as soon as a user starts editing, which is dangerous in web applications because a user might walk away or leave their tab open, locking out others. Optimistic Concurrency Control assumes conflicts are rare. We let everyone edit locally in their browser, and only verify that the version hasn't changed at the exact moment of saving. If the version changed in the meantime, we reject the save with HTTP 409 Conflict."*

### Q2: Why is the version check atomic in MongoDB?
> *"MongoDB operations on a single document are atomic. By using `Dish.findOneAndUpdate({ dishId, version: expectedVersion }, { $set: ..., $inc: { version: 1 } })`, MongoDB performs the filter match and the increment in a single atomic step. If two requests arrive at the exact same millisecond with version 1, only one will match the document. The second request will match zero documents and return null, preventing race conditions without complex distributed locks."*

### Q3: Why is seeding idempotent?
> *"We use MongoDB's `$setOnInsert` operator inside an upsert operation. If a document with that `dishId` already exists, `$setOnInsert` does not apply any changes. It only writes data when creating a brand new document."*
