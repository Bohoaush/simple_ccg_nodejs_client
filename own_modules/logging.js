var fs = require("fs");
var util = require("util");
var configuration = require("./settings.js");

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

var setLogLevel = parseLevel(configuration.settings.log_level);
var logFile = configuration.settings.log_file;

// Function used to print a line to the terminal. The interactive console replaces it
// so that log lines don't get mixed up with the status line and the command prompt.
var printer = function(line) { console.log(line); };

module.exports = {
    log,
    debug: (module, ...msg) => log("debug", module, ...msg),
    info: (module, ...msg) => log("info", module, ...msg),
    warn: (module, ...msg) => log("warn", module, ...msg),
    error: (module, ...msg) => log("error", module, ...msg),
    setPrinter,
    setLevel,
    LEVELS
};

function parseLevel(level) {
    if (typeof level == "number") {
        return level;
    }
    return (LEVELS[String(level).toLowerCase()] ?? LEVELS.info);
}

function setLevel(level) {
    setLogLevel = parseLevel(level);
}

function setPrinter(newPrinter) {
    printer = newPrinter;
}

function log(level, module, ...message) {
    if (parseLevel(level) < setLogLevel) {
        return;
    }
    var text = message.map(m => (typeof m == "string") ? m : util.inspect(m, { depth: 4 })).join(" ");
    var line = new Date().toISOString() + " [" + String(level).toUpperCase() + "] " + module + ": " + text;
    printer(line);
    if (logFile) {
        fs.appendFile(logFile, line + "\n", (err) => {
            if (err) {
                logFile = "";
                printer("Couldn't write to log file, file logging disabled: " + err.message);
            }
        });
    }
}
