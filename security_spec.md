# Security Specification — VALORANT TRAINING HUB

## 1. Data Invariants
1. **User PII Isolation**: `/users/{userId}` contains email and personal Riot ID; only the verified owner (`request.auth.uid == userId`) or platform admin can read/write it.
2. **Team Master Gate**: Every subcollection under `/teams/{teamId}` (`members`, `drills`, `aimLogs`, `scrims`, `availabilities`, `templates`, `notifications`) requires active membership in `/teams/{teamId}/members/{request.auth.uid}` (or being the parent team `ownerId` during initial bootstrap).
3. **RBAC Role Integrity**: A user cannot self-assign `teamRole: 'coach'` when joining an existing team unless they are the team `ownerId` or updated by an existing `coach`. Players cannot create, confirm, or delete `/scrims` or reassign drills owned by others.
4. **Strict Validation & Temporal Integrity**: Every `create` uses `request.time` for `createdAt`/`updatedAt`, checks `isValidId()`, enforces `hasAll` + `hasOnly` keys, and constrains string/array bounds.
5. **Terminal State Locking**: Once a Scrim reaches `completed` or `cancelled`, non-admin/non-coach updates are blocked, and even coach updates cannot change `createdBy` or `teamId`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **PII Leak**: User B reads `/users/userA`.
2. **Unverified Email Write**: Signed-in user with `email_verified: false` attempts to create `/teams/team1`.
3. **Shadow Field Injection**: Create `/teams/team1/drills/d1` with extra field `isAdminApproved: true`.
4. **Owner Spoofing**: User A creates `/teams/team1/aimLogs/a1` with `ownerId: "userB"`.
5. **Self-Promotion RBAC Escalation**: Player joins `/teams/team1/members/userB` with `teamRole: "coach"`.
6. **Player Scrim Creation**: Member with `teamRole: "player"` creates `/teams/team1/scrims/s1`.
7. **Orphaned Team Subcollection**: User creates `/teams/nonexistent/drills/d1`.
8. **ID Poisoning**: Create document with 300-character ID or invalid characters `../admin`.
9. **Array Flood**: Create Scrim with `maps` array of 20 items (exceeding max 5).
10. **Client Timestamp Forgery**: Create drill with client-supplied `createdAt` different from `request.time`.
11. **Immutable Field Tampering**: Update drill changing `teamId` or `assignedBy` or `createdAt`.
12. **Cross-Team Leakage**: Member of `teamA` lists `/teams/teamB/availabilities`.
