var fs = require("fs");

const SETTINGS_FILE = "./settings.json";

const defaultSettings = {
    ccg_ip: "127.0.0.1",
    ccg_port: 5250,
    frontend_port: 8084,
    on_restart: "laststate",
    state_file: "./lastState.json",
    last_ply: "./lastPly.json",
    daily_enabled: true,
    daily_plys: "./daily_playlists/",
    plys: "./playlists/",
    trouble_clip: "AMB",
    still_duration: 10,     // seconds a still image stays on air if the playlist item has no duration
    log_level: "info",      // debug, info, warn, error
    log_file: "",           // empty = log to console only
    interactive_console: true
};

module.exports = {
    settings: loadSettings(),
    defaultSettings
};

// Settings are loaded synchronously so every module can rely on them right after require().
// Keys missing from settings.json (e.g. added in a newer version) are filled with defaults.
function loadSettings() {
    var loaded = {};
    var needsWrite = false;
    try {
        loaded = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    } catch (err) {
        if (err.code != "ENOENT") {
            console.log("Couldn't read " + SETTINGS_FILE + ", using defaults: " + err.message);
        }
        needsWrite = (err.code == "ENOENT");
    }
    var settings = Object.assign({}, defaultSettings, loaded);
    if (needsWrite || Object.keys(defaultSettings).some(key => !(key in loaded))) {
        writeSettingsToFile(settings);
    }
    return settings;
}

function writeSettingsToFile(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 4));
    } catch (err) {
        console.log("Couldn't write " + SETTINGS_FILE + ": " + err.message);
    }
}
