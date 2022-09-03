const {IPCModule} = require('node-ipc');

class Server {

  /**
   * 
   * @param {string} serverName 
   *  Name you would like the server to be.
   *  Note: this will be the name you must call from
   *        all of your nodes in the network.
   * @param {bool} isSilent 
   *  Allow or dis-allow verbose mode for node-ipc.
   * @returns this
   */
  constructor(serverName, isSilent=true) {
    this.serverName        = serverName;
    this.ipc               = new IPCModule;
    this.ipc.config.id     = serverName;
    this.ipc.config.retry  = 1500;
    this.ipc.config.silent = isSilent;

    this.calls     = [];
    this.callBacks = [];
    this.sockets   = [];

    return this;
  }

  /**
   * Used to send data from a node api call to the receiving
   * node that made the call. The Server in this network is the
   * middleman for all communication.
   * 
   * @param {json} packet 
   *  packet received from node
   */
  return(packet) {
    this.ipc.server.emit(this.sockets[packet.sender], 'return', packet);
  }

  /**
   * Used to send the api call to the destined node. The Server in this
   * network is the middleman for all communication.
   * 
   * @param {json} packet 
   *  packet received from node
   */
  send(packet) {
    this.ipc.server.emit(this.sockets[packet.receiver], packet.apiCall, packet);
  }

  /**
   * Add an api call for other nodes to call
   * 
   * @param {string} call 
   *  Name of API call
   * @param {function(packet, socket)} callBack 
   *  Function to run when this API call is called.  Must include arguments.
   * @returns this
   */
  addApiCall(call, callBack) {
    this.calls.push(call);
    this.callBacks.push(callBack.bind(this));
    return this;
  }

  /**
   * Main function to start the server up
   */
  run() {
    this.ipc.serve(function() {
      /**
       * This allows the server to collect sockets of the
       * connected nodes in the network.
       */
      this.ipc.server.on('nodeInit', function(nodeName, socket) {
        this.sockets[nodeName] = socket;
      }.bind(this));

      /**
       * A send function for when Node A calls an api from
       * Node B.
       */
      this.ipc.server.on('send', function(packet, socket) {
        if ('receiver' in packet) { this.send(packet); }
      }.bind(this));

      /**
       * A return function for when Node A calls an api from
       * Node B and Node B sends a response.
       */
      this.ipc.server.on('return', function(packet, socket) {
        if ('sender' in packet) { this.return(packet); }
      }.bind(this));

      /**
       * Used to make sure we remove any sockets that no longer exists.
       * When a socket disconnects, we find the socket and delete it.
       */
      this.ipc.server.on('socket.disconnected', function(socket, destroyedSocketID) {
        let keys = Object.keys(this.sockets);
        for (var key in keys) {
          try {
            this.ipc.server.emit(this.sockets[key], 'wellnessCheck', {});
          } catch (error) {
            delete this.sockets[key];
          }
        }
      }.bind(this));

      /**
       * Add in all custom API calls
       */
      for (let i=0; i<this.calls.length; i++) {
        this.ipc.server.on(this.calls[i], this.callBacks[i]);
      }
    }.bind(this));

    this.ipc.server.start();
  }
}


/**
 * Example Code
 */
function main() {
  let myServer = new Server('TestServer');

  myServer
    .addApiCall('butter', function(packet, socket) {
      packet.data = packet.data + 'with butter!';
      this.return(packet);
    })
    .run();
}

// main();

module.exports = { Server };