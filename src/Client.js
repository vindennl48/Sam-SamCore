const { IPCModule } = require('node-ipc');
const { Helpers }   = require('./Helpers.js');

class Client {
  /**
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
    * Call an API call from another node
    *
    * @param {string} receiver
    *   The node in which you are calling the api call from
    * @param {string} apiCall
    *   The name of the api call to call
    * @param {all} data
    *   Can be any data type. This is the data required by the api call
    */
  async callApi(receiver, apiCall, data={}) {
    if (typeof data !== 'object') { data = {}; }

    let promise = await new Promise(function(resolve, reject) {
      /**
        * The returnCode is to force a unique callback for each api call.  This
        * allows us to prevent mixing receiving data up with other calls being
        * made at the same time.
        */
      let returnCode = Date.now();

      // Creates the ipc listener for the return data
      this.ipc.of[this.serverName].on(
        `${receiver}.${apiCall}.return.${this.nodeName}.${returnCode}`,
        resolve,
        true // setting this true will remove this listener once used
      );

      // Generates the packet needed to send thru the server
      let packet = {
        sender:       this.nodeName,
        receiver:     receiver,
        apiCall:      apiCall,
        returnCode:   returnCode,
        bdata:        data, // used as backup for debugging
        data:         data
      };

      // Sends out the api call
      this.ipc.of[this.serverName].emit(
        receiver == this.serverName ? `${this.serverName}.${apiCall}` :
          `${this.serverName}.send`,
        packet
      );

    }.bind(this));

    // This returns a packet
    return promise;
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
    * Return data back from an API Call 
    * 
    * @param {json} packet 
    *  packet received for API call
    */
  return(packet) {
    if ( !('status' in packet.data) ) {
      packet.data.status = true;
    }
    this.ipc.of[this.serverName].emit(`${this.serverName}.return`, packet);
  }

  /**
    * Return an error from API call.  If errorMessage is already in packet, this
    * will not change the existing errorMessage.
    *
    * @param {json} packet
    *   packet returning from API Call
    * @param {string} errorMessage
    *   Message being sent back to caller of api call
    */
  returnError(packet, errorMessage='Default Error Message') {
    if ( !('status' in packet.data) ) {
      packet.data.status = false;
    }

    if ( !('errorMessage' in packet.data) ) {
      packet.data.errorMessage = errorMessage;
    }

    this.return(packet);
  }

  /**
    * Used to start up the IPC connection.  This function MUST
    * be called. 
    * 
    * @param {function} onConnect 
    *  Optional main function call for this Node.  Called after
    *  connection to server is established.
    */
  // run(onConnect=null) {
  async run(args) {
    // args is being checked before being used below.

    /**
      * Make sure we establish connection first
      */
    await this._connect();

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
      Helpers.log({leader: 'arrow', loud: true}, `Message from '${packet.sender}':`, packet.data);
    }.bind(this));

    /**
      * Make sure server gives go-ahead before loading custom api calls
      */
    await this._networkOperational();

    if ('onInit' in args) { await (args.onInit.bind(this))(); }

    /**
      * Now we can load all of this node's API calls
      */
    for (let i=0; i<this.calls.length; i++) {
      this.ipc.of[this.serverName].on(this.calls[i], this.callBacks[i]);
    }

    /**
      * Here is the main loop function for this node.  It uses the
      * onConnect callback if it exists.
      */
    if ('onConnect' in args) { (args.onConnect.bind(this))(); }
  }

  async _connect() {
    let promise = await new Promise(function(resolve, reject) {
      /**
        * This establishes the connection between this node and the Server,
        * SamCore. Documentation can be found in the node-ipc github repo.
        */
      this.ipc.connectTo(this.serverName, async function() {
        // When connection is established, run nodeInit
        this.ipc.of[this.serverName].on('connect', async function() {
          /**
            * When the node initially connects to the server, this will
            * send it's node name to the server so the server can collect
            * the socket connection for future use.
            */
          await this.callApi(this.serverName, 'nodeInit', { name: this.nodeName });
          resolve();
        }.bind(this));
      }.bind(this));
    }.bind(this));

    return promise;
  }

  async _networkOperational() {
    let answer = false;

    while (!answer) {
      let packet = await this.callApi(this.serverName, 'greenLight');
      if (packet.data.result === true) {
        answer = true;
        // Helpers.log({leader: 'highlight', loud: false}, 'GO!');
      } else {
        // Helpers.log({leader: 'highlight', loud: false}, 'Waiting for green light..');
        await this._timeout(1000);
      }
    }

    return answer;
  }

  async _timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}


/**
  * Example Code
  */
function main() {
  let nodeName   = 'testclient';
  let serverName = 'testserver';
  let myNode     = new Client(nodeName, serverName/*, false*/);

  myNode
    .addApiCall('helloMe', function(packet) {
      packet.data = packet.data + ' ME!';
      this.return(packet);
    })

    .run({onConnect: async function() {
      let packet = await this.callApi(nodeName, 'helloMe', 'All of this with');

      Helpers.log({leader: 'arrow', loud: true}, 'packet: ', packet.data);
    }});
}

// main(); // uncomment to use example code

module.exports = { Client };
