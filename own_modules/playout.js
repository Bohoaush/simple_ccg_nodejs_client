var timeHandler = require("./timehndl.js");
var playlistHandler = require("./timehndl.js");
var configuration = require("./settings.js");
const {CasparCG} = require("casparcg-connection");
var fs = require("fs");

const EventEmitter = require('events');
const playStatus = new EventEmitter();

module.exports = {
    ccgtunnel,
    state,
    startPlayingFromFixed
}

var ccgtunnel;

var state = {
    status: "stopped",
    atItem: 0,
    loadedNext: 0/*, 
    currentName: "",
    nextName: ""*/
}

setTimeout( function() {
    ccgtunnel = new CasparCG(configuration.settings.ccg_ip, configuration.settings.ccg_port);
    module.exports.ccgtunnel = ccgtunnel;
}, 1000);



playStatus.on('statusChanged', function(){
    fs.writeFile(configuration.settings.state_file, JSON.stringify(state), (err) => {
        if (err) throw err;
    });
});

async function startPlayingFromFixed() {
    console.log("2");
    var previousPlitemNumber = -2
    for (plitem of playlistHandler.playlist.PlaylistItems) {
        previousPlitemNumber++;
        if (plitem.startTime < timeHandler.currentTime) { break; }
    }
    var seekAmount = (timeHandler.currentTime - plitem.startTime);
    ccgtunnel.play(1, 1, playlistHandler.playlist.PlaylistItems[previousPlitemNumber].path, undefined, undefined, undefined, undefined, undefined, seekAmount);
    state.status = "playing";
    state.atItem = previousPlitemNumber;
    //timeHandler.nextEventStamp = playlistHandler.playlist.PlaylistItems[previousPlitemNumber + 1].startTime;
    loadNextItem();
}

timeHandler.timeEvent.on('nextEvent', function() {
    var testCurrentPlaying = setInterval(async function() {
        var ccgInfo = await ccgtunnel.info(1, 1).then(result => {
            var currentPlayingName = result.response.data.stage.layer.layer_1.foreground.file.name;
            currentPlayingName = currentPlayingName.replace("\..*$","");
            if (currentPlayingName == playlistHandler.playlist.PlaylistItems[nextItemNumber]) {
                state.atItem++;
                loadNextItem();
                clearInterval(testCurrentPlaying);
            }
        }).catch(err => {
            //error getting info from ccg TODO
        });
    }, 1000);
});

function loadNextItem() {
    var nextItemNumber = (state.atItem + 1);
    ccgtunnel.loadbgAuto(1, 1, playlistHandler.playlist.PlaylistItems[nextItemNumber]);
    state.loadedNext = (nextItemNumber);
    playStatus.emit('statusChanged');
}
