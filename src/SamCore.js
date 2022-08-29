/*******************************************************************************
 * ::Helpers Library::
 * 
 * This library is to provide helpful global functions that any nodes can use.
 * Any function that can be used by more than one node should probably exist
 * inside this library.
 ******************************************************************************/
let Helpers = {
  /**
   * @param  {json} args
   *    An object that can send a variety of different settings to
   *    the logger.  This can manipulate how the output looks/feels
   *    as well as many other features in the future.
   * @param  {string} args.leader
   *    We have a couple default options for you to choose from:
   *    - 'arrow': ---->
   *    - 'sub': spaces // this aligns with the other leaders
   *    - 'highlight': ====>
   *    - 'warning': ####>
   *    - 'error': >>>>>
   *    - if it doesnt exist, then what ever you put here
   *      will become your custom leader.
   * @param  {boolean} args.space
   *    Add 2 blank lines above and below message.
   * @param  {boolean} args.spaceTop
   *    Add 2 blank lines above message.
   * @param  {boolean} args.spaceBottom
   *    Add 2 blank lines below message.
   * @param  {any} messages
   *    This can be any format type
   * 
   * TODO: add an automatic logging feature to local file
   */
  log(args={}, ...messages) {
    if (typeof args !== 'object') { console.log(args); return; }

    if ('leader' in args) {
      if      (args.leader == 'arrow')     { args.leader = '---->'; }
      else if (args.leader == 'sub')       { args.leader = '     '; }
      else if (args.leader == 'highlight') { args.leader = '====>'; }
      else if (args.leader == 'warning')   { args.leader = '####>'; }
      else if (args.leader == 'error')     { args.leader = '>>>>>'; }
    }

    if ('space' in args && args.space) {
      args.spaceTop = true;
      args.spaceBottom = true;
    }
    if ('spaceTop' in args && args.spaceTop) {
      args.leader = '\n\n' + args.leader;
    }
    if ('spaceBottom' in args && args.spaceBottom) {
      messages.push('\n\n');
    }
    
    messages.unshift(args.leader);
    console.log.apply(console, messages);
  }
}


const { IPCModule } = require('node-ipc');
/*******************************************************************************
 * ::SamCore Library::
 * 
 * This library is meant to be an importable module inside of a custom node.
 * That way we can write nodes much more easily than trying to rewrite all of
 * this code for every new node we want to create.
 * 
 * There are a couple nice features with this:
 *  - Pre-made functions that activate the SamCore internal API.  This saves
 *    the teedious steps of having to add the SamCore API manually.
 *  - Allows for easier upgrading for the future.
 *    - When an upgrade occurs, we can just add it to this module and it will
 *      be able to update all nodes.  Whereas if an update occured to the core,
 *      we would have to go back through all existing nodes and modify their
 *      code base one-by-one.
 *  - Hooks built into the IPC protocol.  This takes a lot of the hard work out
 *    of communication with SamCore and the other nodes in the network.
 *    Remember, all node communication goes through SamCore.
 ******************************************************************************/
let SamCore = {
  ipc: null,
  nodeName: 'default',

  /**
   * @param {{nodeSender: string, nodeReceiver: string, apiCall: string, packet: json}} data 
   *    This function will be overloaded by yourself. This is the hook
   *    to be able to receive messages from other nodes.  When a message
   *    is received, you can put what you want accomplished inside this hook.
   * 
   *    Make sure to separate out the incoming messages by nodeSender
   *    and apiCall.
   */
  onMessage(data){ /** overload this function */ },

  /**
   * Hook for using the API on external nodes in the network
   */
  onConnect(){ /** overload this function */ },

  /**
   * Hook for garbage cleanup when this node gets disconnected
   */
  onDisconnect(){ /** overload this function */ },



/** INTERNAL API */
/**
 * The Internal API commands have two functions each.  The first
 * is a function to call the API from SamCore.  The second is run
 * when SamCore completes your API request and sends a response.
 * 
 * Any API call you use inside your own node will require you to
 * overload the given ***Return() function with code that you would
 * like to run after receiving a response.
 */

  /**
   * @param  {string} nodeName
   *    Name of the node you want to know exists or not.
   *    Exists means if the node is actively running in the network.
   */
  doesNodeExist(nodeName) {
    this.__internal('doesNodeExist', {nodeName: nodeName});
  },
  /**
   * @param {{ nodeName: string, response: boolean }} data
   *    Response from SamCore
   */
  doesNodeExistReturn(data) { /** overload this function */ },

  /**
   * Check to make sure SamCore settings file exists.
   */
  doesSettingsExist() {
    this.__internal('doesSettingsExist', {});
  },
  /**
   * @param {{ response: boolean }} data
   *    Response from SamCore
   */
  doesSettingsExistReturn(data) { /** overload this function */ },

/** END INTERNAL API */

  /**
   * PRIVATE FUNCTION:
   * @param  {string} apiCall
   *    The API call you want to make to SamCore
   * @param  {json} packet
   *    The data packet in json format to the SamCore API call.
   */
  __internal(apiCall, packet) {
    ipc.of.samCore.emit('INTERNAL', {
      nodeSender: SamCore.nodeName,
      apiCall: apiCall,
      packet: packet
    });
  },

  /**
   * Start the connection to the node network.
   */
  run() {
    /**
     * Note:
     *  - All references to the SamCore object in here cannot
     *    use 'this'. Instead, they must use the SamCore name:
     *    - Do NOT Do: ipc.config.id = this.nodeName;
     *    - Do this:   ipc.config.id = SamCore.nodeName;
     */
    ipc = new IPCModule;
    ipc.config.id = SamCore.nodeName;
    ipc.config.retry = 1500;

     ipc.connectTo('samCore', function(){

      /**
       * Messages from SamCore.  This has all the return messages from
       * both the SamCore and external nodes after an api call.
       * 
       * All Message calls must receive in the following object:
       * data = { nodeSender: <string>, nodeReceiver: <string>, apiCall: <string>, packet: <json> }
       */
      ipc.of.samCore.on('message', function(data){
        /**
         * This is where all of the internal api hooks will go
         */
        if (data.nodeSender = 'samCore') {
          if      (data.apiCall == 'doesNodeExist') { SamCore.doesNodeExistReturn(data.packet); }
          else if (data.apiCall == 'doesSettingsExist') { SamCore.doesSettingsExistReturn(data.packet); }
          // return;
        }

        /**
         * This hook is used for external nodes.  All SamCore internal API
         * commands are listed as functions above.
         */
        SamCore.onMessage(data); // Run hook
      });

      // Connect
      ipc.of.samCore.on('connect', function(){
        Helpers.log({leader: 'warning', space: true}, 'Connected to samCore');

        /**
         * Need to send a confirmation to SamCore with this node-name.
         * This lets SamCore access sockets by node-name.
         */
        ipc.of.samCore.emit('nodeInit', {nodeSender: SamCore.nodeName});

        SamCore.onConnect(); // Run hook
      });

      // Disconnect
      ipc.of.samCore.on('disconnect', function(){
        Helpers.log({leader: 'warning', space: true}, 'Disconnected from samCore');

        SamCore.onDisconnect(); // Run hook
      });

    });
  }
}



module.exports = { SamCore, Helpers };