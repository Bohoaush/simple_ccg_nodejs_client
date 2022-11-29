var configuration = require("./own_modules/settings.js");
var playlistHandler = require("./own_modules/plyhndl.js");
var playoutHandler = require("./own_modules/playout.js");
var logger = require("./own_modules/logging.js");
var frontendConnection = require("./own_modules/frontconn.js");


setTimeout(function(){
    switch(configuration.settings.on_restart) {
        case "laststate":
            /////////////////////////////////////filename, startTimeSource, skip duration assign, skip update finish
            playlistHandler.loadPlaylistFromFile(configuration.settings.last_ply, "file", true, false);
            break;
            
        case "daily":
            playlistHandler.loadDailyPlaylists().then(x => {
                console.log(playlistHandler.bestDailyPly);
                playlistHandler.loadPlaylistFromFile(playlistHandler.bestDailyPly, "filename", false, false);
            });
            break;
        case "empty":
            break;
    }
}, 2000);

playlistHandler.playlistUpdated.once('plyupdfin', () => {
    playoutHandler.startPlayingFromFixed();
});

setInterval(function(){
    console.log(JSON.stringify(playoutHandler.state));
}, 1000);
