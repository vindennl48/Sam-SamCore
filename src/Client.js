const { IPCModule } = require('node-ipc');
const { Helpers }   = require('./Helpers.js');

class Client {
  /**
   * 
   * @param {string} nodeName 
   *  Name of this node
   * @param {string} serverName 
   *  Name of the server to connect to
   * @param {bool} isSilent 
   *  Do you want node-ipc to be verbose? (default=true)
   * @returns this
   */
  constructor(nodeName, serverName, isSilent=true) {
    this.nodeName          = nodeName;
    this.serverName        = serverName;

    this.ipc               = new IPCModule;
    this.ipc.config.id     = nodeName;
    this.ipc.config.retry  = 1500;
    this.ipc.config.silent = isSilent;

    this.calls     = [];
    this.callBacks = [];

    return this;
  }

  /**
   * Return data back from an API Call 
   * 
   * @param {json} packet 
   *  packet received for API call
   */
  return(packet) {
    this.ipc.of[this.serverName].emit('return', packet);
  }

  /**
   * Used to call an API from another node
   * 
   * @param {string} receiver 
   *  Name of node to call
   * @param {string} apiCall 
   *  Name of API to call
   * @param {json} data 
   *  Any data required to send for the API call. If no data
   *  is required, send an empty object = {}
   */
  call(receiver, apiCall, data={}) {
    let packet = {
      sender: this.nodeName,
      receiver: receiver,
      apiCall: apiCall,
      data: data
    };
    
    let message = apiCall;

    /**
     * If we calling an api from another node and not
     * from SamCore
     */
    if (receiver != this.serverName) {
      message = 'send'; 
    }

    this.ipc.of[this.serverName].emit(message, packet);
  }

  /**
   * Used for the return messages.  This is an easier way to sift thru
   * the return messages and figure out where they came from.  Use in an
   * if else if statement.
   * 
   * @param {string} nodeName 
   *  Name of node that message came from
   * @param {string} apiCall 
   *  Name of api call that the message came from
   * @param {json} packet 
   *  Packet that came back from api call
   * @returns boolean
   */
  receive(nodeName, apiCall, packet) {
    if (packet.receiver == nodeName && packet.apiCall == apiCall) {
      return true;
    }
    return false;
  }

  /**
   * Used for adding an API call to this node
   * 
   * @param {string} call 
   *  Name of API call
   * @param {function(data)} callBack 
   *  Function to run when API is called. This must include
   *  'data' and 'socket' as arguments.
   * @returns this
   */
  addApiCall(call, callBack) {
    this.calls.push(call);
    this.callBacks.push(callBack.bind(this));
    return this;
  }

  /**
   * Used to start up the IPC connection.  This function MUST
   * be called. 
   * 
   * @param {function} onConnect 
   *  Optional main function call for this Node.  Called after
   *  connection to server is established.
   */
  run(onConnect=null) {
    this.ipc.connectTo(this.serverName, function() {
      /**
       * When the node initially connects to the server, this will
       * send it's node name to the server so the server can collect
       * the socket connection for future use.
       * 
       * The onConnect function is going to be the 'main' loop for
       * this node.
       */
      this.ipc.of[this.serverName].on('connect', function() {
        this.ipc.of[this.serverName].emit('nodeInit', this.nodeName);
        if (onConnect != null) { (onConnect.bind(this))(); }
      }.bind(this));

      /**
       * If connection ends with the server, shutdown program.  The server
       * is responsible for restarting all nodes in the network.
       */
      this.ipc.of[this.serverName].on('disconnect', function() {
        this.ipc.disconnect(this.serverName);
      }.bind(this));

      /**
       * Built-in for sending messages to other nodes.  Easy way
       * to be able to debug connection issues.
       */
      this.ipc.of[this.serverName].on('message', function(packet) {
        Helpers.log({leader: 'arrow', loud: true}, `Message from "${packet.sender}":`, packet.data);
      }.bind(this));

      /**
       * All of this node's API calls
       */
      for (let i=0; i<this.calls.length; i++) {
        this.ipc.of[this.serverName].on(this.calls[i], this.callBacks[i]);
      }
    }.bind(this));
  }
}

/**
 * Example Code
 */
function main() {
  let myNode = new Client('TestClient', 'TestServer');

  myNode
    .addApiCall('helloWorld', function(packet) {
      packet.data = 'HELLO WORLD! ' + packet.data;
      this.return(packet);
    })
    .addApiCall('return', function(packet) {
      if (this.receive('TestServer', 'butter', packet)) {
        console.log('Result: ', packet.data);
      }
      else if (this.receive('TestClient', 'helloWorld', packet)) {
        console.log('Result: ', packet.data);
      }
    })
    .run(function() {
      // Main Function. Called after connection is established
      this.call('TestServer', 'butter', 'Butter the bread...');
    });
}
// main();  // uncomment to use example code

module.exports = { Client };