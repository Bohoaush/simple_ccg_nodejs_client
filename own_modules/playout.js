var timeHandler = require("./timehndl.js");
var playlistHandler = require("./plyhndl.js");
var configuration = require("./settings.js");
const {CasparCG} = require("casparcg-connection");
var fs = require("fs");

const EventEmitter = require('events');
const playStatus = new EventEmitter();

var state = { 
    status: "stopped",
    atItem: 0,
    loadedNext: 0/*, 
    currentName: "",
    nextName: ""*/
}

module.exports = {
    state,
    startPlayingFromFixed, 
    play,
    pause,
    resume,
    next,
    stop,
}

global.ccgtunnel;


setTimeout( function() {
    global.ccgtunnel = new CasparCG(configuration.settings.ccg_ip, configuration.settings.ccg_port);
    module.exports.ccgtunnel = ccgtunnel;
}, 1000);



playStatus.on('statusChanged', function(){
    fs.writeFile(configuration.settings.state_file, JSON.stringify(module.exports.state), (err) => {
        if (err) throw err;
    });
});

async function startPlayingFromFixed() {
    var previousPlitemNumber = -2;
    console.log(JSON.stringify(playlistHandler.playlist.PlaylistItems));
    for (plitem of playlistHandler.playlist.PlaylistItems) {
        previousPlitemNumber++;
        if (plitem.startTime > timeHandler.currentTime) {
            break;
        }
    }
    var seekAmount = Math.floor((timeHandler.currentTime - playlistHandler.playlist.PlaylistItems[previousPlitemNumber].startTime)/40);
    play(previousPlitemNumber, seekAmount, false);
}

function play(id, seek, loop) {
    console.log(id);
    ccgtunnel.play(1, 1, playlistHandler.playlist.PlaylistItems[id].path, loop, undefined, undefined, undefined, undefined, seek).then(x => {
        module.exports.state.status = "playing";
        module.exports.state.atItem = id;
        setTimeout(function() {loadNextItem();}, 1000);
    }).catch(err => {
        console.log(err); //TODO
    });
}

function pause() {
    ccgtunnel.pause(1,1).then(x => {
        module.exports.state.status = "paused";
        timeHandler.nextEventStamp = 9999999999999;
    }).cath(err => {
        console.log(err); //TODO
    });
}

function resume() {
    ccgtunnel.resume(1,1).then(x => {
        module.exports.state.status = "playing";
        loadNextItem();
    }).cath(err => {
        console.log(err); //TODO
    });
}

function next() {
    play((module.exports.atItem + 1), false, false);
    setTimeout(function() {loadNextItem();}, 1000);
}

function stop() {
    ccgtunnel.stop(1,1).then(x => {
        module.exports.state.status = "stopped";
        timeHandler.nextEventStamp = 9999999999999;
    }).cath(err => {
        console.log(err); //TODO
    });
}

function trouble() {
    ccgtunnel.loadBgAuto(1,1, configuration.settings.trouble_clip, true);
}

timeHandler.timeEvent.on('nextEvent', async function() { 
    var ccgInfo = await ccgtunnel.info(1, 1).then(result => {
        var currentPlayingName = result.response.data.stage.layer.layer_1.foreground.file.name;
        currentPlayingName = currentPlayingName.replace(/\..*$/g,"");
        if (
            currentPlayingName == playlistHandler.playlist.PlaylistItems[module.exports.state.loadedNext].path && 
            result.response.data.stage.layer.layer_1.foreground.file.time[0] < 2
        ) {
            module.exports.state.atItem = module.exports.state.loadedNext;
            loadNextItem();
        }
    }).catch(err => {
        //error getting info from ccg TODO
        console.log(err);
    });
});

function loadNextItem() {
    var nextItemNumber = (module.exports.state.atItem - -1);
    ccgtunnel.loadbgAuto(1, 1, playlistHandler.playlist.PlaylistItems[nextItemNumber].path);
    module.exports.state.loadedNext = (nextItemNumber);
    playStatus.emit('statusChanged');
    ccgtunnel.info(1,1).then(result => { //TODO do this on plyupdfin
        var remaDur = ((result.response.data.stage.layer.layer_1.foreground.file.time[1] - result.response.data.stage.layer.layer_1.foreground.file.time[0])*1000);
        playlistHandler.playlist.PlaylistItems[module.exports.state.loadedNext].startTime = (timeHandler.currentTime + remaDur);
        for (let nnin = (module.exports.state.loadedNext+1); nnin < playlistHandler.playlist.PlaylistItems.length; nnin++) {
            playlistHandler.playlist.PlaylistItems[nnin].startTime = (playlistHandler.playlist.PlaylistItems[nnin - 1].startTime + playlistHandler.playlist.PlaylistItems[nnin - 1].duration);
        }
        timeHandler.nextEventStamp = playlistHandler.playlist.PlaylistItems[nextItemNumber].startTime;
    }).catch(err => {
        console.log(err);
        timeHandler.nextEventStamp = playlistHandler.playlist.PlaylistItems[nextItemNumber].startTime;
    });
}
