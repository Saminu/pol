/**
 * A MessageChannel pollyfill.
 */
var MessageChannelLike = (function () {
    /**
     * Create a MessageChannelLike instance.
     */
    function MessageChannelLike() {
        var messageChannel = this;
        var _portsOpen = true;
        var _port1ready;
        var _port2ready;
        var _port1onmessage;
        _port1ready = new Promise(function (resolve) {
            messageChannel.port1 = {
                set onmessage(func) {
                    _port1onmessage = func;
                    resolve();
                },
                get onmessage() {
                    return _port1onmessage;
                },
                postMessage: function (data) {
                    if (_portsOpen) {
                        _port2ready.then(function () {
                            if (messageChannel.port2.onmessage)
                                messageChannel.port2.onmessage({ data: data });
                        });
                    }
                },
                close: function () {
                    _portsOpen = false;
                }
            };
        });
        var _port2onmessage;
        _port2ready = new Promise(function (resolve) {
            messageChannel.port2 = {
                set onmessage(func) {
                    _port2onmessage = func;
                    resolve();
                },
                get onmessage() {
                    return _port2onmessage;
                },
                postMessage: function (data) {
                    if (_portsOpen) {
                        _port1ready.then(function () {
                            if (messageChannel.port1.onmessage)
                                messageChannel.port1.onmessage({ data: data });
                        });
                    }
                },
                close: function () {
                    _portsOpen = false;
                }
            };
        });
    }
    return MessageChannelLike;
}());
export { MessageChannelLike };
/**
 * A synchronous MessageChannel.
 */
var SynchronousMessageChannel = (function () {
    /**
     * Create a MessageChannelLike instance.
     */
    function SynchronousMessageChannel() {
        var messageChannel = this;
        var pendingMessages1 = [];
        var onmessage1 = function (message) {
            pendingMessages1.push(message);
        };
        messageChannel.port1 = {
            get onmessage() { return onmessage1; },
            set onmessage(func) {
                setTimeout(function () {
                    onmessage1 = func;
                    pendingMessages1.forEach(function (data) { return func(data); });
                    pendingMessages1 = [];
                }, 0);
            },
            postMessage: function (data) {
                if (messageChannel.port2.onmessage)
                    messageChannel.port2.onmessage({ data: data });
            },
            close: function () {
                messageChannel.port1.onmessage = undefined;
                messageChannel.port2.onmessage = undefined;
            }
        };
        var pendingMessages2 = [];
        var onmessage2 = function (message) {
            pendingMessages2.push(message);
        };
        messageChannel.port2 = {
            get onmessage() { return onmessage2; },
            set onmessage(func) {
                onmessage2 = func;
                pendingMessages2.forEach(function (data) { return func(data); });
                pendingMessages2 = [];
            },
            postMessage: function (data) {
                if (messageChannel.port1.onmessage)
                    messageChannel.port1.onmessage({ data: data });
            },
            close: function () {
                messageChannel.port1.onmessage = undefined;
                messageChannel.port2.onmessage = undefined;
            }
        };
    }
    return SynchronousMessageChannel;
}());
export { SynchronousMessageChannel };
/**
 * A factory which creates MessageChannel or MessageChannelLike instances, depending on
 * wheter or not MessageChannel is avaialble in the execution context.
 */
var MessageChannelFactory = (function () {
    function MessageChannelFactory() {
    }
    /**
     * Create a MessageChannel (or MessageChannelLike) instance.
     */
    MessageChannelFactory.prototype.create = function () {
        if (typeof MessageChannel !== 'undefined')
            return new MessageChannel();
        else
            return new MessageChannelLike();
    };
    /**
     * Create a SynchronousMessageChannel instance.
     */
    MessageChannelFactory.prototype.createSynchronous = function () {
        return new SynchronousMessageChannel();
    };
    return MessageChannelFactory;
}());
export { MessageChannelFactory };
