 var http = require("http");
 var fs = require("fs");
 
 var playlistHandler = require('./own_modules/plyhndl.js');
 
 const EventEmitter = require('events');
 
 const userUpdatedPlaylist = new EventEmitter();
 const userUpdatedBehavior = new EventEmitter();
 
 
 
 module.exports = {
     
     userUpdatedBehavior, //use later as userUpdatedBehavior.emmit(userPlayout);?
     userUpdatedPlaylist
     
 };
 
 
 userPlaylist = null;
 userPlayout = {
     playoutStatus: "playing",
     playoutIdAt: 0
 };
 
 
 
 http.createServer(async function (req, res) {
     
    console.log("Got http request on: " + req.url);
    
    
    switch(req.url) {
        
        
        case "/playlist":
            res.write(JSON.stringify(playlist));
            return res.end();
            break;
        
            
        //TODO Many things from here don't belong in "Frontend connection" module
        case "/play":
            var plitemJsoObj = "";
            req.on('data', function(data) {
                plitemJsoObj += data;
            });
            req.on('end', function() {
                var itemIdToPlayNow = JSON.parse(plitemJsoObj);
                var itemNameToPlayNow = findPathFromPlyId(itemIdToPlayNow);
                play(1,1,itemNameToPlayNow);
                troubleCountRemaining = allowedTroubleCount;
                currentlyPlaying = itemIdToPlayNow;
                currentlyPlayingName = playPath;
                loadedNext = itemIdToPlayNow;
                status = "playing";
                startedPlayingAt = currentTime; // TODO Not used curently - for determining start times of next items
                previousCCGinfo = ccgtunnel.info(1, 1);
                delayInfo = 1;
                res.end();
            });
            break;
            
            
        //TODO /pause, /stop
            
            
        case "/plysend":
            if (req.method == 'POST') {
                var receiveModPly = "";
                req.on('data', function(data) {
                    receiveModPly += data;
                })
                req.on('end', function() {
                    playlist = JSON.parse(receiveModPly);
                    playlist.PlaylistItems.forEach(asignDurationsToPly);
                    res.end();
                });
            }
            break;
            
            
        case "/exploreClips":
            var returnCinf = await ccgtunnel.cls();
            console.log(JSON.stringify(returnCinf.response.data));
            res.write(JSON.stringify(returnCinf.response.data));
            res.end();
            break;
            
            
        case "/getStatus":
            if (currentlyPlaying != -1) {
                const returnStatus = {state:status,playId:currentlyPlaying,playPth:playlist.PlaylistItems[currentlyPlaying].path};
                res.write(JSON.stringify(returnStatus));
                res.end();
            }
            break;
            
            
        case "/pushPlaylist":
            var receivedPushPlyObjStr = "";
            req.on('data', function(data) {
                receivedPushPlyObjStr += data;
            });
            req.on('end', function() {
                var receivedPushPlyObj = JSON.parse(receivedPushPlyObjStr);
                var pushPlySubfolder;
                if (receivedPushPlyObj.svPlyIsDailyChk) {
                    pushPlySubfolder = "daily_playlists/";
                } else {
                    pushPlySubfolder = "playlists/";
                }
                fs.writeFile((pushPlySubfolder + receivedPushPlyObj.svPlyFilename), JSON.stringify(receivedPushPlyObj.uiLdPly), function(err) {
                    if (err) throw err;
                    console.log("New playlist saved");
                    FindDailyPlaylists();
                });
            });
            break;
            
            
        case "/avaPlys":
            var DailyPlaylists = [];
            var StandardPlaylists = [];
            const avaPlys = {DailyPlaylists, StandardPlaylists};
            fs.readdir("daily_playlists", (err, files) => {
                files.forEach(file => {
                    avaPlys.DailyPlaylists.push(file);
                });
                
                /*for (file of files) {
                    avaPlys.DailyPlaylists.push(file);
                }*/
            });
            fs.readdir("playlists", (err, files) => {
                for (file of files) {
                    avaPlys.StandardPlaylists.push(file);
                }
                res.write(JSON.stringify(avaPlys));
                res.end();
            });
            break;
            
            
        default:
            fs.readFile('ply_editor.html', function(err, data) {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.write(data);
                return res.end();
            });
            break;
            
    }
    
    
}).listen(interface_port);

// Log localhost http server start to console
console.log('Server running at http://127.0.0.1:' + interface_port);
