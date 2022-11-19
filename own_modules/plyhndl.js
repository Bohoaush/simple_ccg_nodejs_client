var fs = require("fs");
//var playout = require("./playout.js");
var timeHandler = require("./timehndl.js");

const EventEmitter = require('events');
const playlistUpdated = new EventEmitter();

var nextStartTime;

var playlist;
var avaDailyPlys = [];
console.log(avaDailyPlys);


module.exports = {
    //variables
    playlist,
    avaDailyPlys,
    //event emitters/listeners
    playlistUpdated,
    //functions
    loadPlaylistFromFile,
    loadDailyPlaylists
}

setTimeout(function() {
    module.exports.playlist = playlist;
}, 5000);

playlistUpdated.on('plyupdini', async function(playlistJson) {
    playlist = JSON.parse(playlistJson);
    nextStartTime = timeHandler.currentTime;
    playlist.PlaylistItems.forEach(asignDurationsToPly);
    module.exports.playlist = playlist;
    //console.log(module.exports.playlist);
    playlistUpdated.emit('plyupdfin');
});

async function loadPlaylistFromFile(filename) {
   fs.readFile(filename, (err, data) => {
        if (data != null) {
            playlistUpdated.emit('plyupdini', data);
        } else if (err) {
            console.log(err);
        }
   });
}

timeHandler.timeEvent.on('everyTenSeconds', function() {
    loadDailyPlaylists();
});

async function loadDailyPlaylists() {
    avaDailyPlys = await listAvailablePlaylists("../daily_playlists");
}

function asignDurationsToPly(plitem, index) {
    return new Promise(resolve => {
        switch(plitem.type) {
        
            case "clip":
                console.log(plitem.id);
                global.ccgtunnel.cinf(plitem.path).then(result => {
                    console.log(plitem.id);
                    var framecount = result.response.data.duration;
                    var framerate = result.response.data.fps;
                    framerate = framerate.replace("1/","");
                    plitem.duration = (framecount/framerate);
                    plitem.startTime = nextStartTime;
                    nextStartTime.setTime(plitem.startTime.getTime() + (plitem.duration * 1000));
                    console.log(plitem);
                }).catch(err => {
                    //error getting cinf from ccg TODO
                    console.log("foooooo" + err);
                });
                break;
            //For now other items than clip are ignored
            //TODO implement decklink, rtmp, image, templates?
        }
        resolve('done');
    });
}

async function listAvailablePlaylists(directory) {
    return new Promise(resolve => {
        fs.readdir(directory, (err, filenames) => {
            resolve(filenames);
        });
    });
}
