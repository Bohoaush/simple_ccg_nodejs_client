//var playlistHandler = require("./plyhndl.js");

const EventEmitter = require('events');
const timeEvent = new EventEmitter();

var currentTime = new Date();
var nextEventStamp = 9999999999999;
var nextDailyPlyStamp = 9999999999999;


module.exports = {
    //variables
    currentTime,
    nextEventStamp,
    nextDailyPlyStamp,
    //events
    timeEvent,
    //functions
    countHumanReadableTime,
    
};

setInterval(function() {
    module.exports.currentTime = Date.now();
    if (module.exports.currentTime > module.exports.nextEventStamp) {
        module.exports.timeEvent.emit('nextEvent');
    }
    if (module.exports.currentTime >= module.exports.nextDailyPlyStamp) {
        module.exports.timeEvent.emit('nextDailyPly');
        module.exports.nextDailyPlyStamp = 9999999999999;
    }
}, 1000);

function countHumanReadableTime(time) {
    time = new Date(time*1000);
    var month = (time.getMonth() + 1);
    if (month < 10) { month = "0" + month; }
    
    var day = time.getDate();
    if (day < 10) { day = "0" + day; }
    
    var hour = time.getHours();
    if (hour < 10) { hour = "0" + hour; }
    
    var minute = time.getMinutes();
    if (minute < 10) { minute = "0" + minute; }
    
    var second = time.getSeconds();
    if (second < 10) { second = "0" + second; }
    
    return (time.getFullYear().toString() + month + day + hour + minute + second);
}
