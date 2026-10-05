# simple_ccg_nodejs_client

## Description
This node.js app is a simple multiplatform CasparCG playout client. It plays playlists of clips,
still images and decklink inputs on channel 1, layer 1 of a CasparCG server, and can switch
playlists automatically at a given time every day ("daily playlists").

## Warning
This app is still in development and it is also my first node.js app, therefore I don't recommend using it in production enviroments.

## Prerequisities
- node.js runtime (v18 or newer)
- CasparCG server 2.1 or newer (2.3 recommended)
- web browser (preferably chromium based)
- git

## Installation
```
git clone https://github.com/Bohoaush/simple_ccg_nodejs_client.git
cd simple_ccg_nodejs_client
npm install
```

## How to use
- run CasparCG media scanner
- run CasparCG
- run this app with `npm start` (or `node main.js`)
- go to the webinterface, by default running at 127.0.0.1:8084
- to change settings, edit the settings.json file, that is generated after the first run

### Console
When the app runs in a terminal, the last line shows the playout status (current item, remaining
time, next item) and you can type commands:

| command | |
|---|---|
| `help` | list commands |
| `status` | print the playout status |
| `list` | print the loaded playlist |
| `play <n>` | play item number `n` |
| `pause` | pause / resume |
| `next` | play the next item |
| `stop` | stop playback |
| `fixed` | play the item that should be on air now according to the schedule |
| `load <file>` | load a playlist file and start it now |
| `loglevel <level>` | change log level (`debug`, `info`, `warn`, `error`) |
| `quit` | exit |

When the output isn't a terminal (e.g. running as a service), or `interactive_console` is `false`,
status changes are written to the log instead.

### Settings
| key | default | |
|---|---|---|
| `ccg_ip`, `ccg_port` | `127.0.0.1`, `5250` | CasparCG server address |
| `frontend_port` | `8084` | port of the web interface |
| `on_restart` | `laststate` | what to play after start: `laststate`, `daily` or `empty` |
| `daily_enabled` | `true` | switch daily playlists automatically |
| `daily_plys`, `plys` | `./daily_playlists/`, `./playlists/` | playlist folders |
| `trouble_clip` | `AMB` | clip played when the playlist ends or an item fails to load |
| `still_duration` | `10` | seconds a still image is on air when its playlist item has no duration |
| `log_level` | `info` | `debug`, `info`, `warn` or `error` |
| `log_file` | empty | also write the log to this file |
| `interactive_console` | `true` | status line and command prompt in the terminal |

Settings missing from settings.json are added with their default value on start.

### Playlist items
Playlists are JSON files with a `PlaylistItems` array. Supported item types:
- `clip` - a video file or still image from the CasparCG media folder (`path` is the name as CasparCG lists it).
  Still images stay on air for `duration` seconds (or `still_duration` if not set).
- `decklink` - a decklink input, e.g. `{"type": "decklink", "device": 1, "duration": 0}`.
  With `duration` 0 the input stays on air until next is pressed, otherwise for `duration` seconds.

Daily playlists are named after their start time, with `_` instead of `:`, e.g. `2023-04-08T06_00_00.json`.

## Development
`npm test` runs the tests, including an end to end test against a fake CasparCG server.

### Tested on
Tests run automatically (GitHub Actions) on Ubuntu, Windows and macOS with node.js 18, 20 and 22.
Manually tested with a real CasparCG server:
- Ubuntu 18.04, node.js v14.15, Chromium (with the older casparcg-connection v5)

If you run it on another system, please report how it went in the issues.

## What's next
- To track what's going on with this project use the issues tab.
- You can also report bugs you find or suggest new features.
