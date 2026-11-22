# SmartCifra Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document under `/users/{userId}` and its subcollections (`songs`, `setlists`, `items`, `voiceLogs`) can only be read, created, updated, or deleted by the authenticated owner whose `request.auth.uid == userId`.
2. **Verified Identity for Writes**: All write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Master Gate Parent Integrity**:
   - Any subcollection document (`songs`, `setlists`, `voiceLogs`) requires the parent `/users/{userId}` document to exist on `get`, `create`, and `update`.
   - Any `/users/{userId}/setlists/{setlistId}/items/{itemId}` document requires both the parent `/users/{userId}/setlists/{setlistId}` and the referenced `/users/{userId}/songs/{songId}` to exist on `create` and `update`.
4. **Immutable Ownership & Temporal Integrity**:
   - `userId` and `createdAt` are strictly immutable after creation.
   - `createdAt` must equal `request.time` on `create`.
   - `updatedAt` must equal `request.time` on `create` and `update`.
5. **Volumetric & Type Bounds**:
   - All document IDs match `^[a-zA-Z0-9_\-]+$` and length `1..128`.
   - Every string field has explicit `min`/`max` `.size()` bounds.
   - Numeric fields (`transposeOffset`, `capo`, `bpm`, `order`, `customTranspose`) are integers within valid musical ranges.
   - Strict `keys().hasAll(...)` and `keys().hasOnly(...)` prevent shadow/ghost fields.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Song Read/Create**: User B (`uid_b`) attempts to create or read `/users/uid_a/songs/song1`.
2. **UID Spoofing in Body**: User A creates `/users/uid_a/songs/song1` with `userId: "uid_b"`.
3. **Ghost / Shadow Field Injection**: User A creates or updates a `Song` with an extra field `isAdmin: true`.
4. **Unverified Email Spoofing**: User A with `email_verified: false` attempts to write a song or profile.
5. **Client-Forged Timestamp on Create**: User A supplies a backdated `createdAt` instead of `serverTimestamp()`.
6. **Immutable `createdAt` Tampering on Update**: User A modifies `createdAt` during a song update.
7. **Orphaned Song Without User Profile**: User A attempts to create `/users/uid_a/songs/song1` before `/users/uid_a` exists.
8. **Orphaned SetlistItem Without Song**: User A creates a `SetlistItem` referencing a non-existent `songId`.
9. **Path ID Poisoning**: User A attempts to write to `/users/uid_a/songs/bad..id$123`.
10. **Denial-of-Wallet Oversized Content**: User A attempts to write a `Song` with `content` exceeding `30000` bytes.
11. **Out-of-Bounds Musical Metadata**: User A attempts to write a `Song` with `bpm: 9999` or `capo: 25` or invalid `difficulty: "GodMode"`.
12. **Blanket List Query Scraping**: User B attempts to `list` `/users/uid_a/songs` without matching `request.auth.uid == userId`.
