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
    this.ipc.of[this.serverName].emit(
      `${this.serverName}.return`,
      packet
    );
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
  callApi(receiver, apiCall, data={}) {
    let packet = {
      sender:   this.nodeName,
      receiver: receiver,
      apiCall:  apiCall,
      data:     data
    };
    
    /**
     * If we calling an api from another node and not
     * from SamCore
     */
    this.ipc.of[this.serverName].emit(
      receiver == this.serverName ? `${this.serverName}.${apiCall}` :
        `${this.serverName}.send`,
      packet
    );
  }

  /**
   * Used for adding an API call to this node
   * 
   * @param {string} call 
   *  Name of API call
   * @param {function(data)} callBack 
   *  Function to run when API is called. This must include
   *  'packet' as an argument for the callback function.
   * @returns this
   */
  addApiCall(call, callBack) {
    this.calls.push(`${this.nodeName}.${call}`);
    this.callBacks.push(callBack.bind(this));
    return this;
  }

  /**
   * Used for adding a hook to another node's API call
   * 
   * @param {string} call 
   *  For hooking into an API request:
   *    senderNodeName.apiCall
   *  For hooking into an API response:
   *    senderNodeName.apiNodeName.apiCall
   * @param {function(data)} callBack 
   *  Function to run when API is called. This must include
   *  'packet' as an argument for the callback function.
   * @returns this
   */
  addHook(call, callBack) {
    this.calls.push(call);
    this.callBacks.push(callBack.bind(this));
    return this;
  }

  /**
   * Used for adding return API calls
   * 
   * @param {string} apiNodeName 
   *  Name of node that we are receiving an answer from
   * @param {string} call 
   *  Name of API call
   * @param {function(data)} callBack 
   *  Function to run when data is received. Must have
   *  'packet' as an argument for the callback function.
   * @returns this
   */
  addReturnCall(apiNodeName, call, callBack) {
    this.calls.push(`${this.nodeName}.${apiNodeName}.${call}`);
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
        // this.ipc.of[this.serverName].emit('nodeInit', this.nodeName);
        this.callApi(this.serverName, 'nodeInit', this.nodeName);
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
      this.ipc.of[this.serverName].on(`${this.nodeName}.message`, function(packet) {
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
  let myNode = new Client('testclient', 'testserver');

  // API
  myNode
    .addApiCall('helloWorld', function(packet) {
      packet.data = 'HELLO WORLD! ' + packet.data;
      this.return(packet);
    })

  /*
   * Hooks:
   *   Need to add the exact IPC message that you want to
   *   hook on to:
   *     for sent calls:     receiverNodeName.apiCall
   *     for receiver calls: senderNodeName.receiverNodeName.apiCall
   */
  myNode
    .addHook('testserver.butter', function(packet) {
      console.log('Hook before: ', packet.data);
    })
    .addHook('testclient.testserver.butter', function(packet) {
      console.log('Hook after: ', packet.data);
    })

  /*
  * Return data from api calls
  * Return calls need to be in this format:
  *   thisNodeName.receivedByNodeName.apiCall
  * This helps filter out where the call came from.
  */
  myNode
    .addReturnCall('testclient', 'helloWorld', function(packet) {
      console.log('Result: ', packet.data);
    })
    .addReturnCall('testserver', 'butter', function(packet) {
      console.log('Result: ', packet.data);
    })

  // Main function
  myNode
    .run(function() {
      // Main Function. Called after connection is established
      this.callApi('testserver', 'butter', 'Butter the bread...');
    });
}
// main();  // uncomment to use example code

module.exports = { Client };
