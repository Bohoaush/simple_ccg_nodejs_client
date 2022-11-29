var fs = require("fs");

module.exports = {
    settings
}

var settings; //Don't use! Use module.exports.settings instead.

fs.readFile("./settings.json", function(err, data) {
    if (data != null) {
        module.exports.settings = JSON.parse(data);
    } else {
        generateSettings();
    }
});

function generateSettings() {
    module.exports.settings = {
        ccg_ip: "127.0.0.1",
        ccg_port: 5250,
        frontend_port: 8084, 
        on_restart: "laststate",
        state_file: "./lastState.json",
        last_ply: "./lastPly.json",
        daily_enabled: true,
        daily_plys: "./daily_playlists/",
        plys: "./playlists/",
        trouble_clip: "AMB"
    }
    writeSettingsToFile();
}

function writeSettingsToFile() {
    fs.writeFile("./settings.json", JSON.stringify(module.exports.settings), (err) => {
        if (err) throw err;
    });
}
