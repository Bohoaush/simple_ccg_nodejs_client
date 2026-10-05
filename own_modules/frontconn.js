var http = require("http");
var fs = require("fs");
var path = require("path");

var playlistHandler = require('./plyhndl.js');
var playoutHandler = require('./playout.js');
var configuration = require('./settings.js');
var ccg = require('./ccg.js');
var logger = require('./logging.js');

const EDITOR_FILE = path.join(__dirname, "..", "ply_editor.html");

function readBody(req) {
    return new Promise((resolve, reject) => {
        var body = "";
        req.on('data', data => { body += data; });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function sendJson(res, data, statusCode) {
    res.writeHead(statusCode || 200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
    logger.warn("frontend", message);
    sendJson(res, { error: message }, statusCode);
}

// Only allow opening playlists from the configured playlist folders
function isPlaylistPath(file) {
    var resolved = path.resolve(file);
    return [configuration.settings.plys, configuration.settings.daily_plys].some(dir => {
        var relative = path.relative(path.resolve(dir), resolved);
        return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
    });
}

async function listPlaylistsIn(directory) {
    try {
        var filenames = await playlistHandler.listAvailablePlaylists(directory);
        return filenames.map(filename => directory + filename);
    } catch (err) {
        logger.warn("frontend", "Couldn't list playlists in " + directory + ":", err.message);
        return [];
    }
}

async function handleRequest(req, res) {
    var url = req.url.split("?")[0];
    switch(url) {

        case "/playlist":
            return sendJson(res, playlistHandler.playlist);

        case "/play":
            var playBody = await readBody(req);
            if (playoutHandler.state.status == "paused") {
                playoutHandler.resume();
            } else {
                var itemIdToPlayNow;
                try {
                    itemIdToPlayNow = JSON.parse(playBody);
                } catch (err) {
                    return sendError(res, 400, "Invalid item id to play: " + playBody);
                }
                logger.info("frontend", "going to play: " + itemIdToPlayNow);
                playoutHandler.play(itemIdToPlayNow);
            }
            return res.end();

        case "/pause":
            switch(playoutHandler.state.status) {
                case "playing":
                    playoutHandler.pause();
                    break;

                case "paused":
                    playoutHandler.resume();
                    break;
            }
            return res.end();

        case "/next":
            playoutHandler.next();
            return res.end();

        case "/stop":
            playoutHandler.stop();
            return res.end();

        case "/plysend":
            if (req.method != 'POST') {
                return sendError(res, 405, "/plysend needs POST");
            }
            var receiveModPly = await readBody(req);
            try {
                var modifiedPlaylist = JSON.parse(receiveModPly);
                if (!Array.isArray(modifiedPlaylist.PlaylistItems)) {
                    throw new Error("missing PlaylistItems");
                }
                playlistHandler.playlist = playlistHandler.applyStillDurations(modifiedPlaylist);
            } catch (err) {
                return sendError(res, 400, "Received invalid playlist: " + err.message);
            }
            playlistHandler.playlistUpdated.emit('plyupdfin');
            return res.end();

        case "/exploreClips":
            try {
                return sendJson(res, await ccg.listClips());
            } catch (err) {
                return sendError(res, 502, "Couldn't list clips: " + err.message);
            }

        case "/getStatus":
            return sendJson(res, playoutHandler.state);

        case "/pushPlaylist":
            var receivedPushPlyObj;
            try {
                receivedPushPlyObj = JSON.parse(await readBody(req));
            } catch (err) {
                return sendError(res, 400, "Received invalid playlist to save");
            }
            var pushPlySubfolder = receivedPushPlyObj.svPlyIsDailyChk ? configuration.settings.daily_plys : configuration.settings.plys;
            // basename prevents writing outside the playlist folder
            var pushPlyFilename = path.basename(String(receivedPushPlyObj.svPlyFilename || ""));
            if (!pushPlyFilename) {
                return sendError(res, 400, "Missing playlist filename");
            }
            await playlistHandler.writePlaylistToFile(receivedPushPlyObj.uiLdPly, path.join(pushPlySubfolder, pushPlyFilename));
            return res.end();

        case "/avaPlys":
            var avaplys = await Promise.all([
                listPlaylistsIn(configuration.settings.daily_plys),
                listPlaylistsIn(configuration.settings.plys)
            ]);
            return sendJson(res, avaplys);

        case "/openPlyFile":
            var opnPlyName = await readBody(req);
            if (!isPlaylistPath(opnPlyName)) {
                return sendError(res, 403, "Refusing to open " + opnPlyName + ", it isn't in a playlist folder");
            }
            try {
                var uiPly = await playlistHandler.loadPlaylistFromFile(opnPlyName, "firstitem", false, true);
                res.writeHead(200, {'Content-Type': 'application/json'});
                return res.end(uiPly);
            } catch (err) {
                return sendError(res, 500, "Couldn't open playlist " + opnPlyName + ": " + err.message);
            }

        default:
            fs.readFile(EDITOR_FILE, function(err, data) {
                if (err) {
                    return sendError(res, 500, "Couldn't read " + EDITOR_FILE);
                }
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(data);
            });
            break;
    }
}

var server = http.createServer(function (req, res) {
    handleRequest(req, res).catch(err => {
        logger.error("frontend", "Error handling " + req.url + ":", err);
        if (!res.headersSent) {
            sendJson(res, { error: err.message }, 500);
        } else {
            res.end();
        }
    });
});

server.on('error', err => {
    logger.error("frontend", "Web interface server error:", err.message);
});

server.listen(configuration.settings.frontend_port, function() {
    logger.info("frontend", 'Web interface running at http://127.0.0.1:' + configuration.settings.frontend_port);
});

module.exports = { server };
