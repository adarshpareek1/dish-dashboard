# Nosh — Full Stack Dish Dashboard
> **Dish Dashboard: Draft Editing and Safe Updates with Optimistic Concurrency Control (OCC)**

---

## 1. Project Overview & Architecture

This project is a dish-management dashboard developed as part of the Nosh Full Stack Technical Assignment. It provides safe concurrent updates, local draft state isolation, and backend validation.

### Architecture Highlights
- **Frontend (Vite + React):** Component-isolated draft state machines. Local edits remain as drafts in browser memory until explicitly saved or discarded.
- **Backend (Node.js + Express):** RESTful endpoints enforcing HTTP/HTTPS image URL validation and trimmed non-empty dish name requirements.
- **Database (MongoDB + Mongoose):** Persistent storage using document versioning (`version: Number`) and single-document atomic compare-and-swap operations (`findOneAndUpdate`).
- **Focus on Core Excellence:** Implements 100% of the required core requirements (Optimistic Concurrency Control, atomic database updates, local draft isolation, idempotent seeding, and error/conflict UX).

---

## 2. Prerequisites

- **Node.js:** v18.0.0 or higher (Tested on Node v22.16.0)
- **npm:** v9.0.0 or higher (Tested on npm 10.9.2)
- **MongoDB:** Locally installed MongoDB running on `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI.

---

## 3. Setup, Run & Seed Commands

### Quick Monorepo Setup

```bash
# 1. Clone repository
git clone https://github.com/adarshpareek1/dish-dashboard.git
cd dish-dashboard

# 2. Copy environment file (no migrations needed: MongoDB unique index on dishId is created automatically on start)
cp server/.env.example server/.env
# On Windows PowerShell: copy server/.env.example server/.env

# 3. Install all dependencies for both backend and frontend
npm run install:all
```

> **Note on Database Migrations:** No migrations needed. MongoDB is schemaless, and Mongoose automatically registers the unique index on `dishId` upon connection.

### Seeding the Database
The seed script loads `server/seedData.json` into MongoDB using MongoDB's `$setOnInsert` operator. **Rerunning this command is completely idempotent: it never creates duplicates and never overwrites user edits or modified versions.**

```bash
# Run seed command from root
npm run seed

# Alternatively, from server directory:
cd server
npm run seed
```

### Running the Application

In two separate terminals:

**Terminal 1 — Backend (Port 5000):**
```bash
cd server
npm run dev
# Starts server at http://localhost:5000
```

**Terminal 2 — Frontend (Port 5173):**
```bash
cd client
npm run dev
# Starts dashboard UI at http://localhost:5173
```

### Automated Verification Script
Run the automated verification suite to test all status codes (200, 400, 404, 409) and test parallel concurrent writes:
```bash
# Cross-platform (Node.js):
node scripts/verify.js

# Or via Bash / Git Bash:
bash scripts/verify.sh
```

---

## 4. Environment Variables

Create a `.env` file in the `server/` directory:
```bash
cp server/.env.example server/.env
```

Default configuration:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/nosh_dishes
```

---

## 5. API Reference & Examples

### 1. Retrieve All Dishes
* **Endpoint:** `GET /dishes` (or `GET /api/dishes`)
* **Description:** Returns all dishes, including current published status and version.

**Example Request (curl):**
```bash
curl -X GET http://localhost:5000/dishes
```

**Example Response (200 OK):**
```json
[
  {
    "dishId": "1",
    "dishName": "Jeera Rice",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 1
  }
]
```

---

### 2. Update Dish with Optimistic Concurrency Control
* **Endpoint:** `PATCH /dishes/:dishId` (or `PATCH /api/dishes/:dishId`)
* **Description:** Atomically verifies `expectedVersion` against stored version and updates `dishName` and `isPublished`.

**Example Valid Request (curl):**
```bash
curl -X PATCH http://localhost:5000/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Jeera Rice Supreme", "isPublished": true, "expectedVersion": 1}'
```

**Response (200 OK):**
```json
{
  "dishId": "1",
  "dishName": "Jeera Rice Supreme",
  "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
  "isPublished": true,
  "version": 2
}
```

---

### 3. Concurrency Conflict (Stale Version)
If the database version has advanced (e.g., now at `2`), sending `expectedVersion: 1` returns `409 Conflict` and does **not** modify stored data:

```bash
curl -i -X PATCH http://localhost:5000/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Stale Edit", "isPublished": true, "expectedVersion": 1}'
```

**Response (409 Conflict):**
```json
{
  "error": "Conflict: This dish was modified by another session. Current version is 2, but you sent version 1.",
  "currentDish": {
    "dishId": "1",
    "dishName": "Jeera Rice Supreme",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 2
  }
}
```

---

### 4. Validation Rejection (Empty Name on Published Dish)
```bash
curl -i -X PATCH http://localhost:5000/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "   ", "isPublished": true, "expectedVersion": 2}'
```

**Response (400 Bad Request):**
```json
{
  "error": "A published dish must have a non-empty name after trimming."
}
```

---

## 6. Required Acceptance Checks & Verification Steps

All required criteria have been verified using automated scripts and UI browser tests:

