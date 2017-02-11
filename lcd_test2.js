/**
 * Created by Tobias on 15.01.2017.
 */


console.log('123');
var Lcd       = require('./Lcd');
var Q         = require('q');
var lcdConfig = new Lcd.LcdConfig(12, 25, [13, 22, 27, 16], 16, 2);
var lcd       = new Lcd.Lcd(lcdConfig);
// require('shelljs/global');
var cpuStat   = require('cpu-stat');
var charSet   = [
    [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0],
        [1, 0, 1, 1, 1],
        [1, 0, 1, 1, 1],
        [1, 0, 1, 1, 1],
        [1, 0, 1, 1, 1],
        [1, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
    ], [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 1],
        [1, 1, 1, 0, 1],
        [1, 1, 1, 0, 1],
        [1, 1, 1, 0, 1],
        [1, 1, 1, 0, 1],
        [0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1]
    ],
    [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
    ],
    [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
    ],
    [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
    ],
    [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
    ],
    [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
    ],
    [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
    ],
];
var charSet   = [
    [
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0]
    ], [
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0]
    ], [
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0]
    ], [
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0]
    ]
];
lcd.getScreen().setCustomCharSet(charSet);
// lcd.registerCustomCharSet(charSet);
lcd.getScreen().line(0).setContent('0123456789ABCDEF0123');
// lcd.getScreen().line(1).setContent('\x00\x01\x02\x03\x04\x05\x06\x07\xFF');
lcd.getScreen().line(1).setContentProvider(function (line) {
    cpuStat.usagePercent(function (err, percent, seconds) {
        if (err) {
            return console.log(err);
        }
        if(typeof percent === 'undefined'){
            return ;
        }
        var chars    = [
            '\x00',
            '\x01',
            '\x02',
            '\x03',
        ];
        var message  = '';
        var progress = Math.floor(percent);


        progress = (progress / 100) * ((line.charLimit) * 5);
        while (progress >= 5) {
            console.log(progress);
            message += '\xFF';
            progress -= 5;
        }
        // console.log('=========== accessing array with: ' + Math.floor(progress));
        message += chars[Math.floor(progress)];
        line.setContent(message);
    });
});
// lcd.getScreen().line(1).setContentProvider(function (line) {
//     cpuStat.usagePercent(function (err, percent, seconds) {
//         var chars    = [
//             '\x03',
//             '\x04',
//             '\x05',
//             '\x06',
//             '\x07'
//         ];
//         var message  = '';
//         var progress = Math.floor(percent);
//         if (err) {
//             return console.log(err);
//         }
//
//         progress = (progress / 100) * ((line.charLimit - 2) * 5);
//         while (progress >= 5) {
//             console.log(progress);
//             message += '\x07';
//             progress -= 5;
//         }
//         // console.log('=========== accessing array with: ' + Math.floor(progress));
//         message += chars[Math.floor(progress)];
//         message = '\x00' + message;
//         message += '\x01';
//         line.setContent(message);
//     });
// });

var os = require('os');
//
// lcd.getScreen().line(0).setContentProvider(function (line) {
//     var totalBytes  = os.totalmem();
//     var totalKbytes = totalBytes / 1024;
//     var totalMbytes = totalKbytes / 1024;
//     totalMbytes     = Math.floor(totalMbytes, -1);
//
//     var freeBytes  = os.freemem();
//     var freeKbytes = freeBytes / 1024;
//     var freeMbytes = freeKbytes / 1024;
//     freeMbytes     = Math.floor(freeMbytes, -1);
//
//
//     line.setContent('f' + freeMbytes + ' t' + totalMbytes + ' u' + (totalMbytes - freeMbytes));
// });

//
// lcd.getScreen().line(0).setContentProvider(function (line) {
//     cpuStat.usagePercent(function (err, percent, seconds) {
//         percent = ''+percent;
//         line.setContent('CPU: ' + percent.substr(0, 6) + '%')
//     });
//
// });

function animationProvider(line) {
    if (line.varStore[0] === true) {
        line.charOffset--;
        if (line.charOffset === 0) {
            line.varStore[0] = false;
        }
    } else {
        line.charOffset++;
        if ((line.charOffset + line.charLimit) === line.content.length) {
            console.log('varstore');
            line.varStore[0] = true;
        }
    }
}

lcd.getScreen().line(0).setAnimationProvider(animationProvider);

// lcd.getScreen().line(0).setContentProvider(function (line) {
//     cpuStat.usagePercent(function (err, percent, seconds) {
//         console.log(percent);
//         var progress = Math.floor(percent);
//         line.setContent('CPU: ' + progress + ' %');
//     });
// });

// If ctrl+c is hit, free resources and exit.
process.on('SIGINT', function () {
    console.log('exiting');
    lcd.disconnect(function () {
        process.exit();
    });
});