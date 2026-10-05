// Thin wrapper around casparcg-connection v6.
// Every function returns a promise that resolves with the response data,
// or rejects if the command couldn't be sent or CasparCG answered with an error code.
const { CasparCG, Commands } = require("casparcg-connection");
var configuration = require("./settings.js");
var logger = require("./logging.js");
var media = require("./mediautil.js");

const CHANNEL = 1;
const LAYER = 1;

var connection = new CasparCG({
    host: configuration.settings.ccg_ip,
    port: configuration.settings.ccg_port,
    autoConnect: true
});

connection.on("connect", () => logger.info("ccg", "Connected to CasparCG at " + configuration.settings.ccg_ip + ":" + configuration.settings.ccg_port));
connection.on("disconnect", () => logger.warn("ccg", "Disconnected from CasparCG"));
connection.on("error", (err) => logger.error("ccg", err));

module.exports = {
    connection,
    whenConnected,
    playClip,
    playLoaded,
    loadbgClip,
    playDecklink,
    loadbgDecklink,
    pause: () => send(connection.pause({ channel: CHANNEL, layer: LAYER })),
    resume: () => send(connection.resume({ channel: CHANNEL, layer: LAYER })),
    stop: () => send(connection.stop({ channel: CHANNEL, layer: LAYER })),
    clipInfo,
    listClips,
    foregroundInfo,
    sameClip: media.sameClip
};

function whenConnected() {
    if (connection.connected) {
        return Promise.resolve();
    }
    return new Promise(resolve => connection.once("connect", resolve));
}

async function send(sending) {
    var { error, request } = await sending;
    if (error) {
        throw error;
    }
    var response = await request;
    if (response.responseCode >= 400) {
        throw new Error(response.command + " failed: " + response.responseCode + " " + response.message);
    }
    return response.data;
}

function playClip(clip, seek, loop) {
    var params = { channel: CHANNEL, layer: LAYER, clip: clip, loop: !!loop };
    if (seek > 0) {
        params.seek = seek;
    }
    return send(connection.play(params));
}

// PLAY without a clip: plays what was loaded to the background
function playLoaded() {
    return send(connection.play({ channel: CHANNEL, layer: LAYER }));
}

function loadbgClip(clip, auto, loop) {
    return send(connection.loadbg({ channel: CHANNEL, layer: LAYER, clip: clip, auto: !!auto, loop: !!loop }));
}

function playDecklink(device, format) {
    return send(connection.executeCommand({
        command: Commands.PlayDecklink,
        params: { channel: CHANNEL, layer: LAYER, device: device, format: format || undefined }
    }));
}

function loadbgDecklink(device, format) {
    return send(connection.executeCommand({
        command: Commands.LoadbgDecklink,
        params: { channel: CHANNEL, layer: LAYER, device: device, format: format || undefined }
    }));
}

// Resolves with {type: "MOVIE"|"STILL"|"AUDIO", duration: seconds}
async function clipInfo(clip) {
    var info = await send(connection.cinf({ filename: clip }));
    if (!info || !info.type) {
        throw new Error("Unexpected CINF response for " + clip);
    }
    return { type: info.type, duration: media.clipDuration(info) };
}

// Resolves with [{name, type, duration}] (format expected by the web interface)
async function listClips() {
    var clips = await send(connection.cls({}));
    return (clips || []).map(clip => ({
        name: clip.clip,
        type: clip.type,
        duration: media.clipDuration(clip)
    }));
}

// Resolves with {name, time, duration} of the clip on the foreground of the playout layer,
// or undefined if nothing (or nothing file based) is playing.
async function foregroundInfo() {
    var data = await send(connection.infoChannel({ channel: CHANNEL }));
    var layer = data?.channel?.layers?.find(l => l.layer == LAYER);
    return media.parseForeground(layer?.foreground);
}
