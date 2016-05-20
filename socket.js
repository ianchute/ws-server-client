class Socket {

  constructor({
    ip,
    port,
    onmessage = this.logResponse,
    debug = false
  }) {
    if ('WebSocket' in window) {
      this.url = `ws://${ip}:${port}`;
      this.socket = this._safe(() => new WebSocket(this.url));
      this.debug = debug;
      this.onmessage = onmessage || ((response) => logResponse(response));
      this.oldSockets = [];
      this.queue = [];
      this.ensureCreation();
    } else {
      throw new Error('WebSocket is not supported!');
    }
  }

  log(message) {
    if (this.debug) {
      console.log(message);
    }
  }

  _executeIntervalList(list, intervalF, callback) {
    let i = 0;
    const length = list.length;
    this._executeIntervalUntilCondition(
      () => intervalF(list[i++]),
      () => i === length,
      callback
    );
  }

  _executeIntervalUntilCondition(intervalF, conditionF, callback) {
    const interval = setInterval(() => {
      if (conditionF()) {
        clearInterval(interval);
        if (typeof callback === 'function') {
          callback();
        }
      } else {
        intervalF();
      }
    }, 2000);
  }

  _safe(unsafeF) {
    try {
      return unsafeF();
    } catch (e) {
      return null;
    }
  }

  bindEvents() {
    this.log('Binding events...');
    this.socket.onmessage = (response) => this.onmessage(response);
    this.socket.onclose = () => this.ensureCreation();
    this.resendQueuedMessages();
    this.disposeOldSockets();
  }

  unbindEvents() {
    this.log('Unbinding events...');
    this.socket.onmessage = () => {};
    this.socket.onclose = () => {};
  }

  logResponse({ data }) {
    this.log(`Received response: "${data}"`);
  }

  resendQueuedMessages() {
    if (this.queue.length === 0)
      return;

    this.log('Resending queued messages...');
    this.multisend(this.queue, () => {
      this.queue = [];
      this.log('Queued messages re-sent!');
    });
  }

  disposeOldSockets() {
    if (this.oldSockets.length === 0)
      return;

    this.log('Disposing old sockets...');
    this._executeIntervalList(this.oldSockets, (oldSocket) => {
      this._safe(() => oldSocket.close());
    }, () => {
      this.oldSockets = [];
      this.log('Old sockets disposed!');
    });
  }

  ensureCreation(callback) {
    this._executeIntervalUntilCondition(() => {
        this.log('Socket connection was interrupted. Attempting to reconnect...');
        this.unbindEvents();
        this.oldSockets.push(this.socket);
        this.socket = this._safe(() => new WebSocket(this.url));
      }, () => this.socket.readyState === 1, () => {
        this.log('Socket has successfully connected!');
        this.bindEvents();
      }
    );
  }

  send(message) {
    if (this.socket.readyState === 1) {
      this.socket.send(message);
      this.log(`Message "${message}" sent!`);
      return true;
    } else {
      this.log(`Socket cannot send messages! Placing message "${message}"... to queue.`);
      this.queue.push(message);
      return false;
    }
  }

  multisend(messages, callback) {
    this._executeIntervalList(messages, (message) => {
      this.send(message);
    }, callback);
  }
}
