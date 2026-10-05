var configuration = require("./own_modules/settings.js");
var logger = require("./own_modules/logging.js");
var ccg = require("./own_modules/ccg.js");
var playlistHandler = require("./own_modules/plyhndl.js");
var playoutHandler = require("./own_modules/playout.js");
var frontendConnection = require("./own_modules/frontconn.js");
var cli = require("./own_modules/console.js");

process.on('unhandledRejection', (err) => {
    logger.error("main", "Unhandled promise rejection:", err);
});

cli.start();

logger.info("main", "Waiting for CasparCG at " + configuration.settings.ccg_ip + ":" + configuration.settings.ccg_port + "...");
ccg.whenConnected().then(loadStartupPlaylist).catch(err => {
    logger.error("main", "Couldn't load startup playlist:", err.message);
});

async function loadStartupPlaylist() {
    switch(configuration.settings.on_restart) {
        case "laststate":
            //filename, startTimeSource, skip duration assign, skip update finish
            await playlistHandler.loadPlaylistFromFile(configuration.settings.last_ply, "file", true, false);
            break;

        case "daily":
            var bestDailyPly = await playlistHandler.loadDailyPlaylists();
            if (bestDailyPly == undefined) {
                logger.warn("main", "No daily playlist found in " + configuration.settings.daily_plys);
                break;
            }
            logger.info("main", "Loading daily playlist " + bestDailyPly);
            await playlistHandler.loadPlaylistFromFile(bestDailyPly, "filename", false, false);
            break;

        case "empty":
            break;
    }
}

playlistHandler.playlistUpdated.on('plyupdfin', () => {
    if (playlistHandler.restartPlaybackAfterPlyLoad) {
        playoutHandler.startPlayingFromFixed();
        playlistHandler.restartPlaybackAfterPlyLoad = false;
    }
});
