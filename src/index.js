const { Helpers } = require('./SamCore.js');

/**
 * TODO: if settings json doesnt exist, create the file
 *  - Will need to create a default SamCore package
 * 
 * TODO: Add internal API to install a package
 *  - Need a default object to add in for each new package
 *  - can set a cli argument for each setting
 *  - After info is put into settings json, install package
 *    - If development flag is set, do not try to install
 * 
 * TODO: Add internal API to modify settings json file
 *  - So other nodes can access and modify their own settings
 *  - So our package manager can add/remove/modify
 *    packages
 *  - Will need to make the API exclusive to node settings
 *    to prevent accidental changes to other settings.
 * 
 * TODO: Add internal API to start up all the other nodes
 *  - Which ever nodes are marked as 'persistent' we want
 *    to launch these nodes at this time.
 *  - There will also be a SamCore setting that can auto
 *    launch the persistent nodes on startup.
 *  - ALL other nodes, when started up, can NOT send out any
 *    messages UNTIL it receives an OK message from SamCore.
 *    This eliminates issues where a node's dependency nodes
 *    have not spun up yet and is attempting to make a call.
 * 
 * TODO: Add 'wellness check' ipc message handling
 *  - To make sure other nodes are still up and running
 *    - If a node has disconnected, we need to make sure
 *      to remove it's socket from the mySockets list.
 *      This is how we can tell if a node is active or not.
 *  - To let SamStart know if SamCore is up or down
 */
function main() {

  // Pull in the SamCore config file
  const editJsonFile = require('edit-json-file');
  // Get directory where program is executed from
  const runDirectory = process.cwd();
  const SamCoreSettings = 'SamCoreSettings.json';
  const filePath = `${runDirectory}/${SamCoreSettings}`
  // Display for debugging
  Helpers.log({leader: 'highlight'}, 'SamCoreSettings Filepath: ', filePath);

  /**
   * SamCore will be doing all of the editing and manipulation
   * of the json settings file.  So we can have it set up to
   * autosave.  No need to refresh the file.
   */
  let file = editJsonFile(filePath, {autosave: true});

  // Set up the IPC coms object
  const {IPCModule} = require('node-ipc');
  const ipc         = new IPCModule;
  const nodeName    = 'samCore';
  ipc.config.id     = nodeName;
  ipc.config.retry  = 1500;
  ipc.config.silent = true;
  let mySockets     = {};

  // IPC server setup
  ipc.serve(function(){

    /**
     * Internal API Calls, for getting SamCore info or modifying SamCore settings.
     * 
     * All Internal API Calls must receive in the following object:
     * data = { nodeSender: <string>, apiCall: <string>, packet: <any type> }
     */
    ipc.server.on('INTERNAL', function(data, socket){
      // Some logging for debugging
      Helpers.log({leader: 'arrow'}, 'Internal API Call');
      Helpers.log({leader: 'sub'},   'Requested API:    ', data.apiCall);
      Helpers.log({leader: 'sub'},   'Requested Packet: ', data.packet);
      Helpers.log({leader: 'sub'},   'Entire Packet:    ', data);


      /**
       * Internal API Call: doesNodeExist
       *    This is for checking if a node is actively running in the network.
       *    If a node is included in the dependency list, but is not currently running,
       *    this will return false.
       * 
       * TODO: Need to return false if node isnt running
       */
      if (data.apiCall == 'doesNodeExist') {
        data.packet.response = false;
        if (file.get('packages').includes(data.packet.nodeName)) { data.packet.response = true; }

        ipc.server.emit(socket, 'message', {
          nodeSender: nodeName, // node that message is coming from
          // nodeReceiver: nodeName, // node that message is coming from, SamCore doesnt send this value
          apiCall: 'doesNodeExist', // response coming from what api call?
          packet: data.packet // packet is the data coming back. can be any data type including json
        });
      }

      /**
       * Internal API Call: doesSettingsExist
       *    This is for checking to make sure the SamCoreSettings.json file exists
       *    and is in the proper location.  (kind of a test, we know its here since
       *    we called it at the start of this script...)
       */
      else if (data.apiCall == 'doesSettingsExist') {
        // if fine is found then set to true
        data.packet.response = true;

        ipc.server.emit(socket, 'message', {
          nodeSender: nodeName, // node that message is coming from
          // nodeReceiver: nodeName, // node that message is coming from, SamCore doesnt send this value
          apiCall: 'doesSettingsExist', // response coming from what api call?
          packet: data.packet // packet is the data coming back. can be any data type including json
        });
      }

    });

    /**
     * External API Calls, for using other nodes in the network.
     * 
     * All External API Calls must receive in the following object:
     * data = { nodeSender: <string>, nodeReceiver: <string>, apiCall: <string>, packet: <any type> }
     */
    ipc.server.on('EXTERNAL', function(data, socket){
      // Some logging for debugging
      Helpers.log({leader: 'arrow'}, 'External API Call');
      Helpers.log({leader: 'sub'},   'Node Sender:      ', data.nodeSender);
      Helpers.log({leader: 'sub'},   'Node Receiver:    ', data.nodeReceiver);
      Helpers.log({leader: 'sub'},   'Requested API:    ', data.apiCall);
      Helpers.log({leader: 'sub'},   'Requested Packet: ', data.packet);
      Helpers.log({leader: 'sub'},   'Entire Packet:    ', data);

      /**
       * On all external commands, SamCore is only responsible for relaying the
       * data object from one node to another.
       */
      if (data.nodeReceiver in mySockets) {
        ipc.server.emit(mySockets[data.nodeReceiver], 'message', data);
      } else {
        const error_text = `Node "${data.nodeReceiver}" does not exist!`;
        Helpers.log({leader: 'error', loud: true}, error_text);
        ipc.server.emit(socket, 'error', {
          nodeSender: nodeName,
          nodeReceiver: data.nodeSender,
          apiCall: data.apiCall,
          packet: {response: error_text}
        });
      }
    });

    /**
     * Used for transferring messages from one external node to another.
     * 
     * All Message calls must receive in the following object:
     * data = { nodeSender: <string>, nodeReceiver: <string>, packet: <any type> }
     */
    ipc.server.on('message', function(data, socket){
      // Some logging for debugging
      Helpers.log({leader: 'arrow'}, 'Message: ', data);

      ipc.server.emit(mySockets[data.nodeReceiver], 'message', data);
    });

    // Grab a list of all sockets connected
    ipc.server.on('nodeInit', function(data, socket){
      // Some logging for debugging
      Helpers.log({leader: 'arrow'}, 'nodeInit: ', data);

      mySockets[data.nodeSender] = socket;
    });

    // on Node Disconnect
    ipc.server.on('socket.disconnected',
      function(socket, destroyedSocketID) {
        Helpers.log({leader: 'arrow'}, 'client ', destroyedSocketID, ' has disconnected!');
      }
    );
  });

  ipc.server.start();
}

main();
