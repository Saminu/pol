import { Event } from './event';
/**
* TODO.
*/
var CommandQueue = (function () {
    /**
     * If errorEvent has 1 listener, outputs the error message to the web console.
     */
    function CommandQueue() {
        var _this = this;
        this._queue = [];
        this._paused = true;
        /**
         * An error event.
         */
        this.errorEvent = new Event();
        this.errorEvent.addEventListener(function (error) {
            if (_this.errorEvent.numberOfListeners === 1)
                console.error(error);
        });
    }
    /**
     * Push a command to the command queue.
     * @param command Any command ready to be pushed into the command queue.
     */
    CommandQueue.prototype.push = function (command, execute) {
        var _this = this;
        var result = new Promise(function (resolve, reject) {
            _this._queue.push({
                command: command,
                reject: reject,
                execute: function () {
                    // console.log('CommandQueue: Executing command ' + command.toString());
                    var result = Promise.resolve().then(command);
                    // result.then(() => { console.log('CommandQueue: DONE ' + command.toString()) });
                    resolve(result);
                    return result;
                }
            });
        });
        if (execute || !this._paused)
            this.execute();
        return result;
    };
    /**
     * Execute the command queue
     */
    CommandQueue.prototype.execute = function () {
        var _this = this;
        this._paused = false;
        Promise.resolve().then(function () {
            if (_this._queue.length > 0 && !_this._currentCommandPending) {
                _this._executeNextCommand();
            }
        });
    };
    /**
     * Puase the command queue (currently executing commands will still complete)
     */
    CommandQueue.prototype.pause = function () {
        this._paused = true;
    };
    /**
     * Clear commandQueue.
     */
    CommandQueue.prototype.clear = function () {
        this._queue.forEach(function (item) {
            item.reject("Unable to execute.");
        });
        this._queue = [];
    };
    CommandQueue.prototype._executeNextCommand = function () {
        var _this = this;
        this._currentCommand = undefined;
        this._currentCommandPending = undefined;
        if (this._paused)
            return;
        var item = this._queue.shift();
        if (!item)
            return;
        this._currentCommand = item.command;
        this._currentCommandPending = item.execute()
            .then(this._executeNextCommand.bind(this))
            .catch(function (e) {
            _this.errorEvent.raiseEvent(e);
            _this._executeNextCommand();
        });
    };
    return CommandQueue;
}());
export { CommandQueue };
