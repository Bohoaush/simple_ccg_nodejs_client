// Helpers without side effects (no connection, no settings), so they can be unit tested
var path = require("path");

module.exports = {
    stripExtension,
    sameClip,
    clipDuration,
    parseForeground,
    dailyPlaylistTime
};

// Daily playlists are named after the time they start, with ":" replaced by "_"
// (e.g. "2023-04-08T06_00_00.json"). Returns NaN for files not named this way.
function dailyPlaylistTime(filename) {
    var name = path.basename(String(filename));
    if (path.extname(name).toLowerCase() != ".json") {
        return NaN;
    }
    name = name.slice(0, -5).replace(/_/g, ":");
    return Date.parse(name);
}

function first(value) {
    return Array.isArray(value) ? value[0] : value;
}

function parseForeground(foreground) {
    var file = first(first(foreground)?.file);
    if (!file) {
        return undefined;
    }
    var name = first(file.name);
    var times = [].concat(file.time ?? []).map(t => parseFloat(first(t)?._ ?? first(t)));
    return {
        name: (name && typeof name == "object") ? name._ : name,
        time: isNaN(times[0]) ? undefined : times[0],
        duration: isNaN(times[1]) ? undefined : times[1]
    };
}

function clipDuration(info) {
    var framerate = info.framerate;
    // casparcg-connection only parses the denominator of the time base, so NTSC rates
    // (1001/30000, 1001/60000, 1001/24000) come out as 30000 etc.
    if (framerate > 1000) {
        framerate = framerate / 1001;
    }
    if (!info.frames || !framerate) {
        return 0;
    }
    return info.frames / framerate;
}

// Removes only the file extension, so "my.clip.v2.mp4" -> "my.clip.v2" and "folder.x/clip" stays as it is
function stripExtension(name) {
    return String(name).replace(/\.[^./\\]*$/, "");
}

function normalizeClipName(name) {
    return stripExtension(String(name).replace(/\\/g, "/")).toLowerCase();
}

// CasparCG reports the playing file with extension (and possibly with a longer path),
// playlist items reference clips the way CLS lists them (relative path, no extension).
function sameClip(playingName, playlistPath) {
    if (!playingName || !playlistPath) {
        return false;
    }
    var playing = normalizeClipName(playingName);
    var path = String(playlistPath).replace(/\\/g, "/").toLowerCase();
    var pathNoExt = normalizeClipName(playlistPath);
    return [path, pathNoExt].some(p => playing == p || playing.endsWith("/" + p));
}
