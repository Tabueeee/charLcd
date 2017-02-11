/// <reference path="./typings/globals/node/index.d.ts" />
/// <reference path="./typings/modules/debug/index.d.ts" />
'use strict';
declare function require(name: string);
var Q = require('q');
var _ = require('underscore');
var Gpio = require('onoff').Gpio;
var queue = require('queue');


/**
 * TODO screens virtual lines
 * TODO screen transitions
 * TODO screens group lines to pages
 *
 *
 * TODO make lcd options available
 * TODO extract commands
 * TODO remove dependency underscore
 * TODO change _each of screen lines to loop to row limit to allow virtual lines
 *
 *
 * TODO remove dependency Gpio?
 */

export interface lcdConfig {
    rs: number,
    en: number,
    data: number[],
    cols: number,
    rows: number,
    refreshRate: number,
    cursorBlock: boolean,
    cursorUnderscore: boolean,
    leftToRight: boolean,
    dots: number[]
}

export class LcdConfig {
    public rs: number;
    public en: number;
    public data: number[];
    public cols: number;
    public rows: number;
    public refreshRate: number = 1000;
    public cursorBlock: boolean = false;
    public cursorUnderscore: boolean = false;
    public leftToRight: boolean = true;
    public dots: number[] = [5, 8];

    public constructor(rs: number, e: number, data: number[], cols: number, rows: number) {
        this.rs = rs;
        this.en = e;
        this.data = data;
        this.cols = cols;
        this.rows = rows;
    }

    public setRefreshRate(refreshRate: number) {
        this.refreshRate = refreshRate;
    }

    public setCursorUnderscore(state: boolean) {
        this.cursorUnderscore = state;
    }

    public setCursorBlock(state: boolean) {
        this.cursorBlock = state;
    }

    public setLeftToRight(state: boolean) {
        this.leftToRight = state;
    }

    public setDots(dots: number[]) {
        this.dots[0] = dots[0];
        this.dots[1] = dots[1];
    }
}

export class ScreenLine {
    private content: string;
    private contentProvider: Function = null;
    private animationProvider: Function = null;
    public charOffset: number;
    public varStore = [];
    public charLimit: number;

    public constructor(charLimit: number) {
        this.content = '';
        this.charOffset = 0;
        this.charLimit = charLimit;
    }

    public setContent(content: string) {
        this.content = content;
    }

    public getContent(): string {
        return this.content;
    }

    public getVisibleContent(): string {
        return this.content.substring(this.charOffset, (this.charOffset + this.charLimit));
    }

    public clearContent() {
        this.content = '';
    }

    public updateContent() {
        if (this.contentProvider !== null) {
            this.contentProvider(this);
        }

        if (this.animationProvider !== null) {
            this.animationProvider(this);
        }
    }

    public setContentProvider(f: Function) {
        this.contentProvider = f;
    }

    public setAnimationProvider(f: Function) {
        this.animationProvider = f;
    }
}

export class Screen {
    private lines: ScreenLine[] = [];
    private lineCount: number;
    private lineOffset: number;
    private charCount: number;
    private charSet: number[][][];

    public constructor(charCount: number, lineCount: number) {
        this.charCount = charCount;
        this.lineCount = lineCount;
        this.lineOffset = 0;

        for (var i = 0; i < lineCount; i++) {
            this.lines[i] = new ScreenLine(this.charCount);
        }
    }

    public getContent(): string[] {
        var res = [];

        for (var i = this.lineOffset; i < this.lineCount; i++) {
            res.push(this.lines[i].getVisibleContent());
        }

        return res;
    }

    public setContent(line: number, content: string) {
        var screenLine = this.lines[line];
        screenLine.setContent(content);
    }

    public updateContent() {
        for (var i = this.lineOffset; i < this.lineCount; i++) {
            this.lines[i].updateContent();
        }
    }

    public setCustomCharSet(charSet: number[][][]) {
        this.charSet = charSet;
    }

    public getCustomCharSet(): number[][][] {
        return this.charSet;
    }

    public scrollDown() {
        if (this.lineOffset < (this.lines.length - 1)) {
            this.lineOffset++;
        }
    }

    public scrollUp() {
        if (this.lineOffset > 0) {
            this.lineOffset--;
        }
    }

