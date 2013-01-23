"use strict";

module.exports = {
    waterfall: function (funcs, callback, initValue) {
        // handmade helper for scheduling clumsy callbacks
        var index = 0;
        var length = funcs.length;
        if (length === 0) {
            return;
        }
        function raiseComplete (err, value) {
            if (callback) {
                callback(err, value);
            }
        }
        function asyncEscape (err, value) {
            if (err) {
                return raiseComplete(err);
            } else {
                if (index < length) {
                    return nextFunc(value);
                } else {
                    return raiseComplete(null, value);
                }
            }
        }
        function nextFunc (value) {
            return funcs[index++](value, asyncEscape);
        }
        return nextFunc(initValue);
    }
};
