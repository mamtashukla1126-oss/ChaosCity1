# CHAOS CITY Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Core Data Invariants
1. **Unique Case-Insensitive Usernames**: `/usernames/{usernameKey}` uses `usernameKey` matching `^[a-z0-9_]{3,20}$`. `create` only succeeds if the document does not already exist, `incoming().uid == request.auth.uid`, `incoming().normalizedUsername == usernameKey`, and `incoming().createdAt == request.time`. `update` is forbidden (`false`). `list` is forbidden (`false`) to prevent account scraping.
2. **Atomic Profile + Reservation Binding**: Creating `/users/{userId}` requires `existsAfter(/databases/$(database)/documents/usernames/$(incoming().normalizedUsername))` and caps starting coins at `0..500`.
3. **Strict Owner Isolation**: `/users/{userId}` and `/saves/{userId}` enforce `request.auth != null && request.auth.uid == userId` for `get`, `create`, and `update`. `list` and `delete` are forbidden (`false`), guaranteeing players can never read, list, or mutate another player's profile or cloud save.
4. **Zero Credentials / Zero PII in Firestore**: Rules explicitly reject any document containing `password`, `passwordHash`, `email`, or `phone` keys (`!('password' in incoming()) && !('passwordHash' in incoming()) && !('email' in incoming())`).
5. **Monotonic Save Versioning & Temporal Integrity**: Every `/users/{userId}` and `/saves/{userId}` `update` enforces `incoming().saveVersion >= existing().saveVersion`, immutable `uid`, `username`, `normalizedUsername`, `createdAt`, and server-enforced `incoming().updatedAt == request.time`.
6. **Anti-Tamper Coin Bounds**: Initial signup caps `coins` at `0..500`, and subsequent updates enforce integer bounds within `0..1000000` (with `energy` bounded `0..100` and `loungeTokens` bounded `0..100000`). When optional Cloud Functions in `functions/` are deployed for server-authoritative economy operations, client coin writes can be locked further to `incoming().coins == existing().coins`.

## 2. Adversarial "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated read/write**: Unauthenticated client attempts `get(/users/uid_a)` or `set(/saves/uid_a, ...)`.
2. **Cross-user profile read**: Signed-in `uid_b` attempts `get(/users/uid_a)` or `get(/saves/uid_a)`.
3. **Cross-user save hijack**: Signed-in `uid_b` attempts `update(/saves/uid_a, { coins: 0 })`.
4. **Collection scraping (`list`)**: Signed-in `uid_a` attempts `getDocs(collection(db, 'usernames'))`, `collection(db, 'users')`, or `collection(db, 'saves')`.
5. **Case-variant duplicate username claim**: User B attempts `create(/usernames/anant123)` when `anant123` already exists, or sends `normalizedUsername: "other"` inside `/usernames/anant123`.
6. **Username update / hijacking**: Signed-in user attempts `update(/usernames/anant123, { uid: "uid_b" })`.
7. **Shadow / Ghost Field Injection**: User A sends `{ ...validSave, isAdmin: true, role: "superadmin" }` to `/users/uid_a` or `/saves/uid_a`.
8. **Password Leak Injection**: User A sends `{ ...validProfile, password: "secret" }` to `/users/uid_a`.
9. **Spoofed UID**: User B sends `{ ...validSave, uid: "uid_a" }` to `/saves/uid_b`.
10. **Forged Timestamps**: User A sends `createdAt: new Date(0)` or `updatedAt: new Date(9999999999999)` instead of `serverTimestamp()`.
11. **Stale Save Rollback**: User A sends `saveVersion: 1` when existing cloud document has `saveVersion: 10`.
12. **Arbitrary Coin Injection / Negative Balance**: User A attempts `coins: 999999` on signup (`> 500`) or `coins: existing.coins + 100000` or `coins: -100` on update.
