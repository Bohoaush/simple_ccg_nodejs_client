var http = require("http"); // For web interface
var fs = require("fs"); // For filesystem I/O
var url = require("url"); // For parsing url parameters
const {CasparCG} = require("casparcg-connection"); // For CasparCG communication
//const mediainfo = require('node-mediainfo'); // For getting media duration, Probably unused TODO remove unused

var currentTimeHR = 0; // Variable for human readable time
var currentTime = 0; // Variable for time in seconds since Jan 1st 1970

var playlist;

var status = "stoped";
var currentlyPlaying = -1;
var loadedNext = -1;
var previousCCGinfo = false;
var nextStartTime = 0;

var fixedEventsIds = [];
var fixedEventsTimes = [];
var fixedEventsAt = 0;

var delayInfoDefault = 3;
var delayInfo = delayInfoDefault;

//------------------------------User changeable variables-------------------------------------
var logLevel = 2; // Set console log level: 0 - error, 1 - warning, 2 - debug, 3 - show time updates too
var ccg_ip = "127.0.0.1"; // Set CasparCG server Ip address
var ccg_port = 5250; // Set CasparCG server port
var interface_port = 8084;
var media_scanner_port = 8000;
//--------------------------------------------------------------------------------------------

// Start http interface from file
http.createServer(function (req, res) {
    fs.readFile('ply_editor.html', function(err, data) {
        res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    return res.end();

});
    
    var parts = url.parse(req.url, true);
    var query = parts.query;
    if (logLevel > 1) {console.log("DEBUG: url parameters: " + JSON.stringify(query)); }
    if (Object.keys(query).length != 0) {
        if (logLevel > 1) {console.log("DEBUG: Processing parameters"); }
        /*try {*/
            var act = query["act"];
            if (act != null && act != "") {
                if (act == "play") {
                    var itemid = query["item"];
                    if (itemid != null && itemid != "" && itemid != undefined) {
                        var playPath = findPathFromPlyId(itemid);
                        console.log("AFTER RETURN: " + playPath);
                        if (playPath != false) {
                            play(1, 1, playPath);
                        } else {
                            console.log("ERROR: Can't find path for item " + itemid);
                        }
                    } else {
                        console.log("ERROR: Play called, but no ID specified!");
                    }
                } else if (act == "pause") {
                    
                } else if (act == "resume") {
                    
                } else if (act == "stop") {
                    ccgtunnel.stop(1, 1);
                    status = "stopped";
                } else {
                    console.log("ERROR: act parameter doesn't contain valid event");
                }
                if (logLevel > 1) { console.log("DEBUG: Tried calling action: " + act); }
            } else {
                if (logLevel > 0) {console.log("WARNING: Required act parameter not given!"); }
            }
        /*} catch {
            if (logLevel > 0) {console.log("WARNING: Required act parameter not given!"); }
        }*/
    }
    
    if (req.url == "/testdefault") {
        trouble();
    }
    
    if (req.url == "/test") {
        ccgtunnel.play(1, 1);
        status = "playing";
    }
    
}).listen(interface_port);

// Log localhost http server start to console
console.log('Server running at http://127.0.0.1:' + interface_port);

// Initialize CasparCG connection
var ccgtunnel = new CasparCG(ccg_ip, ccg_port);

// Send CasparCG play command
function play(channel, layer, itemname) {
    
    if (channel == 0) { channel = 1; }
    if (layer == 0) { layer = 1; }
    
    if (itemname != "") {
        ccgtunnel.play(channel, layer, itemname);
        if (logLevel > 1) { console.log("DEBUG: Sent play " + itemname); }
    } else {
        console.log("ERROR: Play called, but no itemname specified");
    }
    status = "playing";
}

function trouble() { // Will eventually be used as item to play, if something goes wrong
    ccgtunnel.play(1, 1, "AMB");
    status = "trouble";
}

function findPathFromPlyId(ply_id, _callback) {
    
        if (playlist != null) {
            if (logLevel > 1) {console.log("DEBUG: reading playlist: " + JSON.stringify(playlist)); }
            var returnVar = playlist.PlaylistItems[ply_id].path;
            return returnVar.toString();
        } else {
            console.log("ERROR: Cannot start playig, no playlist loaded!");
            return false;
        }
        _callback();
        
}

setTimeout(function(){loadPlaylist('playlist_template.json')}, 1000);


async function loadPlaylist(filename) {
    
    //try {
    fs.readFile(filename, function(err, data) {
        if (playlist != null) { var temporaryOldPlaylist = playlist; }
        playlist = JSON.parse(data);
        playlist.PlaylistItems.forEach(asignDurationsToPly); 
        
    });
    /*} catch {
        console.log("ERROR: Can't load playlist file!");
    }*/
}


