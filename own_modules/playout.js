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
        if (plitem.startTime > timeHandler.currentTime) {
            break;
        }
    }
    console.log(previousPlitemNumber);
    console.log("crt: " + timeHandler.currentTime + "\nstt: " + playlistHandler.playlist.PlaylistItems[previousPlitemNumber].startTime);
    var seekAmount = Math.floor((timeHandler.currentTime - playlistHandler.playlist.PlaylistItems[previousPlitemNumber].startTime)/40);
    console.log(seekAmount);
    ccgtunnel.play(1, 1, playlistHandler.playlist.PlaylistItems[previousPlitemNumber].path, undefined, undefined, undefined, undefined, undefined, seekAmount).then(x => {
        module.exports.state.status = "playing";
        module.exports.state.atItem = previousPlitemNumber;
        setTimeout(function() {loadNextItem();}, 1000);
    }).catch(err => {
        console.log(err); //TODO you know what...
    });
}

timeHandler.timeEvent.on('nextEvent', async function() { //TODO fix skipping same item
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
    var nextItemNumber = (module.exports.state.atItem + 1);
    ccgtunnel.loadbgAuto(1, 1, playlistHandler.playlist.PlaylistItems[nextItemNumber].path);
    module.exports.state.loadedNext = (nextItemNumber);
    playStatus.emit('statusChanged');
    timeHandler.nextEventStamp = playlistHandler.playlist.PlaylistItems[nextItemNumber].startTime;
}