### Check 1: Idempotent Seeding & Persistence Across Restart
1. Run `npm run seed`. 5 dishes are inserted with `version: 1`.
2. Edit Dish 1 name to `"Jeera Rice Deluxe"` and save (advances to `version: 2`).
3. Re-run `npm run seed`.
   * **Verification:** Console outputs `Newly Inserted: 0, Preserved intact: 5`. Dish 1 retains `"Jeera Rice Deluxe"` and `version: 2`.
4. Stop the backend server (`Ctrl + C`) and restart it.
   * **Verification:** `GET /dishes` confirms Dish 1 retains `"Jeera Rice Deluxe"` and `version: 2`.

### Check 2: Local Draft Editing & Discard Behavior
1. In the dashboard UI, edit the name input for Dish 2 (`Paneer Tikka`) to `"Paneer Tikka Spicy"`.
2. Notice the **"Unsaved Edits"** and **"Drafting Changes"** badges immediately appear.
3. Click **Discard**.
   * **Verification:** Input field immediately reverts to `"Paneer Tikka"`, buttons disable, and no network request is sent to the server.

### Check 3: Publication Validation (Empty Name & Image URL)
1. **Empty Name Rejection:**
   In the UI, clear the name of a dish to empty spaces (`"   "`), keep Publish checked, and click **Save Changes**.
   * **Verification:** UI displays a red error banner (`Dish name cannot be empty.`), and the local draft input is preserved for correction.
2. **Invalid Image URL Validation (Verified via Database Test Data):**
   The backend enforces that any published dish must have a valid HTTP/HTTPS image URL stored in the database.
   To verify this constraint using test data:
   * In `mongosh` (or MongoDB Compass):
     ```javascript
     use nosh_dishes;
     db.dishes.updateOne({ dishId: "5" }, { $set: { imageUrl: "not-a-valid-url", isPublished: false } });
     ```
   * Attempt to publish dish 5 via PATCH:
     ```bash
     curl -i -X PATCH http://localhost:5000/dishes/5 \
       -H "Content-Type: application/json" \
       -d '{"dishName": "Alfredo Pasta", "isPublished": true, "expectedVersion": 1}'
     ```
   * **Verification:** The backend rejects the request with HTTP `400 Bad Request`:
     ```json
     {
       "error": "A published dish must have a valid HTTP or HTTPS image URL. Stored URL: 'not-a-valid-url'"
     }
     ```
   * The database record remains unmodified (`isPublished: false`).

### Check 4: Multi-Tab Concurrency (409 Conflict Flow)
1. Open `http://localhost:5173` in **Tab A** and **Tab B**.
2. In **Tab A**, edit Dish 3 name to `"Rabdi Kesar Special"` and click **Save Changes**.
   * Tab A increments Dish 3 to `version: 2`.
3. In **Tab B**, without refreshing, edit Dish 3 to `"Rabdi Malai Draft"` and click **Save Changes**.
   * Tab B sends `expectedVersion: 1`.
   * **Verification:**
     * The backend returns HTTP `409 Conflict`.
     * Tab B's draft text (`"Rabdi Malai Draft"`) is **strictly preserved**.
     * Tab B displays a **🔄 Discard Draft & Reload Latest** button with a warning that it will discard local edits.
     * Upon clicking reload, the card synchronizes to `"Rabdi Kesar Special"` at `v2`.

### Check 5: Server Failure / Network Disconnection Simulation
1. Stop the backend server terminal.
2. In the browser, make an edit to any dish and click **Save Changes**.
   * **Verification:** The request fails gracefully; the UI shows a connection error banner, the local draft remains intact in the input box, and the user can click Save again once the server is back online.

---

## 7. Key Design Decision

### Optimistic Concurrency Control (OCC) vs. Pessimistic Locking
* **Why OCC was chosen:** Pessimistic locking acquires a database lock when a user starts editing. In a web dashboard, this is hazardous: if a user opens a dish, gets distracted, or closes their laptop lid, that record remains locked for all other team members.
* **Implementation:** We used document-level version numbers and MongoDB's atomic `Dish.findOneAndUpdate({ dishId, version: expectedVersion }, { $set: ..., $inc: { version: 1 } })`. Because MongoDB executes document modifications atomically, race conditions under high concurrency are prevented without requiring distributed locks or database-level table locks.

---

## 8. Scope & Optional Bonus Disclosure

- Per assignment guidelines (*"Prioritize the core flow... A complete required task can receive the full 100-point core score without it"*), real-time external synchronization was intentionally excluded to ensure a simple, robust, and easily explainable architecture focused purely on the required 100-point core criteria (OCC, atomic updates, local drafts, validation, and idempotent seeding).

---

## 9. Known Limitations

1. **Manual Refresh for External Changes:** Updates made by other users outside the current dashboard session appear upon clicking "Refresh" or when an edit conflict triggers a reload prompt.
2. **Schema Scope:** Authentication, user roles, dish creation, and image uploads are intentionally excluded per assignment scope boundaries.

---

## 10. Submission Metadata & Disclosure

- **Approximate Time Spent:** ~2.5 hours.
- **Optional Bonus Implemented:** No (Excluded per guidelines to ensure a lean, rock-solid core submission).
- **Code Reuse & AI Disclosure:** No external code was copied. Antigravity AI was used for scaffolding, test simulation, and documentation verification. All architecture design, concurrency logic, atomic compare-and-swap operations, validation rules, and draft state machines were authored, reviewed, and verified manually.
