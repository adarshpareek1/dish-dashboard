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
NOSH_assignment/
├── IMPLEMENTATION_PLAN.md      # This detailed roadmap
├── README.md                   # Submission documentation and reviewer guide
├── client/                     # Frontend (Vite + React)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx             # Main dashboard container & polling/refresh logic
│       ├── index.css           # Modern, responsive styling
│       ├── api/
│       │   └── dishApi.js      # Fetch/Axios API client
│       └── components/
│           ├── Navbar.jsx      # Header with search & refresh status
│           ├── DishCard.jsx    # Card with draft state, save, discard, conflict handling
│           ├── StatusBadge.jsx # UI badges (Published, Draft, Unsaved)
│           └── Toast.jsx       # Alert notifications
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
        │   └── dishRoutes.js   # GET /api/dishes & PATCH /api/dishes/:dishId
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

#### 1. `GET /api/dishes`
- Returns all dishes sorted by `dishId`.
- Response: `200 OK` with `[ { dishId, dishName, imageUrl, isPublished, version }, ... ]`

#### 2. `PATCH /api/dishes/:dishId`
- **Request Body:**
  ```json
  {
    "dishName": "Paneer Butter Masala",
    "isPublished": true,
    "expectedVersion": 1
  }
  ```
- **Validation Checks:**
  1. `expectedVersion` must be an integer >= 1.
  2. If `isPublished === true`:
     - `dishName` must not be empty after trimming (`dishName.trim().length > 0`).
     - `imageUrl` must be a valid HTTP/HTTPS URL:
       ```javascript
       const isValidUrl = (url) => {
         try {
           const parsed = new URL(url);
           return parsed.protocol === 'http:' || parsed.protocol === 'https:';
         } catch {
           return false;
         }
       };
       ```
     - If invalid, return **`400 Bad Request`** with descriptive message.
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
    return res.status(404).json({ error: "Dish not found" });
  }

  // Version changed -> Conflict
  return res.status(409).json({
    error: "Conflict: This dish has been updated by another user.",
    currentDish: existingDish
  });
  ```

---

## 3. Frontend Architecture & Draft Lifecycle

Each `DishCard` maintains its own isolated state:
- **`serverData`**: The unmodified object received from the backend (holds `version`, `dishName`, `isPublished`).
- **`draftName`**: Local string input.
- **`draftIsPublished`**: Local checkbox state.
- **`isDirty` (Unsaved Changes)**:
  `draftName !== serverData.dishName || draftIsPublished !== serverData.isPublished`

### Action Flows:

1. **User Edits Fields:**
   - Updates `draftName` / `draftIsPublished`.
   - UI shows an **"Unsaved Changes"** badge.
   - **Discard** button becomes enabled.

2. **User Clicks "Discard":**
   - Resets `draftName = serverData.dishName` and `draftIsPublished = serverData.isPublished`.
   - Clears unsaved indicator.

3. **User Clicks "Save":**
   - Save button enters loading state (disabled to prevent double-submit).
   - Sends payload with `expectedVersion = serverData.version`.
   - **On 200 OK:**
     - Updates `serverData` with the new dish data and incremented `version`.
     - Clears unsaved indicator.
     - Displays success toast.
   - **On 400 Bad Request / 500 / Network Error:**
     - Draft remains intact in inputs!
     - Displays error message to user.
     - User can correct the mistake and retry.
   - **On 409 Conflict:**
     - Draft remains intact!
     - Displays conflict banner: *"This dish was modified in another session. Server is at v{currentVersion}."*
     - Shows **"Reload Latest"** button with a warning that it will overwrite local edits.

4. **Image Fallback:**
   - Uses `onError` on the `<img>` tag to display a clean fallback dish placeholder SVG if the URL fails to load.

---

## 4. Optional Bonus: Polling for External Updates

- Frontend implements a 5-second polling interval (`useInterval`).
- When new data arrives for a dish:
  - If the user has **no unsaved draft** (`!isDirty`): automatically update the card to the latest version.
  - If the user **has an unsaved draft** (`isDirty`): **do not overwrite** the draft! Display a badge: *"New server version available"*.

---

## 5. Verification & Acceptance Checklist

| Test Scenario | Steps to Execute | Expected Outcome |
| :--- | :--- | :--- |
| **1. Reseed Idempotency** | 1. Edit Dish 1.<br>2. Run `npm run seed`. | Dish 1 retains edits; no duplicates created. |
| **2. Local Draft & Discard** | 1. Change dish name.<br>2. Click Discard. | Reverts to server value without sending API request. |
| **3. Empty Name Validation** | 1. Clear name.<br>2. Check Published.<br>3. Click Save. | Backend returns 400. Draft preserved. |
| **4. Invalid Image URL** | 1. Send invalid URL while `isPublished: true`. | Backend returns 400. |
| **5. Two-Tab Concurrency** | 1. Open dashboard in Tab A and Tab B.<br>2. Edit and save in Tab A (v1 -> v2).<br>3. Try saving in Tab B (stale v1). | Tab B receives 409 Conflict. Draft preserved. Tab A's save remains intact. |
| **6. Backend Down Simulation**| 1. Stop backend server.<br>2. Click Save. | UI shows network error. Draft remains editable and retryable. |

---

## 6. Interview Preparation Cheat Sheet

### Q1: What is Optimistic Concurrency Control (OCC) and why is it preferred here?
> *"Pessimistic locking locks the database record as soon as a user starts editing, which is dangerous in web applications because a user might close their laptop or walk away, leaving the record locked for everyone else. Optimistic Concurrency Control assumes conflicts are rare. We let everyone edit locally, and only check the version number at the exact moment of saving. If the version changed in the meantime, we reject the save with HTTP 409 Conflict."*

### Q2: Why is the version check atomic in MongoDB?
> *"MongoDB operations on a single document are atomic. By using `Dish.findOneAndUpdate({ dishId, version: expectedVersion }, { $set: ..., $inc: { version: 1 } })`, MongoDB performs the match and the increment in a single atomic step. If two requests arrive at the exact same millisecond with version 1, only one will match the document. The second request will match zero documents and return null, preventing race conditions without complex distributed locks."*

### Q3: Why is seeding idempotent?
> *"We use MongoDB's `$setOnInsert` operator inside an upsert operation. If a document with that `dishId` already exists, `$setOnInsert` does not apply any changes. It only writes data when creating a brand new document."*
