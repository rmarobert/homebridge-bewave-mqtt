# Changelog

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
