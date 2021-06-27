var http = require("http"); // For web interface
var fs = require("fs"); // For filesystem I/O
var url = require("url"); // For parsing url parameters
const {CasparCG} = require("casparcg-connection"); // For CasparCG communication
const mediainfo = require('node-mediainfo'); // For getting media duration

var currentTimeHR = 0; // Variable for human readable time
var currentTime = 0; // Variable for time in seconds since Jan 1st 1970

var playlist;

var fixedEventsIds = [];
var fixedEventsTimes = [];
var fixedEventsAt = 0;

//------------------------------User changeable variables-------------------------------------
var logLevel = 2; // Set console log level: 0 - error, 1 - warning, 2 - debug, 3 - show time updates too
var ccg_ip = "127.0.0.1"; // Set CasparCG server Ip address
var ccg_port = 5250; // Set CasparCG server port
var interface_port = 8084;
var media_scanner_port = 8000; // Not used yet
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
    
}).listen(interface_port);

// Log localhost http server start to console
console.log('Server running at http://127.0.0.1:' + interface_port);

// Initialize CasparCG connection
var ccgtunnel = new CasparCG("127.0.0.1", 5250);

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
}

function trouble() { // Will eventually be used as item to play, if something goes wrong
    ccgtunnel.play(1, 1, "AMB");
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

loadPlaylist('playlist_template.json');


function loadPlaylist(filename) {
    
    //try {
    fs.readFile(filename, function(err, data) {
        if (playlist != null) { var temporaryOldPlaylist = playlist; }
        playlist = JSON.parse(data);
        playlist.PlaylistItems.forEach(asignDurationsToPly);
        // TODO check for media durations and write values back to playlist
        // TODO add next event times to array and check for them
    });
    /*} catch {
        console.log("ERROR: Can't load playlist file!");
    }*/
}

function asignDurationsToPly(plitem, index) {
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
    } else if (startMode == "fixed") {
        if (logLevel > 0) { console.log("WARNING: Found event in fixed mode without valid start time, ignoring"); }
    }
    
    if (itemType == "clip") {
    
        if (endAt != "auto" && logLevel > 0) { console.log("WARNING: Editing duration on clips not yet supported!"); }
        
        var duration = 0;
        
        const options = {
            hostname: '127.0.0.1',
            port: 8000,
            path: '/cinf/' + pathToProbe,
            method: 'GET'
        }

        const req = http.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`)

            res.on('data', d => {
                process.stdout.write(d);
                mediaInfoArray = (d + '').split(" ");
                if (logLevel > 1) { console.log(mediaInfoArray); }
                var framerate = mediaInfoArray[9].replace('1/','')
                var framecount = mediaInfoArray[8];
                if (logLevel > 1) { console.log("DEBUG: frame count: " + framecount + " / framerate: " + framerate); }
                var duration = (framecount / framerate);
                if (logLevel > 1) { console.log("DEBUG: Returning duration " + duration); }
                //return duration;
                plitem.duration = duration;
                var plyWriteback = JSON.stringify(playlist);
                fs.writeFile('playlist_template_aed.json', plyWriteback, (err) => {
                    if (err) throw err;
                    if ( logLevel > 1 ) { console.log('Data written to file'); }
                });
                
            })
        })

        req.on('error', error => {
            console.error(error);
            return false;
        })

        req.end()
    } 
        
}

function getDurationFromMediaInfo(mediaInfoString, _callback) { // Not used?
    mediaInfoArray = mediaInfoString.split(" ");
    if (logLevel > 1) { console.log(mediaInfoArray); }
    // 0 - status, 1 - OSCpath, 2 - statusVerbal, 3 - space, 4 - type (MOVIE), 5 - space,
    // 6 - filesize, 7 - last modified, 8 - frame count, 9 - 1/framerate
    var duration = (mediaInfoArray[8] * mediaInfoArray[9]); // Should get duration in seconds
    return duration;
    
    _callback();
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
    
    if (if fixedEventsIds.length > 0) {
        if (fixedEventsTimes[fixedEventsAt] >= currentTimeHR) {
            var playPath = findPathFromPlyId(fixedEventsIds[fixedEventsAt]);
            console.log("AFTER RETURN: " + playPath);
            if (playPath != false) {
                play(1, 1, playPath);
                console.log("Started fixed event " + playPath);
                fixedEventsAt += 1;
            } else {
                console.log("ERROR: Can't find path for item " + itemid);
            }
        }
    }
}
