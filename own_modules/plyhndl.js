var fs = require("fs");
//var playout = require("./playout.js");
var timeHandler = require("./timehndl.js");
var configuration = require("./settings.js");

const EventEmitter = require('events');
const playlistUpdated = new EventEmitter();

var nextStartTime;

var playlist;
var avaDailyPlys = [];
var bestDailyPly;


module.exports = {
    //variables
    playlist,
    avaDailyPlys,
    bestDailyPly,
    //event emitters/listeners
    playlistUpdated,
    //functions
    loadPlaylistFromFile,
    loadDailyPlaylists
}

setTimeout(function() {
    module.exports.playlist = playlist;
}, 5000);

playlistUpdated.on('plyupdini', async function(playlistJson, skipDurAssign, skipUpdFin) { 
    playlist = JSON.parse(playlistJson);
    if (!skipDurAssign) {
        playlist.PlaylistItems.forEach(
            function(plitem, index){
                asignDurationsToPly(plitem, index, playlist.PlaylistItems.length, skipUpdFin);
            }
        );
    } else {
        playlistUpdated.emit('plyupddur', skipUpdFin);
    }
    /*if (!skipUpdFin) {
        module.exports.playlist = playlist;
        playlistUpdated.emit('plyupdfin');
    }*/
});

playlistUpdated.on('plyupddur', function(skipUpdFin) {
    if (!skipUpdFin) {
        module.exports.playlist = playlist;
        playlistUpdated.emit('plyupdfin');
    }
});

playlistUpdated.on('plyupdfin', function() {
    writePlaylistToFile(module.exports.playlist, configuration.settings.last_ply);
});

async function loadPlaylistFromFile(filename, startTimeSource, skipDuraAssign, skipUpdaFin) { 
    return new Promise(resolve => {
        fs.readFile(filename, (err, data) => {
                if (data != null) {
                    switch(startTimeSource) {
                        case "filename":
                            filename = filename.replace(configuration.settings.daily_plys,"");
                            filename = filename.replace(/_/g,":");
                            filename = filename.replace(".json","");
                            nextStartTime = (Date.parse(filename));
                            if (!nextStartTime) {
                                nextStartTime = timeHandler.currentTime;
                            }
                            break;
                        
                        case "now":
                            nextStartTime = timeHandler.currentTime;
                            break;
                            
                        default:
                            nextStartTime = (JSON.parse(data)).PlaylistItems[0].startTime;
                            break;
                    }
                    playlistUpdated.emit('plyupdini', data, skipDuraAssign, skipUpdaFin);
                    resolve(data);
                } else if (err) {
                    console.log(err);
                }
        });
        
    });
}

timeHandler.timeEvent.on('everyTenSeconds', function() {
    if (configuration.settings.daily_enabled = true) { loadDailyPlaylists();}
});

async function loadDailyPlaylists() {
    return new Promise(resolve => {
        listAvailablePlaylists(configuration.settings.daily_plys).then(playlists => {
            module.exports.avaDailyPlys = playlists;
            var prevdaiply = -2
            var tempdaiply = "";
            for (daiply of playlists) {
                prevdaiply++;
                tempdaiply = daiply.replace(".json","");
                tempdaiply = tempdaiply.replace(/_/g,":");
                tempdaiply = Date.parse(tempdaiply);
                if (tempdaiply > timeHandler.currentTime) {
                    break;
                } else if (playlists[prevdaiply+2] == undefined) {
                    prevdaiply = (prevdaiply + 1);
                }
            }
            if (prevdaiply < 0) {prevdaiply = 0;}
            module.exports.bestDailyPly = (configuration.settings.daily_plys + module.exports.avaDailyPlys[prevdaiply]);
            resolve(module.exports.bestDailyPly);
        });
    });
}

function asignDurationsToPly(plitem, index, plyleng, skipUpdaFin) {
    switch(plitem.type) {
        
        case "clip":
            global.ccgtunnel.cinf(plitem.path).then(result => {
                var framecount = result.response.data.duration;
                var framerate = result.response.data.fps;
                framerate = framerate.replace("1/","");
                plitem.duration = (framecount/framerate);
                plitem.startTime = nextStartTime;
                nextStartTime = (plitem.startTime + (plitem.duration * 1000));
                if (plitem.id == (plyleng - 1)) {
                    playlistUpdated.emit('plyupddur', skipUpdaFin);
                }
            }).catch(err => {
                //error getting cinf from ccg TODO
                console.log("foooooo" + err);
            });
        //For now other items than clip are ignored
        //TODO implement decklink, rtmp, image, templates?
    }
}

async function listAvailablePlaylists(directory) {
    return new Promise(resolve => {
        fs.readdir(directory, (err, filenames) => {
            resolve(filenames);
        });
    });
}

async function writePlaylistToFile(playlistToWrite, file) {
    var plyWriteback = JSON.stringify(playlistToWrite);
    fs.writeFile(file, plyWriteback, (err) => {
        if (err) {
            //TODO handle fs write errors
            console.log(err);
        }
    });
}
