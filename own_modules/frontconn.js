 var http = require("http");
 var fs = require("fs");
 
 var playlistHandler = require('./plyhndl.js');
 var playoutHandler = require('./playout.js');
 var configuration = require('./settings.js');
 
 const EventEmitter = require('events');
 
 const userUpdatedPlaylist = new EventEmitter();
 const userUpdatedBehavior = new EventEmitter();
 
 setTimeout(function() {
    http.createServer(async function (req, res) {
        
        
        switch(req.url) {
            
            
            case "/playlist":
                res.write(JSON.stringify(playlistHandler.playlist));
                return res.end();
                break;
            
                
            case "/play":
                switch(playoutHandler.state) {
                    case "paused":
                        playoutHandler.resume();
                        break;
                        
                    default:
                        var plitemJsoObj = "";
                        req.on('data', function(data) {
                            plitemJsoObj += data;
                        });
                        req.on('end', function() {
                            var itemIdToPlayNow = JSON.parse(plitemJsoObj);
                            console.log("going to play: " + itemIdToPlayNow);
                            playoutHandler.play(itemIdToPlayNow);
                            res.end();
                        });
                        break;
                }
                break;
                

            case "/pause":
                switch(playoutHandler.state) {
                    case "playing":
                        playoutHandler.pause();
                        break;
                        
                    case "paused":
                        playoutHandler.resume();
                        break;
                }
                res.end();
                break;
                
                
            case "/stop":
                playoutHandler.stop();
                res.end();
                
                
            case "/plysend":
                if (req.method == 'POST') {
                    var receiveModPly = "";
                    req.on('data', function(data) {
                        receiveModPly += data;
                    })
                    req.on('end', function() {
                        playlistHandler.playlist = JSON.parse(receiveModPly);
                        playlistHandler.playlistUpdated.emit('plyupdfin');
                        res.end();
                    });
                }
                break;
                
                
            case "/exploreClips":
                global.ccgtunnel.cls().then(returnCls => {
                    console.log(JSON.stringify(returnCls.response.data));
                    res.write(JSON.stringify(returnCls.response.data));
                    res.end();
                }).catch(err => {
                    console.log(err);
                    res.write(JSON.stringify(err)); //TODO implement in frontend
                    res.end();
                });
                break;
                
                
            case "/getStatus":
                res.write(JSON.stringify(playoutHandler.state));
                res.end();
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
                        pushPlySubfolder = configuration.settings.daily_plys;
                    } else {
                        pushPlySubfolder = configuration.settings.plys;
                    }
                    playlistHandler.writePlaylistToFile((pushPlySubfolder + receivedPushPlyObj.svPlyFilename), receivedPushPlyObj.uiLdPly);
                });
                break;
                
                
            case "/avaPlys":
                //const avaPlys = {DailyPlaylists, StandardPlaylists};
                var DailyPlaylists = new Promise(resolve => {
                    playlistHandler.listAvailablePlaylists(configuration.settings.daily_plys).then(filenames => {
                        resolve(filenames);
                    }).catch(err => {
                        throw err;
                    });
                });
                var StandardPlaylists = new Promise(resolve => {
                    playlistHandler.listAvailablePlaylists(configuration.settings.plys).then(filenames => {
                        resolve(filenames);
                    }).catch(err => {
                        throw err;
                    });
                });
                Promise.all([DailyPlaylists,StandardPlaylists]).then(avaplys => {
                    res.write(JSON.stringify(avaplys));
                    res.end();
                }).catch(err => {
                    res.write(JSON.stringify(err));
                    console.log(err);
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
        
        
    }).listen(configuration.settings.frontend_port);

    // Log localhost http server start to console
    console.log('Server running at http://127.0.0.1:' + configuration.settings.frontend_port);
 }, 1000);
