import CesiumEvent from 'cesium/Source/Core/Event';
/**
 * Provides the ability raise and subscribe to an event.
 */
var Event = (function () {
    function Event() {
        this._event = new CesiumEvent();
        /**
          * Add an event listener.
          * @param The function to be executed when the event is raised.
          * @return A convenience function which removes this event listener when called
          */
        this.addEventListener = this._event.addEventListener.bind(this._event);
        /**
         * Remove an event listener.
         * @param The function to be unregistered.
         * @return True if the listener was removed;
         * false if the listener and scope are not registered with the event.
         */
        this.removeEventListener = this._event.removeEventListener.bind(this._event);
        /**
         * Raises the event by calling each registered listener with all supplied arguments.
         * @param This method takes any number of parameters and passes them through to the listener functions.
         */
        this.raiseEvent = this._event.raiseEvent.bind(this._event);
    }
    Object.defineProperty(Event.prototype, "numberOfListeners", {
        /**
         * Get the number of listeners currently subscribed to the event.
         * @return Number of listeners currently subscribed to the event.
         */
        get: function () {
            return this._event.numberOfListeners;
        },
        enumerable: true,
        configurable: true
    });
    return Event;
}());
export { Event };
