var timeHandler = require("./timehndl.js");
var playlistHandler = require("./plyhndl.js");
var configuration = require("./settings.js");
var ccg = require("./ccg.js");
var logger = require("./logging.js");
var fs = require("fs");

const EventEmitter = require('events');
const playStatus = new EventEmitter();

const NEVER = 9999999999999;

var state = {
    status: "stopped",
    atItem: 0,
    loadedNext: 0,
    manualNext: false,  // true = next item is loaded without AUTO and has to be started by us (stills, live inputs)
    currentName: "",
    nextName: ""
};

var pausedAt;

module.exports = {
    state,
    playStatus,
    startPlayingFromFixed,
    play,
    pause,
    resume,
    next,
    stop,
};

playStatus.on('statusChanged', function(){
    fs.writeFile(configuration.settings.state_file, JSON.stringify(state), (err) => {
        if (err) {
            logger.error("playout", "Couldn't write state file:", err.message);
        }
    });
});

function items() {
    return (playlistHandler.playlist && playlistHandler.playlist.PlaylistItems) || [];
}

function troubleItem() {
    return { type: "clip", name: "trouble", path: configuration.settings.trouble_clip, loop: true, duration: 0 };
}

// index == playlist length means "the trouble clip after the end of the playlist"
function itemAt(index) {
    return (index < items().length) ? items()[index] : troubleItem();
}

function itemLabel(plitem) {
    if (!plitem) {
        return "";
    }
    if (plitem.type == "decklink") {
        return plitem.name || ("decklink " + plitem.device);
    }
    return plitem.name || plitem.path;
}

function setStatus(status) {
    state.status = status;
    state.currentName = itemLabel(itemAt(state.atItem));
    playStatus.emit('statusChanged');
}

async function startPlayingFromFixed() {
    var plitems = items();
    if (plitems.length == 0) {
        logger.warn("playout", "Can't start playing, playlist is empty");
        return;
    }
    // last item that should already have started
    var itemToPlay = 0;
    for (var i = 0; i < plitems.length; i++) {
        if (plitems[i].startTime <= timeHandler.currentTime) {
            itemToPlay = i;
        } else {
            break;
        }
    }
    var startTime = Number(plitems[itemToPlay].startTime);
    var elapsed = startTime ? Math.max(0, Date.now() - startTime) : 0;
    play(itemToPlay, Math.floor(elapsed / 40), false);
}

// seek is in frames (assuming 25 fps)
function play(id, seek, loop) {
    id = Number(id);
    if (!Number.isInteger(id) || id < 0 || id >= items().length) {
        logger.warn("playout", "Can't play item " + id + ", it isn't in the playlist");
        return Promise.resolve();
    }
    var plitem = items()[id];
    seek = seek || 0;
    logger.info("playout", "Playing item " + id + " (" + itemLabel(plitem) + ")" + (seek ? " from frame " + seek : ""));

    var playing;
    if (plitem.type == "decklink") {
        playing = ccg.playDecklink(plitem.device, plitem.format);
    } else if (playlistHandler.isTimedItem(plitem)) {
        playing = ccg.playClip(plitem.path, 0, false);
    } else {
        playing = ccg.playClip(plitem.path, seek, loop);
    }
    timeHandler.nextEventStamp = NEVER;
    return playing.then(() => {
        state.atItem = id;
        plitem.startTime = Date.now() - (seek * 40);
        pausedAt = undefined;
        setStatus("playing");
        setTimeout(loadNextItem, 1000);
    }).catch(err => {
        logger.error("playout", "Couldn't play " + itemLabel(plitem) + ":", err.message);
    });
}

function pause() {
    return ccg.pause().then(() => {
        timeHandler.nextEventStamp = NEVER;
        pausedAt = Date.now();
        setStatus("paused");
    }).catch(err => {
        logger.error("playout", "Couldn't pause:", err.message);
    });
}

function resume() {
    return ccg.resume().then(() => {
        if (pausedAt != undefined) {
            // timed items (stills, live) should stay on air for their full duration
            var current = items()[state.atItem];
            if (current) {
                current.startTime += (Date.now() - pausedAt);
            }
            pausedAt = undefined;
        }
        setStatus("playing");
        loadNextItem();
    }).catch(err => {
        logger.error("playout", "Couldn't resume:", err.message);
    });
}

