/// <reference path="./globals/node/index.d.ts" />
/// <reference path="./modules/debug/index.d.ts" />
'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var events_1 = require('events');
var Database = (function (_super) {
    __extends(Database, _super);
    function Database() {
        _super.call(this);
        this.emit('rady');
    }
    Database.prototype.Cemit = function () {
        this.emit('rady');
    };
    Database.prototype.emit = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        _super.prototype.emit.call(this, event, args);
    };
    ;
    Database.prototype.on = function (event, listener) {
        _super.prototype.on.call(this, event, listener);
    };
    return Database;
}(events_1.EventEmitter));
var b = new Database();
b.on('rady', function () {
    console.log('1');
});
b.emit('rady');
// class Database extends EventEmitter {
//     constructor() {
//         super();
//         this.emit('ready');
//     }
// }
//
//
// var a = new Database();
//
// a.on('ready', function(){
//    console.log('ready');
// });
//
// console.log('done');
// var x = 0;
// for(var i = 0; i< 100; i++){
//     x = x + i * 2;
// }
// console.log(x);
//# sourceMappingURL=test.js.map