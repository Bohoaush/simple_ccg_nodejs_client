const test = require("node:test");
const assert = require("node:assert");
const media = require("../own_modules/mediautil.js");

test("stripExtension removes only the extension (#24)", () => {
    assert.strictEqual(media.stripExtension("clip.mp4"), "clip");
    assert.strictEqual(media.stripExtension("my.clip.v2.mp4"), "my.clip.v2");
    assert.strictEqual(media.stripExtension("folder.x/clip"), "folder.x/clip");
    assert.strictEqual(media.stripExtension("folder.x\\clip.mov"), "folder.x\\clip");
    assert.strictEqual(media.stripExtension("clip"), "clip");
});

test("sameClip matches CasparCG file names to playlist paths", () => {
    assert.ok(media.sameClip("intro.v1.mp4", "intro.v1"));
    assert.ok(media.sameClip("INTRO.V1.MP4", "intro.v1"));
    assert.ok(media.sameClip("shows/ep.2023.mxf", "shows/ep.2023"));
    assert.ok(media.sameClip("shows\\ep.2023.mxf", "SHOWS/EP.2023"));
    assert.ok(media.sameClip("/media/shows/ep.mxf", "shows/ep"));
    assert.ok(!media.sameClip("intro.v2.mp4", "intro.v1"));
    assert.ok(!media.sameClip("myintro.mp4", "intro"));
    assert.ok(!media.sameClip(undefined, "intro"));
});

test("clipDuration", () => {
    assert.strictEqual(media.clipDuration({ frames: 250, framerate: 25 }), 10);
    assert.ok(Math.abs(media.clipDuration({ frames: 300, framerate: 30000 }) - 10.01) < 0.001);
    assert.strictEqual(media.clipDuration({ frames: 0, framerate: 25 }), 0);
    assert.strictEqual(media.clipDuration({ frames: 10, framerate: 0 }), 0);
});

test("parseForeground handles xml2js output", () => {
    const fg = [{ producer: ["ffmpeg"], file: [{ name: ["a.b.mp4"], time: ["1.5", "10"] }] }];
    assert.deepStrictEqual(media.parseForeground(fg), { name: "a.b.mp4", time: 1.5, duration: 10 });
    const still = [{ producer: ["image"], file: [{ name: ["logo.png"] }] }];
    assert.deepStrictEqual(media.parseForeground(still), { name: "logo.png", time: undefined, duration: undefined });
    assert.strictEqual(media.parseForeground([{ producer: ["empty"] }]), undefined);
    assert.strictEqual(media.parseForeground(undefined), undefined);
});

test("dailyPlaylistTime", () => {
    assert.strictEqual(media.dailyPlaylistTime("./daily_playlists/2023-04-08T06_00_00Z.json"), Date.parse("2023-04-08T06:00:00Z"));
    assert.ok(isNaN(media.dailyPlaylistTime("blahblah.test")));
    assert.ok(isNaN(media.dailyPlaylistTime("notadate.json")));
});
