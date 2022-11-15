var configuration = require("./own_modules/settings.js");
var playlistHandler = require("./own_modules/plyhndl.js");
var playoutHandler = require("./own_modules/playout.js");
var logger = require("./own_modules/logging.js");


setTimeout(function(){
    switch(configuration.settings.on_restart) {
        case "laststate":
            playlistHandler.loadPlaylistFromFile(configuration.settings.last_ply);
            playlistHandler.playlistUpdated.on('plyupdfin', function() {
                playoutHandler.startPlayingFromFixed();
            }, {once : true});
            console.log("1");
    }
}, 2000);

/*setInterval(function() {
    console.log(playlistHandler.playlist);
}, 1000);*/
