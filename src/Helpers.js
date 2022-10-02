
let Helpers = {
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

module.exports = { Helpers };
