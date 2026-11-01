# Changelog

## [1.0.12] - Unreleased

### Fixed
- Immediately restore the previous alarm mapping after duplicate or undiscovered group selections, and after configuration update failures. Show a clear error instead of leaving an unsaved selection visible next to the global SAVE button.
- Ignore retained alarm snapshots when validating current alarm state.
- Probe the BE WAVE Hybrid every 60 seconds using SYNC; require a live hub reply within 15 seconds. Mark alarm status unavailable and invalidate groups when the hub stops responding, even while the broker remains online.
- Reject commands when the broker or Hybrid is unavailable; await MQTT publishing and propagate errors, disconnects and a 5-second timeout to HomeKit.
- Disable offline command queueing and use non-retained QoS 0 commands, including alarm commands, to avoid replaying old actions after reconnection. A successful publish is not confirmation of execution by the device.
- Stop monitoring timers and close MQTT connections when Homebridge shuts down.

### Tests
- Add regression coverage for retained messages, hub loss and recovery, reconnects, command failures, timeouts and shutdown.

## [1.0.11] - 2026-10-24

### Added
- Added MQTT broker and BE WAVE Hybrid online/offline indicators.
- Added automatic connection monitoring every 15 seconds.
- Added automatic Hybrid name detection from MQTT status messages.
- Added multilingual support for Dutch, English, French, German and Polish.
- Added persistent language selection in the plugin interface.

### Fixed
- Fixed accessory registration detection in Homebridge Child Bridge mode.
- Corrected accessory cache lookup based on Child Bridge username.

### Improved
- Improved device registration status feedback.
- Improved connection diagnostics and device management interface.
- Improved localization of configuration and status messages.

## [1.0.10] - 2026-10-19

### Added
- MQTT connection test using current input values without saving.
- Unsaved changes notification with guidance to use Homebridge SAVE.

### Changed
- Unified MQTT, device and alarm mapping configuration under Homebridge SAVE.
- Removed redundant configuration save buttons.
- Updated cache storage handling to use the Homebridge UI storage path API.

### Fixed
- MQTT broker URL validation in the configuration interface.

### Notes
- Child Bridge operation has not yet been independently tested.

## [1.0.6] - 2026-10-17

### Fixed
- Fixed Homebridge plugin verification requirements.
- Added homepage and issue tracker URLs.
- Added `supports-hap` transport declaration.
- Corrected JSON Schema required properties.
- Moved Homebridge from peerDependencies to devDependencies.

### Changed
- Improved package metadata for Homebridge verification.


## [1.0.5] - 2026-10-17

### Improved
- Added `bewave/status` as the default MQTT status topic.
- Added `bewave/command` as the default MQTT command topic.
- Improved the first-time configuration experience.
- Existing MQTT configurations remain unchanged.

## [1.0.4] - 2026-10-17

### Improved
- Added `mqtt://localhost:1883` as the default MQTT broker address.
- Improved MQTT password field instructions for first-time installations.
- Clarified how existing MQTT passwords are preserved.

## [1.0.3] - 2026-10-17

### Fixed
- Fixed plugin configuration on clean Homebridge installations.
- MQTT broker settings can now be entered and saved directly in the plugin interface.
- Added automatic creation of the initial BE WAVE configuration.
- Fixed the configuration loading message when no configuration exists.

## [1.0.2] - 2026-10-17

### Changed
- Updated compatibility metadata for Homebridge 2.x.

