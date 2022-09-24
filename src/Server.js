const { IPCModule } = require('node-ipc');
const { Helpers }   = require('./Helpers.js');

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
    let returnCall = `${packet.sender}.${packet.receiver}.${packet.apiCall}`;
    if (packet.returnCode != null) {
      returnCall = returnCall + `.${packet.returnCode}`;
    }

    if (packet.apiCall == 'onError') {
      returnCall = 'onError';
    }

    this.ipc.server.broadcast(returnCall, packet);
  }

  returnError(packet, errorMessage=null) {
    if (errorMessage != null) {
      packet.errorMessage = errorMessage;
    }

    this.ipc.server.broadcast(`${packet.sender}.onError`, packet);
  }

  /**
   * Used to send the api call to the destined node. The Server in this
   * network is the middleman for all communication.
   * 
   * @param {json} packet 
   *  packet received from node
   */
  send(packet) {
    this.ipc.server.broadcast(
      `${packet.receiver}.${packet.apiCall}`,
      packet
    );
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
    this.calls.push(`${this.serverName}.${call}`);
    this.callBacks.push(callBack.bind(this));
    return this;
  }

  /**
   * Main function to start the server up
   */
  run() {
    this.ipc.serve(function() {
      this.ipc.server.on('*', function(message, packet, socket) {
        if (message == 'connect') { return; }
        // Helpers.log({leader: 'highlight'}, `Message: ${message}, Packet: `, packet, `, Socket: ${socket.connecting}`);
        if (message.endsWith('return')) {
          this.return(packet);
        }
        else if (message.endsWith('returnError')) {
          this.returnError(packet);
        }
        else {
          this.send(packet);
        }
      }.bind(this));

      /**
       * This allows the server to collect sockets of the
       * connected nodes in the network.
       */
      this.ipc.server.on(`${this.serverName}.nodeInit`, function(packet, socket) {
        this.sockets[packet.data] = socket;
      }.bind(this));

      /**
       * A send function for when Node A calls an api from
       * Node B.
       */
// Have to get rid of these because of the hook broadcast.
// This was double sending calls
//      this.ipc.server.on(`${this.serverName}.send`, function(packet, socket) {
//        if ('receiver' in packet) { this.send(packet); }
//      }.bind(this));
//
//      /**
//       * A return function for when Node A calls an api from
//       * Node B and Node B sends a response.
//       */
//      this.ipc.server.on(`${this.serverName}.return`, function(packet, socket) {
//        if ('sender' in packet) { this.return(packet); }
//      }.bind(this));

      /**
       * Built-in for sending messages to other nodes.  Easy way
       * to be able to debug connection issues.
       */
      this.ipc.server.on(`${this.serverName}.message`, function(packet, socket) {
        Helpers.log(
          {leader: 'arrow', loud: true},
          `Message from "${packet.sender}":`,
          packet.data
        );
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
  let myServer = new Server('testserver');

  myServer
    .addApiCall('butter', function(packet, socket) {
      packet.data = packet.data + 'with butter!';
      this.return(packet);
    })
    .run();
}
// main();  // uncomment to use example code

module.exports = { Server };