    public line(line: number): ScreenLine {
        if (line < this.lineCount) {
            return this.lines[line];
        }

        return null;
    }
}

export class Lcd {
    private screen: Screen;
    private lcdController: LcdController;
    private running: boolean;
    private lcdConfig: lcdConfig;

    public constructor(lcdConfig: lcdConfig) {
        this.lcdConfig = lcdConfig;
        this.screen = new Screen(lcdConfig.cols, lcdConfig.rows);
        this.lcdController = new LcdController(lcdConfig);
        this.running = true;
        this.lcdController.init();
        this.startLcd();
    }

    private startLcd() {
        setInterval(function () {
            if (this.running) {
                this.screen.updateContent();
                this.lcdController.updateLcd(this.screen);
            }
        }.bind(this), this.lcdConfig.refreshRate);
    }

    private registerCustomCharSet(charSet: number[][][]) {
        for (var i = 0; i < this.lcdConfig.dots[1]; i++) {
            this.lcdController.registerCustomChar(i, charSet[i]);
        }
    }

    public setScreen(screen: Screen) {
        this.registerCustomCharSet(screen.getCustomCharSet());
        this.screen = screen;
    }

    public getScreen(): Screen {
        return this.screen;
    }

    public getNewBlankScreen() {
        return new Screen(this.lcdConfig.cols, this.lcdConfig.rows);
    }

    public freeze() {
        this.running = false;
    }

    public resume() {
        this.running = true;
    }

    public disconnect(cb: Function) {
        this.running = false;
        this.lcdController.shutdown(function () {
            cb();
        }.bind(this));
    }
}

class LcdController {
    private debug: boolean = true;
    //constant lcd vars
    private cols: number;
    private rows: number;
    private dots: number[];
    //constant lcd command values
    private COMMANDS = {
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
        CREATE_CUSTOM_CHAR: ~0x40,
    };
    private CMD_CLEAR = 0x01;
    private ROW_OFFSETS = [0x00, 0x40, 0x14, 0x54];
    //variable lcd state values
    private displayOnOffState: boolean = true;
    private showCursor: boolean = false;
    private blinkCursor: boolean = false;
    private ltrCursor: boolean = true;
    private unknSH: boolean = false;
    //lcd ram cache
    //noinspection JSMismatchedCollectionQueryUpdate
    private registeredCustomChars: number[][][] = [];
    private displayedContent: string[] = [];
    private lcdWriter: LcdWriter;

    public constructor(lcdConfig: lcdConfig) {
        this.lcdWriter = new LcdWriter(lcdConfig);
        this.blinkCursor = lcdConfig.cursorBlock;
        this.showCursor = lcdConfig.cursorUnderscore;
        this.ltrCursor = lcdConfig.leftToRight;
        this.dots = lcdConfig.dots;
        this.rows = lcdConfig.rows;
        this.cols = lcdConfig.cols;
    }

    public init() {
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
    }

    public updateLcd(screen: Screen) {
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
    }

    public registerCustomChar(address: number, char: number[][]) {
        for (var i = 0; i < 8; i++) {
            this.command(CommandResolver.getCustomCharCommandValue(address, i));
            this.write(CommandResolver.binToNum(char[i]));
        }
    }

    private fillString(screenLineContent: string): string {
        while (screenLineContent.length < this.cols) {
            screenLineContent += ' ';
        }
        return screenLineContent;
    }

    private cursorSet(col: number, row: number) {
        this.command(this.COMMANDS.SET_CURSOR | (col + this.ROW_OFFSETS[row]));
    };

    private setCursorLine(row: number) {
        this.cursorSet(0, row);
    }

    private write(val) {
        this.lcdWriter.send(val, 1);
    };

    private command(cmd) {
        this.lcdWriter.send(cmd, 0);
    };

    public shutdown(cb: Function) {
        this.command(this.CMD_CLEAR);
        this.lcdWriter.unRegisterGPIO(function () {
            cb();
        });
    }

    public displayOn() {
        this.displayOnOffState = true;
        this.updateDisplayOptions();
    }

    public displayOff() {
        this.displayOnOffState = false;
        this.updateDisplayOptions();
    }