function next() {
    var nextItemNumber = state.atItem + 1;
    if (nextItemNumber >= items().length) {
        logger.warn("playout", "Already at the last item");
        return Promise.resolve();
    }
    return play(nextItemNumber, 0, false);
}

function stop() {
    return ccg.stop().then(() => {
        timeHandler.nextEventStamp = NEVER;
        setStatus("stopped");
    }).catch(err => {
        logger.error("playout", "Couldn't stop:", err.message);
    });
}

timeHandler.timeEvent.on('nextEvent', async function() {
    if (state.manualNext) {
        await switchToLoadedItem();
        return;
    }
    try {
        var foreground = await ccg.foregroundInfo();
        var expected = itemAt(state.loadedNext);
        if (
            foreground &&
            ccg.sameClip(foreground.name, expected.path) &&
            (foreground.time == undefined || foreground.time < 2)
        ) {
            onItemStarted(state.loadedNext);
        }
    } catch (err) {
        logger.warn("playout", "Couldn't get info from CasparCG:", err.message);
    }
});

// Starts the item loaded in the background (used when it wasn't loaded with AUTO)
async function switchToLoadedItem() {
    timeHandler.nextEventStamp = NEVER;
    try {
        await ccg.playLoaded();
        onItemStarted(state.loadedNext);
    } catch (err) {
        logger.error("playout", "Couldn't start the next item:", err.message);
        trouble();
    }
}

function onItemStarted(index) {
    timeHandler.nextEventStamp = NEVER;
    if (index >= items().length) {
        logger.warn("playout", "Reached end of playlist, playing trouble clip");
        state.atItem = index;
        setStatus("trouble");
        return;
    }
    state.atItem = index;
    items()[index].startTime = Date.now();
    setStatus("playing");
    loadNextItem();
}

function trouble() {
    ccg.loadbgClip(configuration.settings.trouble_clip, true, true).catch((err) => {
        logger.error("playout", "Couldn't load trouble file!", err.message);
    });
    setStatus("trouble");
}

async function loadNextItem() {
    var current = items()[state.atItem];
    if (!current) {
        return;
    }
    var nextItemNumber = state.atItem + 1;
    var nextItem = itemAt(nextItemNumber);
    if (nextItemNumber >= items().length) {
        logger.warn("playout", "Last item of the playlist is playing, trouble clip will follow");
    }

    // AUTO only works when the foreground is a clip that ends by itself, and LOADBG DECKLINK can't do AUTO.
    var useAuto = !playlistHandler.isTimedItem(current) && nextItem.type != "decklink";
    try {
        if (nextItem.type == "decklink") {
            await ccg.loadbgDecklink(nextItem.device, nextItem.format);
        } else {
            await ccg.loadbgClip(nextItem.path, useAuto, nextItem.loop);
        }
    } catch (err) {
        logger.error("playout", "Failed to load next item!", err.message);
        trouble();
        return;
    }
    state.loadedNext = nextItemNumber;
    state.manualNext = !useAuto;
    state.nextName = itemLabel(nextItem);
    playStatus.emit('statusChanged');

    var switchTime = await currentItemEnd(current);
    if (switchTime == undefined) {
        logger.info("playout", itemLabel(current) + " has no duration, waiting for next to be pressed");
        timeHandler.nextEventStamp = NEVER;
        return;
    }
    if (nextItemNumber < items().length) {
        items()[nextItemNumber].startTime = switchTime;
        for (let nnin = (nextItemNumber + 1); nnin < items().length; nnin++) {
            items()[nnin].startTime = (items()[nnin - 1].startTime + (items()[nnin - 1].duration * 1000));
        }
    }
    timeHandler.nextEventStamp = switchTime;
}

// Returns the time the current item ends, or undefined if it doesn't end by itself
async function currentItemEnd(current) {
    var duration = Number(current.duration) || 0;
    if (playlistHandler.isTimedItem(current)) {
        return (duration > 0) ? (Number(current.startTime) + duration * 1000) : undefined;
    }
    try {
        var foreground = await ccg.foregroundInfo();
        if (foreground && foreground.duration != undefined && foreground.time != undefined) {
            return Date.now() + ((foreground.duration - foreground.time) * 1000);
        }
    } catch (err) {
        logger.warn("playout", "Couldn't get info from CasparCG:", err.message);
    }
    return Number(current.startTime) + duration * 1000;
}
