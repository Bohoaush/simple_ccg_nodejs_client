// Interactive console: a status line that is updated in place and a command prompt.
// Falls back to plain logging when the output isn't a terminal (e.g. running as a service).
var readline = require("readline");

var configuration = require("./settings.js");
var playlistHandler = require("./plyhndl.js");
var playoutHandler = require("./playout.js");
var logger = require("./logging.js");

const commands = {
    help: { args: "", text: "show this help", run: showHelp },
    status: { args: "", text: "print the playout status", run: () => print(statusText()) },
    list: { args: "", text: "print the loaded playlist", run: listPlaylist },
    play: { args: "<item>", text: "play item number <item> of the playlist", run: (id) => playoutHandler.play(Number(id)) },
    pause: { args: "", text: "pause / resume playback", run: () => playoutHandler.state.status == "paused" ? playoutHandler.resume() : playoutHandler.pause() },
    next: { args: "", text: "play the next item", run: () => playoutHandler.next() },
    stop: { args: "", text: "stop playback", run: () => playoutHandler.stop() },
    fixed: { args: "", text: "play the item that should be on air now, according to the schedule", run: () => playoutHandler.startPlayingFromFixed() },
    load: { args: "<file>", text: "load a playlist file and start it now", run: loadPlaylist },
    loglevel: { args: "<level>", text: "set log level (debug, info, warn, error)", run: (level) => { logger.setLevel(level); print("log level set to " + level); } },
    quit: { args: "", text: "exit the application", run: () => process.exit(0) }
};

var rl;

module.exports = {
    start,
    statusText,
    runCommand
};

function print(line) {
    if (rl) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(line + "\n");
        refreshPrompt();
    } else {
        console.log(line);
    }
}

function formatDuration(ms) {
    var negative = ms < 0;
    var total = Math.floor(Math.abs(ms) / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var text = (h > 0 ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return (negative ? "-" : "") + text;
}

function statusText() {
    var state = playoutHandler.state;
    var items = (playlistHandler.playlist && playlistHandler.playlist.PlaylistItems) || [];
    var text = "[" + state.status.toUpperCase() + "]";
    if (items.length == 0) {
        return text + " no playlist loaded";
    }
    var current = items[state.atItem];
    text += " " + (state.atItem + 1) + "/" + items.length;
    if (current) {
        text += " " + (current.name || current.path || current.type);
        var nextItem = items[state.atItem + 1];
        var end = nextItem ? Number(nextItem.startTime) : (Number(current.startTime) + Number(current.duration) * 1000);
        if (state.status == "playing" && end && Number(current.duration) > 0) {
            text += " (remaining " + formatDuration(end - Date.now()) + ")";
        }
        if (state.nextName) {
            text += " | next: " + state.nextName;
        }
    }
    return text;
}

function refreshPrompt() {
    if (!rl) {
        return;
    }
    var columns = process.stdout.columns || 80;
    var prompt = statusText();
    if (prompt.length > columns - 15) {
        prompt = prompt.slice(0, columns - 18) + "...";
    }
    rl.setPrompt(prompt + " > ");
    rl.prompt(true);
}

function showHelp() {
    var lines = ["Commands:"];
    for (var name in commands) {
        lines.push("  " + (name + " " + commands[name].args).padEnd(18) + commands[name].text);
    }
    print(lines.join("\n"));
}

function listPlaylist() {
    var items = (playlistHandler.playlist && playlistHandler.playlist.PlaylistItems) || [];
    if (items.length == 0) {
        return print("no playlist loaded");
    }
    var lines = items.map((item, index) => {
        var marker = (index == playoutHandler.state.atItem) ? ">" : " ";
        var start = item.startTime ? new Date(Number(item.startTime)).toLocaleTimeString() : "";
        return marker + " " + String(index).padStart(3) + "  " + start.padEnd(11) + " " + formatDuration((Number(item.duration) || 0) * 1000).padStart(8) + "  " + (item.name || item.path || item.type);
    });
    print(lines.join("\n"));
}

function loadPlaylist(file) {
    if (!file) {
        return print("usage: load <file>");
    }
    playlistHandler.restartPlaybackAfterPlyLoad = true;
    playlistHandler.loadPlaylistFromFile(file, "now", false, false).catch(err => {
        logger.error("console", "Couldn't load " + file + ":", err.message);
    });
}

function runCommand(line) {
    var [name, ...args] = line.trim().split(/\s+/);
    if (!name) {
        return;
    }
    var command = commands[name.toLowerCase()];
    if (!command) {
        return print("Unknown command '" + name + "', type help for the list of commands");
    }
    try {
        var result = command.run(args.join(" "));
        if (result && result.catch) {
            result.catch(err => logger.error("console", err.message));
        }
    } catch (err) {
        logger.error("console", err.message);
    }
}

function start() {
    var interactive = configuration.settings.interactive_console && process.stdin.isTTY && process.stdout.isTTY;
    if (!interactive) {
        playoutHandler.playStatus.on('statusChanged', () => logger.info("status", statusText()));
        return;
    }
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    logger.setPrinter(print);
    rl.on('line', line => {
        runCommand(line);
        refreshPrompt();
    });
    rl.on('close', () => process.exit(0));
    setInterval(refreshPrompt, 1000);
    print("Type help for the list of commands.");
}
