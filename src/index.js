const { Helpers } = require('./Helpers.js');

let serverName = 'samcore';

/**
 * SamCore will be doing all of the editing and manipulation
 * of the json settings file.  So we can have it set up to
 * autosave.  No need to refresh the file.
 *
 * Also, if the file doesnt exist, lets create one
 */
const editJsonFile    = require('edit-json-file');
const runDirectory    = process.cwd();
const SamCoreSettings = 'SamCoreSettings.json';
const filePath        = `${runDirectory}/${SamCoreSettings}`
let   db              = editJsonFile(filePath, {autosave: true});
if (!Object.keys(db.get()).length) {
  db.set(`packages.${serverName}`, Helpers.defaultPackage({
    version:    '1.0.0', // try and pull this from package file
    installed:  true,
    persistent: true,
    mandatory:  true,
    link:       "https: //github.com/vindennl48/Sam-SamCore"
  }));
} 

// Create server and run
const { Server } = require('./Server.js');
let SamCore = new Server(serverName);
SamCore
  .addApiCall('helloWorld', function(packet, socket) {
    packet.data = 'helloWorld! ' + packet.data;
    this.return(packet);
  })
  .addApiCall('doesNodeExist', function(packet, socket) {
    packet.dataSent = packet.data;
    packet.data     = false;

    /**
     * 'this.sockets' refers to an array in the Server class.
     * This array holds all of the active sockets that are
     * being used at any given moment.  As nodes connect to
     * this server, the socket between this server and the
     * node is stored in this array.  When the node terminates
     * or the connection is severed, the Server removes the
     * socket from this list.
     */
    if (packet.dataSent in this.sockets) {
      packet.data = true;
    }
    this.return(packet);
  })
  .addApiCall('getUsername', function(packet) {
    let keys = Object.keys(db.get());

    if ('username' in keys) {
      packet.data = db.get('username');
    } else {
      packet.data = 0;
    }

    this.return(packet);
  })
  .addApiCall('setUsername', function(packet) {
    if (!'data' in packet) {
      packet.data = false;
    } else {
      db.set('username', packet.data);
      packet.data = true;
    }
    this.return(packet);
  })

  .run();
