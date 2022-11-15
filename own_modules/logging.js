var playlistHandler = require("./plyhndl.js");

var setLogLevel = 1; //TODO needs read from settings

playlistHandler.playlistUpdated.on('plyupdini', function() {
    log(1, "playlistHandler", "Playlist update initialized");
});

playlistHandler.playlistUpdated.on('plyupdfin', function() {
    log(1, "playlistHandler", "Playlist update completed");
});


function log(level, module, message) {
    if (level >= setLogLevel) {
        console.log(level + ": " + module + ": " + message);
    }
}
