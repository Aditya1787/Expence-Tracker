# Architecture Decisions & Rationales

This document outlines key technical decisions made during the design and development of the Shared Expenses application.

---

## 1. Database Layer: MongoDB / Mongoose ODM

* **Context**: The repository originally contained a Prisma schema pointing to a PostgreSQL database. However, the system instructions explicitly mandated MongoDB and Mongoose.
* **Decision**: Transitioned the database layer completely to MongoDB with Mongoose ODM schemas.
* **Alternatives Considered**: 
  - Using Prisma client with its MongoDB provider.
  - Using PostgreSQL as suggested in the original environment variables.
* **Why the Choice was Made**: 
  - Direct compliance with the mandatory tech stack guidelines of MongoDB and Mongoose.
  - Mongoose models let us enforce validations natively and support highly nested subdocuments (such as participants array and historical members timeline) in an intuitive schema configuration.

---

## 2. Authentication: JWT & bcryptjs

* **Context**: We need password hashing and secure token-based access.
* **Decision**: Implemented JSON Web Token (JWT) signatures for sessions, and `bcryptjs` for secure password encryption.
* **Alternatives Considered**: 
  - `bcrypt` (native C++ implementation).
  - Cookie-based session storage.
* **Why the Choice was Made**: 
  - `bcryptjs` was chosen over native `bcrypt` to avoid compiled binary dependencies that frequently crash or fail to build on Windows operating systems during `npm install`.
  - JWT allows stateless authentication, making it easier to scale the application and deploy on serverless hosting platforms like Render and Vercel.

---

## 3. Balance Engine: Greedy Max-Heap / Priority Queue

* **Context**: Simplified debt settlement calculations must be O(n log n).
* **Decision**: Implemented a greedy balance engine using custom Priority Queue structures to continuously match the greatest debtor with the greatest creditor.
* **Alternatives Considered**: 
  - Recursive search (exponential time complexity).
  - Simple array sorting at each step (O(n^2 log n) or O(n^2) depending on re-sort implementation).
* **Why the Choice was Made**: 
  - Using a Heap-based Priority Queue satisfies the O(n log n) requirement, executing pop and push operations in logarithmic time. It is highly optimized and ensures minimum cash flow transactions.

---

## 4. CSV Import Engine: Two-Phase validation

* **Context**: We need to parse CSVs, detect 20 different anomaly types, and never crash or silently lose data.
* **Decision**: Designed a two-phase import mechanism.
  1. **Phase 1: Parse & Validate**: Saves to a temp file, analyses the columns, maps standard user names, records warning and error markers to database, and returns a row-by-row analysis.
  2. **Phase 2: Finalize**: User interacts with warnings in the UI (selects target mapping, confirms settlements or duplicates), and hits save. The backend applies resolutions and commits to the database, deleting the temp file.
* **Alternatives Considered**: 
  - Direct auto-import with automatic correction guesses.
  - Fail-fast parsing that rejects the entire file on any warning.
* **Why the Choice was Made**:
  - Direct auto-import can lead to incorrect data in the ledger.
  - Fail-fast is frustrating for users with large exports.
  - The two-phase mapping dashboard gives users total control and maintains auditing history.
