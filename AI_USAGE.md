# AI Tools & Prompt Engineering Log

## 1. AI Tools Used
- Google Gemini 3.5 Flash (Medium)

---

## 2. Important Prompts
- "Build a Production-Ready Shared Expenses App with a ledger-based balance engine, O(n log n) debt simplification, and a CSV import anomaly validator."

---

## 3. Wrong AI Outputs & Corrections

### Wrong Output 1: Prisma Schema database mismatch
- **Issue**: The model generated schema configurations mapping to PostgreSQL because it read the original Prisma database config.
- **Correction**: Manually instructed the database layer to write pure MongoDB schemas with Mongoose ODM models. Added indexes in Mongoose schemas to align with database requirements.

### Wrong Output 2: Float precision rounding error in split calculator
- **Issue**: The calculator split amounts by simple division (e.g., ₹100 / 3 = 33.33 each) but the sum of splits (33.33 * 3 = 99.99) did not equal the total amount (100.00), triggering validation errors.
- **Correction**: Decoupled the calculations inside `splitCalculator.js` to calculate the difference (`amount - sumOfShares`) and automatically apply the remainder (e.g. 0.01) to the first participant's share so that totals always balance exactly.

### Wrong Output 3: Variable spelling typos in settlements fetch
- **Issue**: The AI code referenced `settlectionsRes` instead of `settlementsRes` when loading settlements history list in `GroupDetails.jsx`, which would cause a runtime crash.
- **Correction**: Inspected the code trace, identified the typo, and applied a contiguous line replacement to align it to the correct variable definition.
