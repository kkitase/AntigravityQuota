# CHANGELOG

## 1.3.0 (2025-12-30)

- Move user information (name, email, plan, last updated) to status bar tooltip
- Display all model quotas in status bar tooltip on hover
- Simplify Quick Pick menu to show only model selection
- Add detailed tooltip with all quota information

## 1.2.0 (2025-12-30)

- Improve Quick Pick menu UI to display user information at the top
- Add email display in Quick Pick menu
- Add plan name display in Quick Pick menu
- Add last updated timestamp in Quick Pick menu
- Simplify menu title to "Antigravity Quota"

## 1.1.0 (2025-12-20)

- Add absolute date and time to quota reset information (locale-aware)
- Add notice/mention of the source project
- Fix macOS port detection logic by using AND semantics in `lsof`
- Improve port validation to prevent false positives from unrelated local services
- Add PID verification for all discovered listening ports

## 1.0.7 (2025-12-17)

- Added naming scheme for Gemini 3 Flash
