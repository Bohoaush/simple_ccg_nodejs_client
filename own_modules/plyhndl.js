var fs = require("fs");
var timeHandler = require("./timehndl.js");
var configuration = require("./settings.js");
var ccg = require("./ccg.js");
var logger = require("./logging.js");
var media = require("./mediautil.js");

const EventEmitter = require('events');
const playlistUpdated = new EventEmitter();

module.exports = {
    //variables
    playlist: undefined,
    avaDailyPlys: [],
    bestDailyPly: undefined,
    nextDailyPly: undefined,
    restartPlaybackAfterPlyLoad: true,
    //event emitters/listeners
    playlistUpdated,
    //functions
    loadPlaylistFromFile,
    loadDailyPlaylists,
    writePlaylistToFile,
    listAvailablePlaylists,
    assignDurationsToPly,
    isTimedItem,
    applyStillDurations
};

playlistUpdated.on('plyupdini', function() {
    logger.debug("playlistHandler", "Playlist update initialized");
});

playlistUpdated.on('plyupdfin', function() {
    logger.info("playlistHandler", "Playlist update completed");
    writePlaylistToFile(module.exports.playlist, configuration.settings.last_ply);
});

// Items that don't end on their own in CasparCG (stills, live inputs).
// The playout switches away from them by itself after their duration
// (or waits for the operator to press next if they have no duration).
function isTimedItem(plitem) {
    return (plitem.type == "decklink" || plitem.type == "still" || plitem.mediaType == "STILL");
}

// Stills without a duration would end immediately, give them the default one
function applyStillDurations(playlistToProcess) {
    for (var plitem of playlistToProcess.PlaylistItems) {
        if (plitem.type != "decklink" && isTimedItem(plitem) && !(Number(plitem.duration) > 0)) {
            plitem.duration = Number(configuration.settings.still_duration) || 10;
        }
    }
    return playlistToProcess;
}

function parseStartTime(value) {
    var parsed = Number(value);
    return (value !== "" && !isNaN(parsed)) ? parsed : Date.now();
}

//filename, startTimeSource ("filename", "now", or anything else = first item), skip duration assign, skip update finish
//Resolves with the loaded playlist as JSON
async function loadPlaylistFromFile(filename, startTimeSource, skipDuraAssign, skipUpdaFin) {
    var data = await fs.promises.readFile(filename, 'utf-8');
    var newPlaylist = JSON.parse(data);
    if (!Array.isArray(newPlaylist.PlaylistItems)) {
        throw new Error(filename + " is not a valid playlist");
    }
    playlistUpdated.emit('plyupdini', data, skipDuraAssign, skipUpdaFin);

    var startTime;
    switch(startTimeSource) {
        case "filename":
            startTime = media.dailyPlaylistTime(filename);
            if (isNaN(startTime)) {
                startTime = Date.now();
            }
            break;

        case "now":
            startTime = Date.now();
            break;

        default:
            startTime = parseStartTime(newPlaylist.PlaylistItems[0]?.startTime);
            break;
    }

    if (!skipDuraAssign) {
        await assignDurationsToPly(newPlaylist, startTime);
    }
    playlistUpdated.emit('plyupddur', skipUpdaFin);
    if (!skipUpdaFin) {
        module.exports.playlist = newPlaylist;
        playlistUpdated.emit('plyupdfin');
    }
    return JSON.stringify(newPlaylist);
}

setInterval(function() {
    if (configuration.settings.daily_enabled) {
        loadDailyPlaylists().catch(err => {
            logger.warn("playlistHandler", "Couldn't list daily playlists:", err.message);
        });
    }
}, 10000);

timeHandler.timeEvent.on('nextDailyPly', function() {
    if (configuration.settings.daily_enabled && module.exports.nextDailyPly != undefined) {
        logger.info("playlistHandler", "Switching to daily playlist " + module.exports.nextDailyPly);
        module.exports.restartPlaybackAfterPlyLoad = true;
        loadPlaylistFromFile((configuration.settings.daily_plys + module.exports.nextDailyPly), "filename", false, false).catch(err => {
            logger.error("playlistHandler", "Couldn't load daily playlist " + module.exports.nextDailyPly + ":", err.message);
        });
    }
});

//Finds the daily playlist that should be playing now (bestDailyPly) and the one that comes next (nextDailyPly)
async function loadDailyPlaylists() {
    var playlists = await listAvailablePlaylists(configuration.settings.daily_plys);
    var dated = playlists
        .map(name => ({ name: name, time: media.dailyPlaylistTime(name) }))
        .filter(ply => !isNaN(ply.time))
        .sort((a, b) => a.time - b.time);
    module.exports.avaDailyPlys = dated.map(ply => ply.name);

    var now = Date.now();
    var current = dated.filter(ply => ply.time <= now).pop() || dated[0];
    var next = dated.find(ply => ply.time > now);

    module.exports.nextDailyPly = next ? next.name : undefined;
    timeHandler.nextDailyPlyStamp = next ? next.time : 9999999999999;
    module.exports.bestDailyPly = current ? (configuration.settings.daily_plys + current.name) : undefined;
    return module.exports.bestDailyPly;
}

// Asks CasparCG for the duration of every item and chains the start times.
// Items are processed in order, so start times don't depend on the order CasparCG answers in.
async function assignDurationsToPly(playlistToProcess, startTime) {
    var nextStartTime = startTime;
    for (var plitem of playlistToProcess.PlaylistItems) {
        await assignDuration(plitem);
        plitem.startTime = nextStartTime;
        nextStartTime = (plitem.startTime + (plitem.duration * 1000));
    }
    return playlistToProcess;
}

async function assignDuration(plitem) {
    var userDuration = Number(plitem.duration) || 0;
    switch(plitem.type) {
        case "clip":
        case "still":
            try {
                var info = await ccg.clipInfo(plitem.path);
                plitem.mediaType = info.type;
                if (info.type == "STILL" || info.duration <= 0) {
                    // a picture has no length of its own - without this it would end immediately
                    plitem.mediaType = "STILL";
                    plitem.duration = (userDuration > 0) ? userDuration : Number(configuration.settings.still_duration) || 10;
                } else {
                    plitem.duration = info.duration;
                }
            } catch (err) {
                logger.warn("playlistHandler", "Couldn't get info for " + plitem.path + ":", err.message);
                plitem.duration = userDuration;
            }
            break;

        default:
            // decklink and other live items: duration 0 means "until the operator presses next"
            plitem.duration = userDuration;
            break;
    }
}

async function listAvailablePlaylists(directory) {
    return fs.promises.readdir(directory);
}

async function writePlaylistToFile(playlistToWrite, file) {
    if (playlistToWrite == undefined) {
        return;
    }
    try {
        await fs.promises.writeFile(file, JSON.stringify(playlistToWrite));
    } catch (err) {
        logger.error("playlistHandler", "Couldn't write playlist to " + file + ":", err.message);
    }
}
