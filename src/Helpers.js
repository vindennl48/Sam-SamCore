const fs   = require('fs');
const fse  = require('fs-extra');
const exec = require('child_process').exec;
const path = require('path');

let Helpers = {
  /**
    * This function helps us with creating promises that will decay after a
    * designated period of time.  This will prevent other nodes from freezing if
    * something crashes in the network.
    *
    * @param {function} call
    *   Function to call during promise
    * @param {integer} timelimit
    *   How long in MS to wait until we call an error
    */
  async _promise(call, timelimit=0) {
    let timer;
    let race = [(async () => { return await new Promise(call); })()];

    if (timelimit !== 0) {
      race.push(
        (async () => {
          await new Promise((resolve, reject) => {
            timer = setTimeout(resolve, timelimit);
          })
          return { data: { status: false, errorMessage: 'API Timeout!' } };
        })()
      );
    }

    return await Promise.race(race).finally(() => clearTimeout(timer));
  },

  /**
   * A high powered logging function capable of being shut off and
   * manipulated very easily within the SAM network.
   * 
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
   * @param  {boolean} args.silent
   *    Keep all messages silent; only need to run once.
   * @param  {any} messages
   *    This can be any format type
   * 
   * TODO: add an automatic logging feature to local file
   */
  log(args={}, ...messages) {
    // if there is only one argument sent thru then just print
    if (typeof args !== 'object') {
      if (!this.log_silent) { console.log(args); }
      return;
    }

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
    
    if ('leader' in args) { messages.unshift(args.leader); }

    if ('silent' in args && args.silent) { this.log_silent = true; }

    if (!this.log_silent || ('loud' in args && args.loud)) {
      console.log.apply(console, messages);
    }
  },
  log_silent: false,

  /**
  * functions used in models / dbjson items
  */
  model: {
    /**
    * @param {array} arr - Array of attributes for a model object
    * @param {string} attr - Attribute that we want to filter from a model
    *   object
    */
    getAttr(arr, attr) {
    return arr.filter(a => {
      return a.attr === attr;
    });
    }
  },

  /**
  * Return if there is an error
  */
  // packetArgsCheck(args={}) {
  // }

  /**
   * 
   * @param {json} args
   *  - version: version number as string '1.0.0'
   *  - development: is actively being developed
   *  - installed: is downloaded
   *  - enabled: allowed to run
   *  - persistent: needs to run when SamCore runs
   *  - mandatory: can not be uninstalled
   *  - link: internet path to package
   *  - settings: json
   * 
   * Note: For SamCore on most of these options, they are
   *       ignored. 
   *  - installed, enabled, persistent, mandatory
   */
  defaultPackage(args={}) {
    return {
      version:     ('version'     in args) ? args.version     : '1.0.0',
      development: ('development' in args) ? args.development : false,
      installed:   ('installed'   in args) ? args.installed   : false,
      enabled:     ('enabled'     in args) ? args.enabled     : true,
      persistent:  ('persistent'  in args) ? args.persistent  : false,
      mandatory:   ('mandatory'   in args) ? args.mandatory   : false,
      link:        ('link'        in args) ? args.link        : "",
      settings:    ('settings'    in args) ? args.settings    : {}
    };
  }
}

