var http = require("http"); // For web interface
var fs = require("fs"); // For filesystem I/O
var url = require("url"); // For parsing url parameters
const {CasparCG} = require("casparcg-connection"); // For CasparCG communication
const mediainfo = require('node-mediainfo'); // For getting media duration

var currentTime = 0;
var playlist;
/*var plyNames[];
var plyPaths[];
var plyStartModes[];
var plyStartTimes[];
var plyStartAts[];
var plyEndAts[];
var plyDurations[];*/

//------------------------------User changeable variables-------------------------------------
var logLevel = 2; // Set console log level: 0 - error, 1 - warning, 2 - debug, 3 - show time updates too
var ccg_ip = "127.0.0.1"; // Set CasparCG server Ip address
var ccg_port = 5250; // Set CasparCG server port
var interface_port = 8084;
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

function trouble() {
    ccgtunnel.play(1, 1, "AMB");
}

function findPathFromPlyId(ply_id, _callback) {
    
        if (playlist != null) {
            if (logLevel > 1) {console.log("DEBUG: reading playlist: " + JSON.stringify(playlist)); }
            var returnVar = playlist.PlaylistItems[ply_id].path;
            return returnVar.toString();
            /*var fuckJavaScript = "js is always screwing with me :(";
            console.log("BEFORE RETURN: " + fuckJavaScript);
            return fuckJavaScript;*/
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
    
    
    //Fully coppied code, don't know what it does yet
    /*const getInfos = () => {
    ccgtunnel.info().then(function(fulfilled){
        console.log('RESPONSE!');
        console.log(fulfilled.response.data);
    },function(reason){
        console.log("-------REASON------");
        console.log(reason);
    });
    };*/
    
    
    // CINF through casparcg-connection doesn't work at the moment :(
    // TODO try _callback again
    //var mediaInfo = await ccgtunnel.cinf(pathToProbe);
    
    // Using http GET to media-scanner directly instead | I probably messed something up, doesn't work either...
    
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
            return duration;
            
        })
    })

    req.on('error', error => {
        console.error(error);
        return false;
    })

    req.end()
    
    //console.log(mediaInfo);
    
    
    //console.log(fullMediaInfo);
    //plitem.duration = 
}

function getDurationFromMediaInfo(mediaInfoString, _callback) {
    mediaInfoArray = mediaInfoString.split(" ");
    if (logLevel > 1) { console.log(mediaInfoArray); }
    // 0 - status, 1 - OSCpath, 2 - statusVerbal, 3 - space, 4 - type (MOVIE), 5 - space,
    // 6 - filesize, 7 - last modified, 8 - frame count, 9 - 1/framerate
    var duration = (mediaInfoArray[8] * mediaInfoArray[9]); // Should get duration in seconds
    return duration;
    
    _callback();
}

/*function getMediaInfoViaHttp (pathToProbe, _callback) {
    
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
            return d;
        })
    })

    req.on('error', error => {
        console.error(error);
        return false;
    })

    req.end()
    
    
    _callback();
}*/ //Isn't used?



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
    
    currentTime = timeNow.getFullYear().toString() + month + day + hour + minute + second;
    
    if (logLevel > 2) { console.log("DEBUG: Time: " + currentTime); }
}
