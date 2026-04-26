# Firebase Security Specification

## 1. Data Invariants
- A `Lead` document must belong to the user identified by the `{userId}` in the path `users/{userId}/leads/{leadId}`.
- Every `Lead` must include `businessName`, `userId`, and `createdAt`.
- `userId` field within the document must strictly match the authenticated user's UID and the path `{userId}`.
- `createdAt` and `updatedAt` must be set using `request.time`.
- String fields must have size limits (e.g., `businessName` max 128 chars, `websiteUrl` max 512 chars).

## 2. The "Dirty Dozen" Payloads (Deny List)
1. **Identity Spoofing**: Attempt to create a lead in `/users/USER_A/leads/L1` while authenticated as `USER_B`.
2. **Path ID Poisoning**: Attempt to use a 2KB string as `leadId`.
3. **Ghost Field Injection**: Adding `isVerified: true` to a lead document.
4. **Timestamp Manipulation**: Providing a manual string for `createdAt` instead of `request.time`.
5. **Unauthorized Listing**: Authenticated user trying to list `/users/VICTIM_ID/leads`.
6. **Cross-User Update**: `USER_A` trying to update a lead in `USER_B`'s collection.
7. **Resource Exhaustion**: Sending a `businessName` that is 1MB in size.
8. **Orphaned Write**: Creating a lead without a `userId` field.
9. **Identity Drift**: Updating a lead and changing the `userId` field to a different UID.
10. **State Shortcutting**: If we had a status, trying to skip from 'new' to 'signed' without 'pitching'. (N/A currently but good to note).
11. **PII Leak**: Unauthorized user trying to read `/users/VICTIM_ID/private/profile`.
12. **Unverified Email**: User with unverified email attempting to write data (assuming app requires verification).

## 3. Test Runner (Draft)
The tests will verify that `request.auth.uid` must match the `{userId}` in the path and that `isValidLead()` logic is applied.
