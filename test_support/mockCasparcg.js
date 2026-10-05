// Minimal fake CasparCG server (AMCP over TCP) for tests.
// It simulates one channel with one layer: clips run in real time, LOADBG AUTO
// starts the background when the foreground clip ends - and immediately for stills,
// which is what made the playout run away through the playlist (#21).
const net = require("net");

function createMockCasparcg(clips) {
    const commands = [];
    let foreground;  // {name, startedAt, clip, paused}
    let background;  // {name, auto, clip}

    function clipFile(name) {
        const clip = clips[name.toLowerCase()];
        return clip ? clip.file : undefined;
    }

    function update() {
        if (foreground && background && background.auto && !foreground.paused) {
            const fgClip = foreground.clip;
            const length = (fgClip && fgClip.type == "MOVIE") ? fgClip.frames / 25 * 1000 : 0;
            if (Date.now() - foreground.startedAt >= length) {
                startBackground();
            }
        }
    }

    function startBackground() {
        foreground = { name: background.name, clip: background.clip, startedAt: Date.now() };
        background = undefined;
    }

    function infoXml() {
        update();
        let fg = "<producer>empty</producer>";
        if (foreground && foreground.clip) {
            const clip = foreground.clip;
            fg = "<producer>" + (clip.type == "STILL" ? "image" : "ffmpeg") + "</producer><file><name>" + clip.file + "</name>";
            if (clip.type == "MOVIE") {
                const elapsed = Math.min((Date.now() - foreground.startedAt) / 1000, clip.frames / 25);
                fg += "<time>" + elapsed.toFixed(2) + "</time><time>" + (clip.frames / 25).toFixed(2) + "</time>";
            }
            fg += "</file>";
        }
        return '<?xml version="1.0" encoding="utf-8"?><channel><framerate>50</framerate><mixer><audio><volume>0</volume></audio></mixer>' +
            "<stage><layer><layer_1><background><producer>empty</producer></background><foreground>" + fg + "</foreground></layer_1></layer></stage></channel>";
    }

    function handle(line) {
        let reqPrefix = "";
        const req = line.match(/^REQ (\S+) (.*)$/);
        if (req) {
            reqPrefix = "RES " + req[1] + " ";
            line = req[2];
        }
        commands.push({ time: Date.now(), line });
        const tokens = line.match(/"[^"]*"|\S+/g).map(t => t.replace(/^"|"$/g, ""));
        const cmd = tokens[0].toUpperCase();
        const ok = (code, name) => reqPrefix + code + " " + name + " OK\r\n";
        update();
        switch (cmd) {
            case "VERSION":
                return ok(201, "VERSION") + "2.3.3\r\n";
            case "CINF": {
                const clip = clips[tokens[1].toLowerCase()];
                if (!clip) return reqPrefix + "404 CINF FAILED\r\n";
                return ok(201, "CINF") + '"' + tokens[1].toUpperCase() + '" ' + clip.type + " 1000 20230101120000 " + clip.frames + " 1/25\r\n";
            }
            case "CLS":
                return ok(200, "CLS") + Object.keys(clips).map(name =>
                    '"' + name.toUpperCase() + '" ' + clips[name].type + " 1000 20230101120000 " + clips[name].frames + " 1/25").join("\r\n") + "\r\n\r\n";
            case "INFO":
                return ok(201, "INFO") + infoXml() + "\r\n";
            case "PLAY": {
                const name = tokens[2];
                if (name && name.toUpperCase() != "DECKLINK") {
                    if (!clipFile(name)) return reqPrefix + "404 PLAY FAILED\r\n";
                    foreground = { name, clip: clips[name.toLowerCase()], startedAt: Date.now() };
                    background = undefined;
                } else if (name) {
                    foreground = { name: "decklink", startedAt: Date.now() };
                } else if (background) {
                    startBackground();
                }
                return ok(202, "PLAY");
            }
            case "LOADBG": {
                const name = tokens[2];
                if (name.toUpperCase() == "DECKLINK") {
                    background = { name: "decklink", auto: false };
                    return ok(202, "LOADBG");
                }
                if (!clipFile(name)) return reqPrefix + "404 LOADBG FAILED\r\n";
                background = { name, clip: clips[name.toLowerCase()], auto: tokens.some(t => t.toUpperCase() == "AUTO") };
                return ok(202, "LOADBG");
            }
            case "PAUSE":
                if (foreground) foreground.paused = true;
                return ok(202, cmd);
            case "RESUME":
                if (foreground) foreground.paused = false;
                return ok(202, cmd);
            case "STOP":
                foreground = undefined;
                return ok(202, cmd);
            default:
                return ok(202, cmd);
        }
    }

    const sockets = new Set();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
        let buffer = "";
        socket.on("data", data => {
            buffer += data.toString();
            const lines = buffer.split("\r\n");
            buffer = lines.pop();
            for (const line of lines) {
                if (line.trim()) socket.write(handle(line));
            }
        });
    });
    const timer = setInterval(update, 20);

    return {
        commands,
        server,
        foregroundName: () => (update(), foreground && foreground.name),
        listen: () => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port))),
        close: () => {
            clearInterval(timer);
            for (const socket of sockets) socket.destroy();
            return new Promise(resolve => server.close(resolve));
        }
    };
}

module.exports = { createMockCasparcg };