    private updateDisplayOptions() {
        this.command(CommandResolver.getDisplayOnOffCommandValue(this.displayOnOffState, this.showCursor, this.blinkCursor));
    }

    public cursorShow() {
        this.showCursor = true;
        this.updateDisplayOptions();
    }

    public cursorHide() {
        this.showCursor = false;
        this.updateDisplayOptions();
    }

    public cursorBlinkOn() {
        this.blinkCursor = true;
        this.updateDisplayOptions();
    }

    public cursorBlinkOff() {
        this.blinkCursor = false;
        this.updateDisplayOptions();
    }
}

class LcdWriter {
    private commandQueue = queue();
    private rs;
    private en;
    private data = [];
    private writeMode;
    private debug: boolean = false;
    private lcdConfig: lcdConfig;

    public constructor(lcdConfig: lcdConfig) {
        this.registerGpioPins(lcdConfig);

        this.writeMode = lcdConfig.data.length;
        this.commandQueue.concurrency = 1;
        this.commandQueue.setMaxListeners(200);
    }

    private registerGpioPins(lcdConfig: lcdConfig) {
        this.rs = new Gpio(lcdConfig.rs, 'low');
        this.en = new Gpio(lcdConfig.en, 'low');
        if (lcdConfig.data.length !== 4 && lcdConfig.data.length !== 8) {
            throw 'invalid number of data pins, only 4 or 8 pins allowed.';
        }
        for (var i = 0; i < lcdConfig.data.length; i++) {
            this.data.push(new Gpio(lcdConfig.data[i], 'low'));
        }
    }

    public send(val, mode: number) {
        if (this.writeMode === 4) {
            this.commandQueue.push(function (done) {
                this.rs.writeSync(mode);
                this.writeBits(val >> 4, null);
                this.writeBits(val, done);
            }.bind(this));
        } else {
            this.commandQueue.push(function (done) {
                this.rs.writeSync(mode);
                this.writeBits(val, done);
            }.bind(this));
        }
        this.startWriteQueue();
    };

    private startWriteQueue() {
        this.commandQueue.start(function (err) {
            if (err) {
                console.log('error in commandQueue...');
                console.log(err);
            }
        }.bind(this));
    }

    private writeBits(hexVal: number, done: Function) {
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
    }

    private pulse(done) {
        // enable pulse >= 300ns; writeSync takes ~10 microseconds
        this.en.writeSync(1);
        this.en.writeSync(0);
        if (done !== null) {
            setTimeout(function () {
                done();
            }, 5);
        }
    }

    public sendWakeUpData() {
        this.directWrite(0x03);
        this.directWrite(0x03);
        this.directWrite(0x03);
        this.directWrite(0x02);
    }

    private directWrite(val: number) {
        this.commandQueue.push(function (done) {
            this.writeBits(val, done);
        }.bind(this));
    }

    public unRegisterGPIO(cb: Function) {
        this.commandQueue.push(function () {
            this.rs.unexport();
            this.en.unexport();

            _.each(this.data, function (dataPin) {
                dataPin.unexport();
            });

            cb();
        }.bind(this));
    }

    private static getFirstBit(hexVal: number) {
        return hexVal & 1;
    }

    private static dropFirstBit(hexVal: number) {
        return hexVal >> 1;
    }
}

class CommandResolver {
    public static getDisplayOnOffCommandValue(displayOnOffState: boolean, showCursor: boolean, blinkCursor: boolean) {
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
    }

    public static getEntryCommandValue(ltrCursor: boolean, unknSH: boolean) {
        var hexCommandValue = 0x04;

        if (ltrCursor) {
            hexCommandValue |= 0x02;
        }

        if (unknSH) {
            hexCommandValue |= 0x01;
        }

        return hexCommandValue;
    }

    public static getFunctionCommandValue(writeMode: number, rows: number, dots: number[]) {
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
    }

    public static getCustomCharCommandValue(adress: number, index: number): number {
        var customCharCommandValue = 0x40;
        if (adress < 8) {
            customCharCommandValue |= (adress << 3);
        }
        if (index < 8) {
            customCharCommandValue |= index;
        }

        return customCharCommandValue;
    }

    public static binToNum(bin) {
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
    }

    public static dec2bin(dec) {
        return (dec >>> 0).toString(2);
    }
}
