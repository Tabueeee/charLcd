/**
 * Created by Tobias on 15.01.2017.
 */


var Lcd       = require('./myLcd');
var Q         = require('q');
var lcdConfig = new Lcd.LcdConfig(12, 25, [13, 22, 27, 16], 16, 2);
var lcd       = new Lcd.Lcd(lcdConfig);

// var lcd = new Lcd({
//     rs: 12,
//     e: 25,
//     data: [13, 22, 27, 16],
//     cols: 16,
//     rows: 2
// });

var limit = 0;

// new Date().toString().substring(0, 16)
lcd.on('ready', function () {

    // lcd.createCustomChar(function(){
    //     console.log('create char done...');
    // });

    setInterval(function () {

        limit++;
        lcd.setCursor(1, 1);
        lcd.print('World\x00');
        lcd.home(function () {
            lcd.setCursor(1, 0);

            lcd.print(new Date().toString().substring(16, 32));

        });
        // Q.delay(5000).then(function () {
        //     lcd.clear(function () {
        //         lcd.disconnect();
        //     });
        //
        // });

        if (limit === 25) {
            lcd.clear(function () {
                lcd.disconnect();
                process.exit();
            });
        }
        // Q.delay(5000).then(lcd.clear).then(lcd.close);

        // lcd.setCursor(0, 0);
        // lcd.setCursor(1, 0);
        // lcd.print('Hello');
    }, 1000);
});
// If ctrl+c is hit, free resources and exit.
process.on('SIGINT', function () {
    console.log('exiting');
    lcd.clear(function () {
        lcd.disconnect();
        process.exit();
    });
});