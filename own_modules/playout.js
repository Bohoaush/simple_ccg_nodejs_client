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
    //ccgtunnel,
    state,
    startPlayingFromFixed
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
        console.log(new Date(plitem.startTime) + "\n" + new Date(timeHandler.currentTime));
        if (plitem.startTime > timeHandler.currentTime) { 
            console.log("did break of");
            break;
        }
    }
    /*var seekAmount = Math.floor((timeHandler.currentTime - plitem.startTime)/1000);
    ccgtunnel.play(1, 1, playlistHandler.playlist.PlaylistItems[previousPlitemNumber].path, undefined, undefined, undefined, undefined, undefined, seekAmount);*/
    ccgtunnel.play(1, 1, playlistHandler.playlist.PlaylistItems[previousPlitemNumber].path);
    module.exports.state.status = "playing";
    module.exports.state.atItem = previousPlitemNumber;
    //timeHandler.nextEventStamp = playlistHandler.playlist.PlaylistItems[previousPlitemNumber + 1].startTime;
    loadNextItem();
}

timeHandler.timeEvent.on('nextEvent', function() {
    var testCurrentPlaying = setInterval(async function() {
        var ccgInfo = await ccgtunnel.info(1, 1).then(result => {
            var currentPlayingName = result.response.data.stage.layer.layer_1.foreground.file.name;
            currentPlayingName = currentPlayingName.replace(/\..*$/g,"");
            console.log(currentPlayingName + "\n" + playlistHandler.playlist.PlaylistItems[module.exports.state.loadedNext].path);
            if (currentPlayingName == playlistHandler.playlist.PlaylistItems[module.exports.state.loadedNext].path) {
                module.exports.state.atItem++;
                loadNextItem();
                clearInterval(this);
            }
        }).catch(err => {
            //error getting info from ccg TODO
            console.log(err);
        });
    }, 1000);
});

function loadNextItem() {
    var nextItemNumber = (module.exports.state.atItem + 1);
    console.log("nextItemNumber: " + nextItemNumber);
    console.log(playlistHandler.playlist.PlaylistItems[nextItemNumber]);
    //console.log(playlistHandler.playlist);
    ccgtunnel.loadbgAuto(1, 1, playlistHandler.playlist.PlaylistItems[nextItemNumber].path);
    module.exports.state.loadedNext = (nextItemNumber);
    playStatus.emit('statusChanged');
    timeHandler.nextEventStamp = playlistHandler.playlist.PlaylistItems[nextItemNumber].startTime;
}
