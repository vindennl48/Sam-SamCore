const { EditJsonFile } = require('./EditJsonFile.js');
const { Server }       = require('./Server.js');
const { Helpers }      = require('./Helpers.js');

let serverName = 'samcore';

/**
 * SamCore will be doing all of the editing and manipulation
 * of the json settings file.  So we can have it set up to
 * autosave.  No need to refresh the file.
 *
 * Also, if the file doesnt exist, lets create one
 */
const runDirectory    = process.cwd();
const SamCoreSettings = 'SamCoreSettings.json';
const filePath        = `${runDirectory}/${SamCoreSettings}`
let   db              = new EditJsonFile(filePath, {autosave: true});
if ( !Object.keys(db.get()).length ) {
  db.set(['packages', serverName], Helpers.defaultPackage({
    version:    '1.0.0', // try and pull this from package file
    installed:  true,
    persistent: true,
    mandatory:  true,
    link:       "https: //github.com/vindennl48/Sam-SamCore"
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
let SamCore    = new Server(serverName);

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
    if ('packages' in db.get() &&
        packet.sender in db.get('packages') &&
        'settings' in db.get(['packages', packet.sender])) {
      packet.data = {
        result: db.get(['packages', packet.sender, 'settings'])
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

    if ('packages' in db.get() && packet.sender in db.get('packages')) {
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
    * Get the filepath of the DAW working directory
    *
    * packet.data = {
    *   name: 'name of daw'
    * }
    */
  .addApiCall('getDawHomeDir', function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'name argument not included!');
      return;
    }

    if ('daw' in db.get() &&
        packet.data.name in db.get('daw') &&
        'path' in db.get(['daw', packet.data.name])) {
      packet.data = {
        result: db.get(['daw', packet.data.name, 'path'])
      }
      this.return(packet);
      return;
    }

    this.returnError(packet, 'DAW does not have a home directory!');
  })

  /**
    * Set the filepath of the DAW working directory
    *
    * packet.data = {
    *   name: 'name of daw',
    *   path: 'filepath of daw working directory',
    * }
    */
  .addApiCall('setDawHomeDir', function(packet) {
    if ( !('name' in packet.data) ) {
      this.returnError(packet, 'name argument not included!');
      return;
    }
    if ( !('path' in packet.data) ) {
      this.returnError(packet, 'path argument not included!');
      return;
    }

    db.set(['daw', packet.data.name, 'path'], packet.data.path);

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

async function onInit() {
 this.greenLight = true; 
}

async function onConnect() {}

