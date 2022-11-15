var fs = require("fs");
var playout = require("./playout.js");
var timeHandler = require("./timehndl.js");

const EventEmitter = require('events');
const playlistUpdated = new EventEmitter();


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



playlistUpdated.on('plyupdini', function(playlistJson) {
    playlist = JSON.parse(playlistJson);
    asignDurationsToPly(playlist).then(ply => {
        playlist = ply;
        module.exports.playlist = ply;
        console.log(module.exports.playlist);
        playlistUpdated.emit('plyupdfin');
    });
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

async function asignDurationsToPly(ply) {
    return new Promise(resolve => {
        var nextStartTime = timeHandler.currentTime;
        for (plitem of ply.PlaylistItems) {
            switch(plitem.type) {
            
                case "clip":
                    playout.ccgtunnel.cinf(plitem.path).then(result => {
                        var framecount = result.response.data.duration;
                        var framerate = result.response.data.fps;
                        framerate = framerate.replace("1/","");
                        plitem.duration = (framecount/framerate);
                        nextStartTime = plitem.startTime;
                        console.log(plitem);
                    }).catch(err => {
                        //error getting cinf from ccg TODO
                        console.log("foooooo");
                    });
                    break;
                console.log(plitem);
                //For now other items than clip are ignored
                //TODO implement decklink, rtmp, image, templates?
            }
            console.log(plitem);
        }
        resolve(ply);
    });
}

async function listAvailablePlaylists(directory) {
    return new Promise(resolve => {
        fs.readdir(directory, (err, filenames) => {
            resolve(filenames);
        });
    });
}