Helpers.Files = {
  /**
  * merge bash commands together with spaces
  */
  _argsJoin(...args) {
    let result = "";

    args.forEach(arg => {
      result = `${result} ${arg}`;
    });

    return result;
  },

  /**
  * run a bash command
  */
  async _run(...args) {
    let command = this._argsJoin(...args);

    return await Helpers._promise(function(resolve, reject) {
      let process = exec(command, (err, stdout, stderr) => {
        resolve(stdout);
      });
    });
  },

  /**
  * Just a wrapper for path.join but all inclusive in this Files object.
  *
  * If the first argument is 'cwd', it will use the current working directory
  */
  join(...args) {
    if (args[0] === 'cwd') {
      args[0] = process.cwd();
    }
    return path.join(...args);
  },

  /**
  * For easily quoting text, especially for running bash commands
  */
  q(text) {
    return `'${text}'`
  },

  /**
  * For replacing in text easily.  add a #1 #2 etc. and replace with args
  *
  * r('Hi my #1 is #2 and my #1 is stupid', 'name', 'mitch')
  * result: 'Hi my name is mitch and my name is stupid'
  */
  r(text, ...args) {
    args.forEach((value, i) => {
      text = text.replace(`#${i+1}`, value);
    });
    return text;
  },

  /**
  * Checks if file or folder exists
  */
  exists(path) {
    if ( fs.existsSync(path) ) {
      return true;
    }
    return false;
  },

  /**
  * Remove file or folder.  WARNING: Can not be reversed!
  */
  remove(path) {
    if ( fs.statSync(path).isDirectory() ) {
      fs.rmSync(path, { recursive: true, force: true });
      return;
    }

    fs.unlinkSync(path);
  },

  /**
  * Create a folder.  This creates entire folder path if it doesnt exist
  */
  mkdir(path) {
    fs.mkdirSync(path, { recursive: true });
  },

  /**
  * Copy a file or folder to a new location
  */
  copy(src, dest) {
    fse.copySync(src, dest);
  },

  /**
  * ASYNC
  *
  * Compress a directory into a tarball
  */
  async compress(src, dest) {
    return await this._run(
      this.r('tar -C #2 -zcvf #1 .', this.q(dest), this.q(src))
    );
  },

  /**
  * ASYNC
  *
  * Extract a tarball into a directory
  */
  async extract(src, dest) {
    await this.mkdir(dest);

    await this._run(
      this.r('tar -zxvf #1 -C #2 #3', this.q(src), this.q(dest), '--strip-components=1')
    )
  },

  /**
  * ASYNC
  *
  * This is how we will compare if a song has changed at all. First check is to
  * match the directory tree.  This function gets the directory tree to save in
  * the local filesdb.json.
  */
  async getDirMap(path) {
    return await this._run(
      this.r('tree #1', this.q(path))
    );
  },

  /**
  * This is to easily compare two files to eachother
  */
  compareFiles(file1, file2) {
    try {
      file1 = fs.readFileSync(file1);
      file2 = fs.readFileSync(file2);
      if (file1.equals(file2)) return true;
    }
    catch (e) {
      return false;
    }

    return false;
  }
}

/**
  * This is simply to force the packet standards.  Use upgrade() to convert a
  * basic packet received from IPC into a complex packet.  Once upgraded, we
  * can use all of the fancy functions listed below.  When we are ready to send
  * off again, we must downgrade the packet.  To check if simple or complex, use
  * the isSimple() function.
  */
Helpers.Packet = {
  new(args={}) {
    let returnCode = Date.now();
    if (args.returnCode === false) { returnCode = null; }

    // let packet = {
    //   sender:     args.sender   || '',
    //   receiver:   args.receiver || '',
    //   apiCall:    args.apiCall  || '',
    //   returnCode: returnCode,
    //   args:       args.args     || {},
    //   data:       { status: true, result: 0, errorMessage: false } 
    // };

    return {
      sender:       args.sender       || '',
      receiver:     args.receiver     || '',
      apiCall:      args.apiCall      || '',
      returnCode:   returnCode,
      args:         args.args         || {},
      status:       args.status       || true,
      result:       args.result       || 0,
      errorMessage: args.errorMessage || false
    };
  },

  /**
  * A simple return for libraries inside nodes to be able to return to a packet
  * easily.
  *
  * Default is:
  *   {
  *     status: true,
  *     result: null
  *   }
  */
  newMini(args={}) {
    return {
      status: args.status || true,
      result: args.result || null
    };
  },

  /**
  * An easy way to merge packets and miniPackets.
  */
  mergeMini(packet, mini) {
    packet.status = mini.status;
    packet.result = mini.result;
    return packet;
  },

  checkArgs(parent, argsNames, packet) {
    argsNames.forEach(argName => {
      if ( !(argName in packet.args) ) {
        parent.returnError(packet, `${argName} argument not included in packet!`);
        return false;
      }
    });

    return true;
  }
}

module.exports = { Helpers };
