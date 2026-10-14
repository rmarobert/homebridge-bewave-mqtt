# Homebridge BE WAVE MQTT

A Homebridge plugin for integrating SATEL BE WAVE devices with Apple HomeKit through MQTT.

## Features

- MQTT integration with SATEL BE WAVE
- Automatic device discovery
- Select which discovered devices are exposed to Apple HomeKit
- Custom Homebridge configuration interface
- HomeKit security system integration
- Support for switches, dimmers, sensors and thermostats
- Optional scenes and virtual devices
- Automatic MQTT synchronization and reconnection handling

## Requirements

- Homebridge
- Node.js
- A working MQTT broker
- A SATEL BE WAVE system with MQTT communication configured

## Installation

Once published, the plugin can be installed directly through the Homebridge UI.

1. Open Homebridge UI.
2. Navigate to Plugins.
3. Search for `homebridge-bewave-mqtt`.
4. Install the plugin.
5. Open the plugin settings and enter your MQTT broker details.
6. Select the BE WAVE devices you want to expose to HomeKit.
7. Save the configuration and restart Homebridge if required.

## MQTT Configuration

Default MQTT topic prefixes:

- Status: `bewave/status`
- Commands: `bewave/command`

The MQTT broker URL is required. Authentication is optional, depending on your broker configuration.

## Development Status

Version 1.0.0 is being prepared for public release.

The plugin has been tested in an existing Homebridge installation. Installation on a clean Raspberry Pi with Homebridge has not yet been independently verified.

## Disclaimer

This is an independent community project and is not officially affiliated with or endorsed by SATEL.

## License

MIT
