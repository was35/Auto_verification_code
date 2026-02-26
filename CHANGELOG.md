# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-02-27

### Added
- **Manual Connection Toggle**: Added a "Connect/Disconnect" button in the extension popup for manual control of the WebSocket connection.
- **WebSocket Keep-Alive**: Implemented a robust keep-alive mechanism using `chrome.alarms` and periodic Ping heartbeats to maintain connectivity in Manifest V3.
- **Enhanced Auto-fill**: Improved input field detection heuristics and added a user-gesture fallback (clicking the notification button) for reliable clipboard copying.

### Changed
- **Simplified Extension UI**: Hidden server address configuration in the login and registration views.
- **Username-based Push API**: Changed the push endpoint from using an API token to using the username (`/push/{username}`) for easier configuration.
- **Hardcoded Default Server**: The extension now uses a default server address (`45.207.213.103`).

### Fixed
- **WebSocket Stability**: Resolved frequent disconnections caused by Service Worker suspension in Manifest V3.
- **Detailed Server Logging**: Added comprehensive server-side logging for WebSocket connections and push requests to facilitate easier debugging.
- **Log Buffering**: Enabled `PYTHONUNBUFFERED=1` in Docker Compose for real-time log visibility.
