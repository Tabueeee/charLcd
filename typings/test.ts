/// <reference path="./globals/node/index.d.ts" />
/// <reference path="./modules/debug/index.d.ts" />
'use strict';
import {EventEmitter} from 'events';

class Database extends EventEmitter {
    constructor() {
        super();
        this.emit('rady');
    }

    public Cemit() {
        this.emit('rady');
    }

    public emit(event: string, ...args: any[]) {
        super.emit(event, args);
    };

    public on(event: string, listener: (...args: any[])) {
        super.on(event, listener);
    }
}

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

