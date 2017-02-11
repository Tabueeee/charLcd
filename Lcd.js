/// <reference path="./typings/globals/node/index.d.ts" />
/// <reference path="./typings/modules/debug/index.d.ts" />
'use strict';
var Q = require('q');
var _ = require('underscore');
var Gpio = require('onoff').Gpio;
var queue = require('queue');
var LcdConfig = (function () {
    function LcdConfig(rs, e, data, cols, rows) {
        this.refreshRate = 1000;
        this.cursorBlock = false;
        this.cursorUnderscore = false;
        this.leftToRight = true;
        this.dots = [5, 8];
        this.rs = rs;
        this.en = e;
        this.data = data;
        this.cols = cols;
        this.rows = rows;
    }
    LcdConfig.prototype.setRefreshRate = function (refreshRate) {
        this.refreshRate = refreshRate;
    };
    LcdConfig.prototype.setCursorUnderscore = function (state) {
        this.cursorUnderscore = state;
    };
    LcdConfig.prototype.setCursorBlock = function (state) {
        this.cursorBlock = state;
    };
    LcdConfig.prototype.setLeftToRight = function (state) {
        this.leftToRight = state;
    };
    LcdConfig.prototype.setDots = function (dots) {
        this.dots[0] = dots[0];
        this.dots[1] = dots[1];
    };
    return LcdConfig;
}());
exports.LcdConfig = LcdConfig;
var ScreenLine = (function () {
    function ScreenLine(charLimit) {
        this.contentProvider = null;
        this.animationProvider = null;
        this.varStore = [];
        this.content = '';
        this.charOffset = 0;
        this.charLimit = charLimit;
    }
    ScreenLine.prototype.setContent = function (content) {
        this.content = content;
    };
    ScreenLine.prototype.getContent = function () {
        return this.content;
    };
    ScreenLine.prototype.getVisibleContent = function () {
        return this.content.substring(this.charOffset, (this.charOffset + this.charLimit));
    };
    ScreenLine.prototype.clearContent = function () {
        this.content = '';
    };
    ScreenLine.prototype.updateContent = function () {
        if (this.contentProvider !== null) {
            this.contentProvider(this);
        }
        if (this.animationProvider !== null) {
            this.animationProvider(this);
        }
    };
    ScreenLine.prototype.setContentProvider = function (f) {
        this.contentProvider = f;
    };
    ScreenLine.prototype.setAnimationProvider = function (f) {
        this.animationProvider = f;
    };
    return ScreenLine;
}());
exports.ScreenLine = ScreenLine;
var Screen = (function () {
    function Screen(charCount, lineCount) {
        this.lines = [];
        this.charCount = charCount;
        this.lineCount = lineCount;
        this.lineOffset = 0;
        for (var i = 0; i < lineCount; i++) {
            this.lines[i] = new ScreenLine(this.charCount);
        }
    }
    Screen.prototype.getContent = function () {
        var res = [];
        for (var i = this.lineOffset; i < this.lineCount; i++) {
            res.push(this.lines[i].getVisibleContent());
        }
        return res;
    };
    Screen.prototype.setContent = function (line, content) {
        var screenLine = this.lines[line];
        screenLine.setContent(content);
    };
    Screen.prototype.updateContent = function () {
        for (var i = this.lineOffset; i < this.lineCount; i++) {
            this.lines[i].updateContent();
        }
    };
    Screen.prototype.setCustomCharSet = function (charSet) {
        this.charSet = charSet;
    };
    Screen.prototype.getCustomCharSet = function () {
        return this.charSet;
    };
    Screen.prototype.scrollDown = function () {
        if (this.lineOffset < (this.lines.length - 1)) {
            this.lineOffset++;
        }
    };
    Screen.prototype.scrollUp = function () {
        if (this.lineOffset > 0) {
            this.lineOffset--;
        }
    };
    Screen.prototype.line = function (line) {
        if (line < this.lineCount) {
            return this.lines[line];
        }
        return null;
    };
    return Screen;
}());
exports.Screen = Screen;
var Lcd = (function () {
    function Lcd(lcdConfig) {
        this.lcdConfig = lcdConfig;
        this.screen = new Screen(lcdConfig.cols, lcdConfig.rows);
        this.lcdController = new LcdController(lcdConfig);
        this.running = true;
        this.lcdController.init();
        this.startLcd();
    }
    Lcd.prototype.startLcd = function () {
        setInterval(function () {
            if (this.running) {
                this.screen.updateContent();
                this.lcdController.updateLcd(this.screen);
            }
        }.bind(this), this.lcdConfig.refreshRate);
    };
    Lcd.prototype.registerCustomCharSet = function (charSet) {
        for (var i = 0; i < this.lcdConfig.dots[1]; i++) {
            this.lcdController.registerCustomChar(i, charSet[i]);
        }
    };
    Lcd.prototype.setScreen = function (screen) {
        this.registerCustomCharSet(screen.getCustomCharSet());
        this.screen = screen;
    };
    Lcd.prototype.getScreen = function () {
        return this.screen;
    };
    Lcd.prototype.getNewBlankScreen = function () {
        return new Screen(this.lcdConfig.cols, this.lcdConfig.rows);
    };
    Lcd.prototype.freeze = function () {
        this.running = false;
    };
    Lcd.prototype.resume = function () {
        this.running = true;
    };
    Lcd.prototype.disconnect = function (cb) {
        this.running = false;
        this.lcdController.shutdown(function () {
            cb();
        }.bind(this));
    };
    return Lcd;
}());
exports.Lcd = Lcd;
var LcdController = (function () {
    function LcdController(lcdConfig) {
        this.debug = true;
        //constant lcd command values
        this.COMMANDS = {
            CLEAR_DISPLAY: 0x01,
            HOME: 0x02,
            SET_CURSOR: 0x80,
            DISPLAY_ON: 0x04,
            DISPLAY_OFF: ~0x04,
            CURSOR_ON: 0x02,
            CURSOR_OFF: ~0x02,
            BLINK_ON: 0x01,
            BLINK_OFF: ~0x01,
            SCROLL_LEFT: 0x18,
            SCROLL_RIGHT: 0x1c,
            LEFT_TO_RIGHT: 0x02,
            RIGHT_TO_LEFT: ~0x02,
            AUTOSCROLL_ON: 0x01,
            AUTOSCROLL_OFF: ~0x01,
            CREATE_CUSTOM_CHAR: ~0x40
        };
        this.CMD_CLEAR = 0x01;
        this.ROW_OFFSETS = [0x00, 0x40, 0x14, 0x54];
        //variable lcd state values
        this.displayOnOffState = true;
        this.showCursor = false;
        this.blinkCursor = false;
        this.ltrCursor = true;
        this.unknSH = false;
        //lcd ram cache
        //noinspection JSMismatchedCollectionQueryUpdate
        this.registeredCustomChars = [];
        this.displayedContent = [];
        this.lcdWriter = new LcdWriter(lcdConfig);
        this.blinkCursor = lcdConfig.cursorBlock;
        this.showCursor = lcdConfig.cursorUnderscore;
        this.ltrCursor = lcdConfig.leftToRight;
        this.dots = lcdConfig.dots;
        this.rows = lcdConfig.rows;
        this.cols = lcdConfig.cols;
    }
    LcdController.prototype.init = function () {
        Q.delay(16)
            .then(this.lcdWriter.sendWakeUpData.bind(this))
            .then(function () {
            if (this.debug) {
                console.log('init');
            }
            this.command(CommandResolver.getFunctionCommandValue(this.writeMode, this.rows, this.dots));
        }.bind(this))
            .then(function () {
            this.command(0x10);
        }.bind(this))
            .then(function () {
            this.command(CommandResolver.getDisplayOnOffCommandValue(this.displayOnOffState, this.showCursor, this.blinkCursor));
        }.bind(this))
            .then(function () {
            this.command(CommandResolver.getEntryCommandValue(this.ltrCursor, this.unknSH));
        }.bind(this))
            .then(function () {
            this.command(this.CMD_CLEAR);
        }.bind(this));
    };
    LcdController.prototype.updateLcd = function (screen) {
        if (screen.getCustomCharSet() !== this.registeredCustomChars) {
            for (var i = 0; i < screen.getCustomCharSet().length; i++) {
                if (i < 8) {
                    this.registerCustomChar(i, screen.getCustomCharSet()[i]);
                }
            }
            this.registeredCustomChars = screen.getCustomCharSet();
        }
        var screenContent = screen.getContent();
        for (var i = 0; i < screenContent.length; i++) {
            if (i < this.rows) {
                var screenLineContent = this.fillString(screenContent[i]);
                var screenLineCharacters = screenLineContent.split('');
                if (this.debug) {
                    console.log(' ----------------');
                    console.log('|' + screenLineContent + '|');
                    console.log(' ----------------');
                }
                if (screenContent[i] !== this.displayedContent[i]) {
                    this.setCursorLine(i);
                    this.displayedContent[i] = screenContent[i];
                    _.each(screenLineCharacters, function (character) {
                        this.write(character.charCodeAt(0));
                    }.bind(this));
                }
            }
        }
        if (this.debug) {
            console.log('');
        }
    };
    LcdController.prototype.registerCustomChar = function (address, char) {
        for (var i = 0; i < 8; i++) {
            this.command(CommandResolver.getCustomCharCommandValue(address, i));
            this.write(CommandResolver.binToNum(char[i]));
        }
    };
    LcdController.prototype.fillString = function (screenLineContent) {
        while (screenLineContent.length < this.cols) {
            screenLineContent += ' ';
        }
        return screenLineContent;
    };
    LcdController.prototype.cursorSet = function (col, row) {
        this.command(this.COMMANDS.SET_CURSOR | (col + this.ROW_OFFSETS[row]));
    };
    ;
    LcdController.prototype.setCursorLine = function (row) {
        this.cursorSet(0, row);
    };
    LcdController.prototype.write = function (val) {
        this.lcdWriter.send(val, 1);
    };
    ;
    LcdController.prototype.command = function (cmd) {
        this.lcdWriter.send(cmd, 0);
    };
    ;
    LcdController.prototype.shutdown = function (cb) {
        this.command(this.CMD_CLEAR);
        this.lcdWriter.unRegisterGPIO(function () {
            cb();
        });
    };
    LcdController.prototype.displayOn = function () {
        this.displayOnOffState = true;
        this.updateDisplayOptions();
    };
    LcdController.prototype.displayOff = function () {
        this.displayOnOffState = false;
        this.updateDisplayOptions();
    };
    LcdController.prototype.updateDisplayOptions = function () {
        this.command(CommandResolver.getDisplayOnOffCommandValue(this.displayOnOffState, this.showCursor, this.blinkCursor));
    };
    LcdController.prototype.cursorShow = function () {
        this.showCursor = true;
        this.updateDisplayOptions();
    };
    LcdController.prototype.cursorHide = function () {
        this.showCursor = false;
        this.updateDisplayOptions();
    };
    LcdController.prototype.cursorBlinkOn = function () {
        this.blinkCursor = true;
        this.updateDisplayOptions();
    };
    LcdController.prototype.cursorBlinkOff = function () {
        this.blinkCursor = false;
        this.updateDisplayOptions();
    };
    return LcdController;
}());
var LcdWriter = (function () {
    function LcdWriter(lcdConfig) {
        this.commandQueue = queue();
        this.data = [];
        this.debug = false;
        this.registerGpioPins(lcdConfig);
        this.writeMode = lcdConfig.data.length;
        this.commandQueue.concurrency = 1;
        this.commandQueue.setMaxListeners(200);
    }
    LcdWriter.prototype.registerGpioPins = function (lcdConfig) {
        this.rs = new Gpio(lcdConfig.rs, 'low');
        this.en = new Gpio(lcdConfig.en, 'low');
        if (lcdConfig.data.length !== 4 && lcdConfig.data.length !== 8) {
            throw 'invalid number of data pins, only 4 or 8 pins allowed.';
        }
        for (var i = 0; i < lcdConfig.data.length; i++) {
            this.data.push(new Gpio(lcdConfig.data[i], 'low'));
        }
    };
    LcdWriter.prototype.send = function (val, mode) {
        if (this.writeMode === 4) {
            this.commandQueue.push(function (done) {
                this.rs.writeSync(mode);
                this.writeBits(val >> 4, null);
                this.writeBits(val, done);
            }.bind(this));
        }
        else {
            this.commandQueue.push(function (done) {
                this.rs.writeSync(mode);
                this.writeBits(val, done);
            }.bind(this));
        }
        this.startWriteQueue();
    };
    ;
    LcdWriter.prototype.startWriteQueue = function () {
        this.commandQueue.start(function (err) {
            if (err) {
                console.log('error in commandQueue...');
                console.log(err);
            }
        }.bind(this));
    };
    LcdWriter.prototype.writeBits = function (hexVal, done) {
        if (!(typeof hexVal === 'number')) {
            throw new Error("Value passed to writeBits must be a number");
        }
        for (var i = 0; i < this.data.length; i++) {
            var currentBit = LcdWriter.getFirstBit(hexVal);
            if (this.debug) {
                console.log('writing bit d' + (4 + i) + ': ' + currentBit + ' on pin: ' + this.lcdConfig.data[i]);
            }
            this.data[i].writeSync(currentBit);
            hexVal = LcdWriter.dropFirstBit(hexVal);
        }
        this.pulse(done);
    };
    LcdWriter.prototype.pulse = function (done) {
        // enable pulse >= 300ns; writeSync takes ~10 microseconds
        this.en.writeSync(1);
        this.en.writeSync(0);
        if (done !== null) {
            setTimeout(function () {
                done();
            }, 5);
        }
    };
    LcdWriter.prototype.sendWakeUpData = function () {
        this.directWrite(0x03);
        this.directWrite(0x03);
        this.directWrite(0x03);
        this.directWrite(0x02);
    };
    LcdWriter.prototype.directWrite = function (val) {
        this.commandQueue.push(function (done) {
            this.writeBits(val, done);
        }.bind(this));
    };
    LcdWriter.prototype.unRegisterGPIO = function (cb) {
        this.commandQueue.push(function () {
            this.rs.unexport();
            this.en.unexport();
            _.each(this.data, function (dataPin) {
                dataPin.unexport();
            });
            cb();
        }.bind(this));
    };
    LcdWriter.getFirstBit = function (hexVal) {
        return hexVal & 1;
    };
    LcdWriter.dropFirstBit = function (hexVal) {
        return hexVal >> 1;
    };
    return LcdWriter;
}());
var CommandResolver = (function () {
    function CommandResolver() {
    }
    CommandResolver.getDisplayOnOffCommandValue = function (displayOnOffState, showCursor, blinkCursor) {
        var hexCommandValue = 0x08;
        if (displayOnOffState) {
            hexCommandValue |= 0x04;
        }
        if (showCursor) {
            hexCommandValue |= 0x02;
        }
        if (blinkCursor) {
            hexCommandValue |= 0x01;
        }
        return hexCommandValue;
    };
    CommandResolver.getEntryCommandValue = function (ltrCursor, unknSH) {
        var hexCommandValue = 0x04;
        if (ltrCursor) {
            hexCommandValue |= 0x02;
        }
        if (unknSH) {
            hexCommandValue |= 0x01;
        }
        return hexCommandValue;
    };
    CommandResolver.getFunctionCommandValue = function (writeMode, rows, dots) {
        //FunctionSet only used on display init
        var hexCommandValue = 0x20;
        //sets pin with value 16 (1 0000)
        if (writeMode !== 4) {
            hexCommandValue |= 0x10;
        }
        //sets pin with value 8 (1000)
        if (rows > 1) {
            hexCommandValue |= 0x08;
        }
        //sets pin with value 4 (0100)
        if (dots[1] === 11) {
            hexCommandValue |= 0x04;
        }
        return hexCommandValue;
    };
    CommandResolver.getCustomCharCommandValue = function (adress, index) {
        var customCharCommandValue = 0x40;
        if (adress < 8) {
            customCharCommandValue |= (adress << 3);
        }
        if (index < 8) {
            customCharCommandValue |= index;
        }
        return customCharCommandValue;
    };
    CommandResolver.binToNum = function (bin) {
        var res = 0;
        var multiplier = Math.pow(2, bin.length - 1);
        for (var i = 0; i < bin.length; i++) {
            var bi = bin[i];
            if (bi !== 0 && bi !== 1) {
                throw 'invalid character! 0 or 1 only.';
            }
            res += multiplier * bi;
            multiplier /= 2;
        }
        return res;
    };
    CommandResolver.dec2bin = function (dec) {
        return (dec >>> 0).toString(2);
    };
    return CommandResolver;
}());
//# sourceMappingURL=Lcd.js.map