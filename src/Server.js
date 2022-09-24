const { IPCModule } = require('node-ipc');
const { Helpers }   = require('./Helpers.js');

class Server {
  /**
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

    // when set to true, all nodes can start communicating
    this.greenLight = false;

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
    // receiver.apiCall.return.sender.returnCode
    let returnCall = `${packet.receiver}.${packet.apiCall}.return.${packet.sender}`;
    if (packet.returnCode != null) {
      returnCall += `.${packet.returnCode}`;
    }

    this.ipc.server.broadcast(returnCall, packet);
  }

  returnError(packet) {
    if ( !('errorMessage' in packet) ) {
      packet.errorMessage = 'Default error message';
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

  _timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
    * Main function to start the server up
    */
  run(onConnect=null) {
    this.ipc.serve(function() {
      this.ipc.server.on('*', function(message, packet, socket) {
        if (message == 'connect') { return; }

        if (message == `${this.serverName}.return`) {
          this.return(packet);
        }
        else if (message == `${this.serverName}.returnError`) {
          this.returnError(packet);
        }
        else if (message == `${this.serverName}.send`) {
          this.send(packet);
        }
      }.bind(this));

      /**
        * This allows the server to collect sockets of the
        * connected nodes in the network.
        */
      this.ipc.server.on(`${this.serverName}.nodeInit`, function(packet, socket) {
        this.sockets[packet.data] = socket;

        // This should be bare minimum return on all API calls
        packet.bdata = packet.data;  // Make copy of original data
        packet.data  = true;         // Add our return data
        this.return(packet);         // Send the packet back to sender
      }.bind(this));

      /**
        * This tells nodes in the network if it is ok to start broadcasting
        * after initializing.
        */
      this.ipc.server.on(`${this.serverName}.greenLight`, function(packet, socket) {
        // This should be bare minimum return on all API calls
        packet.bdata = packet.data;     // Make copy of original data
        packet.data  = this.greenLight; // Add our return data
        this.return(packet);            // Send the packet back to sender
      }.bind(this));

      /**
        * Built-in for sending messages to other nodes.  Easy way
        * to be able to debug connection issues.
        */
      this.ipc.server.on(`${this.serverName}.message`, function(packet, socket) {
        Helpers.log(
          {leader: 'arrow', loud: true},
          `Message from '${packet.sender}':`,
          packet.data
        );

        // This should be bare minimum return on all API calls
        packet.bdata = packet.data;  // Make copy of original data
        packet.data  = true;         // Add our return data
        this.return(packet);         // Send the packet back to sender
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

        // no return required here
      }.bind(this));

      /**
        * Add in all custom API calls
        */
      for (let i=0; i<this.calls.length; i++) {
        this.ipc.server.on(this.calls[i], this.callBacks[i]);
      }


      /**
        * Here is the main loop function for this server.  It uses the
        * onConnect callback if it exists.
        */
      if (onConnect != null) { (onConnect.bind(this))(); }
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
    .addApiCall('helloWorld', function(packet) {
      packet.bdata = packet.data;
      packet.data  = 'Hello World! ' + packet.data ;
      this.return(packet);
    })

    .run(async function() {

      // Use to boot up all other nodes
      // const exec = require('child_process').exec;
      // exec('node src/Client.js',
      //   function (error, stdout, stderr) {
      //     Helpers.log({leader: 'warning', loud: false}, 'Client Died');
      //   }
      // );

      // placeholder to start up the other nodes
      // await this._timeout(10000);
      this.greenLight = true; // This is required to allow other nodes to start
    });
}

main();  // uncomment to use example code

module.exports = { Server };
