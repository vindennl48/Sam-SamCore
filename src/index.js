const { EditJsonFile } = require('./EditJsonFile.js');
const { Server }       = require('./Server.js');
const { Helpers }      = require('./Helpers.js');
const Files            = Helpers.Files;
const spawn            = require('child_process').spawn;

let serverName = 'samcore';
let nodes      = {};  // List of child fork nodes

/**
 * SamCore will be doing all of the editing and manipulation
 * of the json settings file.  So we can have it set up to
 * autosave.  No need to refresh the file.
 *
 * Also, if the file doesnt exist, lets create one
 */
const filePath = Files.join('cwd', 'SamCoreSettings.json');
let db = new EditJsonFile(filePath, { autosave: true });
if ( db.get(['packages', servername]) === undefined ) {
  db.set(['packages', serverName], Helpers.defaultPackage({
    version:    '1.0.0', // try and pull this from package file
    installed:  true,
    persistent: true,
    mandatory:  true,
    link:       "https://github.com/vindennl48/Sam-SamCore"
  }));
} 

// Get settings for samcore
let settings = db.get(['packages', serverName, 'settings']);
function setSettings() {
  db.set(['packages', serverName, 'settings'], settings);
}
if (settings === 'undefined') {
  settings = {};
  setSettings();
}

// Create server and run
let SamCore = new Server(serverName);

SamCore
  /**
    * Used for debugging.
    *
    * packet.data = {
    *   text: 'any text to come after hello world'
    * }
    */
  .addApiCall('helloWorld', function(packet) {
    if ( !('text' in packet.data) ) {
      this.returnError(packet, 'text argument not included!');
      return;
    }

    packet.data = {
      result: 'helloWorld! ' + packet.data.text
    }
    this.return(packet);
  })

  /**
    * See if a node is on the network.
    *
    * packet.data = {
    *   name: 'name of node to check on'
    * }
    */
  .addApiCall('doesNodeExist', function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'name argument not included!');
      return;
    }

    packet.data = {
      result: false
    };

    /**
     * 'this.sockets' refers to an array in the Server class.
     * This array holds all of the active sockets that are
     * being used at any given moment.  As nodes connect to
     * this server, the socket between this server and the
     * node is stored in this array.  When the node terminates
     * or the connection is severed, the Server removes the
     * socket from this list.
     */
    if (packet.bdata.name in this.sockets) {
      packet.data.result = true;
    }
    this.return(packet);
  })

  /**
    * Get current username.
    *
    * packet.data = {}
    */
  .addApiCall('getUsername', function(packet) {
    if ('username' in settings) {
      packet.data = {
        result: settings.username
      }
      this.return(packet);
      return;
    }

    this.returnError(packet, 'Username is not set!');
  })

  /**
    * Set current username.
    *
    * packet.data = {
    *   name: 'new username'
    * }
    */
  .addApiCall('setUsername', async function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'name argument not included!');
      return;
    }

    settings.username = packet.data.name;
    setSettings();

    this.return(packet);
  })

  /**
    * Get settings for current node
    *
    * packet.data = {}
    */
  .addApiCall('getSettings', function(packet) {
    let settings = db.get(['packages', packet.sender, 'settings']);

    if (settings !== undefined) {
      packet.data = {
        result: settings
      }
      this.return(packet);
      return;
    }

    this.returnError(packet, `Settings could not be found for node '${packet.sender}'!`);
  })

  /**
    * Set settings for current node
    *
    * packet.data = {
    *   settings: { settings object }
    * }
    */
  .addApiCall('setSettings', function(packet) {
    if ( !('settings' in packet.data) ) {
      this.returnError(packet, 'settings argument not included!');
      return;
    }

    if ( db.get(['packages', packet.sender]) !== undefined ) {
      db.set(['packages', packet.sender, 'settings'], packet.data.settings);
    } else {
      this.returnError(
        packet,
        'There is an issue with the SamCoreSettings.json file!'
      );
      return;
    }

    this.return(packet);
  })

  /**
    * Get working directory of a daw
    *
    * packet.data = {
    *   name: 'name of daw'
    * }
    */
  .addApiCall('doesNodeExist', function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'name argument not included!');
      return;
    }

    packet.data = {
      result: false
    };

    /**
     * 'this.sockets' refers to an array in the Server class.
     * This array holds all of the active sockets that are
     * being used at any given moment.  As nodes connect to
     * this server, the socket between this server and the
     * node is stored in this array.  When the node terminates
     * or the connection is severed, the Server removes the
     * socket from this list.
     */
    if (packet.bdata.name in this.sockets) {
      packet.data.result = true;
    }
    this.return(packet);
  })

  .run({
    onInit:    onInit,
    onConnect: onConnect
  });

async function onInit() {}

async function onConnect() {

  // Need to start up all of the other nodes as well
  let packages = db.get('packages');

  Object.keys(packages).forEach(name => {
    if (packages[name].enabled && packages[name].persistent && name !== serverName) {
      // spawn process
      nodes[name] = spawn('node', [`./${name}/.`])

      nodes[name].stdout.on('data', function (data) {  
        Helpers.log({loud: true}, `${name}: ${data}`);
      });  
      nodes[name].stderr.on('data', function (data) {  
        Helpers.log({loud: true}, `${name} Error: ${data}`);
      });  
      nodes[name].on('close', function (code) {  
        Helpers.log({loud: true}, `${name} Closed: ${code}`);
      });

      Helpers.log({leader: 'highlight', loud: true, spaceBottom: true}, `Started "${name}"`);
    }
  });

  this.greenLight = true; // This allows the other nodes to start running
}

