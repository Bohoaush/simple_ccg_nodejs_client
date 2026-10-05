// End to end test: runs main.js against a fake CasparCG and checks the playlist is played through.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");
const { createMockCasparcg } = require("../test_support/mockCasparcg.js");

const MAIN = path.join(__dirname, "..", "main.js");

function freePort() {
    return new Promise(resolve => {
        const srv = net.createServer().listen(0, "127.0.0.1", () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

function getJson(port, url) {
    return new Promise((resolve, reject) => {
        http.get({ host: "127.0.0.1", port, path: url }, res => {
            let body = "";
            res.on("data", d => body += d);
            res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
        }).on("error", reject);
    });
}

async function waitFor(condition, timeout, what) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        try {
            if (await condition()) return;
        } catch (e) { /* not ready yet */ }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error("Timed out waiting for " + what);
}

test("plays clips with dots in the name and stills without running away (#21, #24)", { timeout: 60000 }, async (t) => {
    const ccg = createMockCasparcg({
        "intro.v1": { type: "MOVIE", frames: 50, file: "intro.v1.mp4" },  // 2 s
        "show.2023": { type: "MOVIE", frames: 50, file: "show.2023.mov" },
        "logo": { type: "STILL", frames: 0, file: "logo.png" },
        "end.v2": { type: "MOVIE", frames: 50, file: "end.v2.mxf" },
        "amb": { type: "MOVIE", frames: 250, file: "amb.mp4" }
    });
    const ccgPort = await ccg.listen();
    const webPort = await freePort();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccgclient-"));
    fs.mkdirSync(path.join(dir, "daily_playlists"));
    fs.mkdirSync(path.join(dir, "playlists"));
    fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({
        ccg_ip: "127.0.0.1",
        ccg_port: ccgPort,
        frontend_port: webPort,
        on_restart: "daily",
        daily_enabled: false,
        still_duration: 2,
        trouble_clip: "AMB",
        interactive_console: false,
        log_level: "debug"
    }));
    const start = new Date(Date.now() - 500).toISOString().replace(/:/g, "_");
    fs.writeFileSync(path.join(dir, "daily_playlists", start + ".json"), JSON.stringify({
        PlaylistItems: [
            { id: "0", type: "clip", name: "Intro", path: "intro.v1", duration: "" },
            { id: "1", type: "clip", name: "Show", path: "show.2023", duration: "" },
            { id: "2", type: "clip", name: "Logo", path: "logo", duration: "" },
            { id: "3", type: "clip", name: "End", path: "end.v2", duration: "" }
        ]
    }));

    let output = "";
    const app = spawn(process.execPath, [MAIN], { cwd: dir });
    app.stdout.on("data", d => output += d);
    app.stderr.on("data", d => output += d);
    t.after(async () => {
        app.kill();
        await ccg.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    try {
        await waitFor(async () => (await getJson(webPort, "/getStatus")).status == "trouble", 30000, "the end of the playlist");
    } catch (err) {
        throw new Error(err.message + "\nCommands: " + ccg.commands.map(c => c.line).join(" | ") + "\nOutput:\n" + output);
    }

    const playlist = await getJson(webPort, "/playlist");
    assert.strictEqual(playlist.PlaylistItems[2].mediaType, "STILL");
    assert.strictEqual(playlist.PlaylistItems[2].duration, 2);
    assert.strictEqual(playlist.PlaylistItems[0].duration, 2);

    // order in which things went on air
    const lines = ccg.commands.map(c => c.line);
    const loads = lines.filter(l => /^LOADBG/.test(l));
    assert.match(loads[0], /show\.2023.*AUTO/i);
    assert.match(loads[1], /logo.*AUTO/i, "still is loaded with AUTO behind a clip (needs show.2023 detected as playing)");
    assert.ok(!/AUTO/i.test(loads[2]), "clip after a still must not use AUTO: " + loads[2]);
    assert.match(loads[2], /end\.v2/i);
    assert.match(loads[3], /AMB.*AUTO/i);
    assert.strictEqual(loads.length, 4, "no extra loads (runaway): " + loads.join(" | "));
    assert.strictEqual(ccg.foregroundName().toLowerCase(), "amb");

    // the still stayed on air for its duration
    const stillStart = ccg.commands.find(c => /^LOADBG.*end\.v2/i.test(c.line)).time;
    const stillEnd = ccg.commands.find(c => c.line.trim().toUpperCase() == "PLAY 1-1").time;
    assert.ok(stillEnd - stillStart >= 1000, "still was on air for " + (stillEnd - stillStart) + " ms");
});