async function asignDurationsToPly(plitem, index) {
    var pathToProbe = plitem.path;
    console.log("checking media: " + pathToProbe);
    
    var itemType = plitem.type;
    var startMode = plitem.startMode;
    var startTime = plitem.startTime;
    var startAt = plitem.startAt;
    var endAt = plitem.endAt;
    
    if (startMode == "fixed" && startTime != "" && startTime != "undefined" && startTime != "0") {
        if (logLevel > 1) { console.log("DEBUG: Adding event to fixed events"); }
        fixedEventsIds.push(index);
        fixedEventsTimes.push(startTime);
        console.log(fixedEventsIds);
        console.log(fixedEventsTimes);
    } else if (startMode == "fixed") {
        if (logLevel > 0) { console.log("WARNING: Found event in fixed mode without valid start time, ignoring"); }
    }
    
    if (itemType == "clip") {
    
        if (endAt != "auto" && logLevel > 0) { console.log("WARNING: Editing duration on clips not yet supported!"); }
        
        var duration = 0;
        
        // Gets CINF (file info) and processes to get needed values, if anything goes wrong, catch writes error in console
        ccgtunnel.cinf(pathToProbe).then(result => {
            var framecount = result.response.data.duration;
            var framerate = result.response.data.fps; // Framerate is returned in format 1/fps => additional processing is needed
            framerate = framerate.replace("1/", "");
            var duration = framecount / framerate;
            console.log("DEBUG: Duration of \"" + pathToProbe + "\" in seconds = " + duration);
            plitem.duration = duration;
            if (index > 0) {
                plitem.startTime = nextStartTime;
                nextStartTime = playlist.PlaylistItems[index - 1].startTime + duration;
            } else if (index == 0) {
                plitem.startTime = currentTime;
                nextStartTime = currentTime + duration;
            } else {
                console.log("ERROR: Invalid index given while asigning start times!");
            }
            var plyWriteback = JSON.stringify(playlist);
                fs.writeFile('playlist_template_aed.json', plyWriteback, (err) => {
                    if (err) throw err;
                    if ( logLevel > 1 ) { console.log('Data written to file'); }
            });
            /*if (index > 1) {
                nextStartTime = playlist.PlaylistItems[index - 1].startTime + duration;
            } else if (index == 1) {
                
            } else if (index == 0) {
                
            } else {
                console.log("ERROR: Invalid index given while asigning start times!");
            }*/
        }).catch(error => {
            console.log("CINF ERROR " + error);
        });
        
    } 
}



setInterval(function(){checkTime()}, 1000);

function checkTime() {
    
    var timeNow = new Date();
    
    var month = (timeNow.getMonth() + 1);
    if (month < 10) { month = "0" + month; }
    
    var day = timeNow.getDate();
    if (day < 10) { day = "0" + day; }
    
    var hour = timeNow.getHours();
    if (hour < 10) { hour = "0" + hour; }
    
    var minute = timeNow.getMinutes();
    if (minute < 10) { minute = "0" + minute; }
    
    var second = timeNow.getSeconds();
    if (second < 10) { second = "0" + second; }
    
    currentTimeHR = timeNow.getFullYear().toString() + month + day + hour + minute + second;
    currentTime = (timeNow.getTime() / 1000);
    
    if (logLevel > 2) { console.log("DEBUG: Time: " + currentTime); }
    
    if (fixedEventsIds.length > 0) {
        if (fixedEventsTimes[fixedEventsAt] <= currentTimeHR) {
            var playId = fixedEventsIds[fixedEventsAt];
            var playPath = findPathFromPlyId(playId);
            console.log("AFTER RETURN: " + playPath);
            // TODO Check how long it should have been already played and SEEK
            if (playPath != false) {
                play(1, 1, playPath);
                console.log("Started fixed event " + playPath);
                fixedEventsAt += 1;
                currentlyPlaying = (playId - 1);
                loadedNext = playId;
                status = "playing";
                startedPlayingAt = currentTime; // TODO Not used curently - for determining start times of next items
                previousCCGinfo = ccgtunnel.info(1, 1);
            } else {
                console.log("ERROR: Can't find path for item " + itemid);
            }
        }
    }
    
    
    getCurrentCCGinfo()
    
    // TODO Automatic loadbg of next items
    if (loadedNext == currentlyPlaying && status == "playing") {
        if (playlist.PlaylistItems.length > (loadedNext + 1)) {
            loadedNext += 1;
            var loadNextPath = playlist.PlaylistItems[loadedNext].path;
            ccgtunnel.loadbgAuto(1, 1, loadNextPath);
            if (logLevel > 1) { console.log("DEBUG: Loaded next item (" + loadedNext + ", " + loadNextPath + ")"); }
        } else {
            loadedNext = 0;
            var loadNextPath = playlist.PlaylistItems[loadedNext].path;
            ccgtunnel.loadbgAuto(1, 1, "AMB");
            status = "trouble";
            console.log("ERROR: Reached end of playlist! Entering trouble state");
        }
    }
    
}

// Check currently playing item and if not same as in previous check, LOADBG next
async function getCurrentCCGinfo(_callback) { 
    delayInfo -= 1;
    if (status == "playing" && delayInfo < 1) {
        try {
            var fullCCGinfo = await ccgtunnel.info(1, 1); // TODO redo for new-style promisse based workflow (.then =>)
            var CCGresponse = fullCCGinfo.response;
            var curPlayingName = CCGresponse.data.stage.layer.layer_1.foreground.file.name;
            console.log("DEBUG: Got currently playing info: " + curPlayingName);
            delayInfo = delayInfoDefault;
            if (previousCCGinfo != curPlayingName) {
                currentlyPlaying += 1;
                previousCCGinfo = curPlayingName;
            }
        } catch(e) {
            console.log("ERROR: " + e);
        }
    }
    _callback
}
