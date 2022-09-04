# Sam-SamCore

## What is Sam?

'Sam' is the entire network that revolves around and includes the SamCore.  At its most basic usage, it stores and categorizes song projects, jams, and live performances in a central location that is accessible for anyone who is given access.

## What is Sam-Core?

This is the central ‘node’ or hub that allows all of the other nodes in the Sam network to connect together.  For example, Reaper could have a plugin that will interact with SamCore to save audio stems to Google Drive.  SamCore will talk to Google Drive ‘node’ and ask it to upload to the appropriate location.  It will also converse with the database ‘node’ to make sure all of the information about the audio stems are updated.  This concept will allow easy scale up as more ‘nodes’ are added to Sam.  This will also allow us to easily change off of older ‘nodes’ in lieu of newer ones, or have multiple of the same ‘node’ running in tandem.  A good example would be if we start using Google Drive to host audio files and then switch to AWS or a home server setup, we can ease the transition between the two nodes by having both up at the same time while we transition.  OR we could use one as a cold storage and one as a current storage option.  Possibilities open up dramatically with this setup.

<br><br>

# How it All Comes Together

IPC or inter-process communication.  It is a communication protocol that allows programs to talk to each other; Whether it be on the same machine and/or over the internet.  Utilizing this protocol, we can create mini-programs or 'Nodes' that can communicate and get things done.  This provides us with numerous benefits, to include:
  - Each node can be written in a different programming language.
    - SamCore could be written in Rust, the Google Drive node could be in javascript, the AI bot that auto-chops up jam tracks can be in C++, the website back-end can be in ruby, Reaper can have an extension written in lua... All of this can tie together.
    - By using things like 'pkg' and 'electron', we can compile javascript/react code into executables that are easily shipped and can run on any OS. Just like Discord or Slack.
    - Rust or C++ has the same possibilities.
  - Easily add new nodes to the network without disturbing what has already been written.
    - If we want long-term storage on-top of having files on Google Drive, we can build two nodes, one for each storage option.  Want to run a development node at home while the rest of the band runs the older production version?  Done.  Want a node just for you to integrate with some personal computer setup? Easy.  Does one developer want to try out what someone else is using?  No worries, just download the node and away you go!
  - Allows for the ability of a package-management system that can keep track of nodes and node versions.
    - If we have 3 nodes built for the same task, but they all approach it in a slightly different way?  No worries.  Bob can use node A while Sally uses node B.  Just install/uninstall the node from the package management system.
    - Is there a new update for the database node?  No worries, the package manager will install it and make sure all other nodes are up-to-date.  Do you need to roll back to a previous node version because something is breaking?  No problem!  Start up SamCore without all of the other nodes and roll the broken node back.
  - Nodes can be hosted online
    - We can have a website as a node.  Every time an upload occurs, we can have a hook integrate with the website and auto-publish our latest jams/recordings.
    - Have a node for Discord that can 'hook' into other node communications so it does not have to explicitly be called in other nodes.
  - Just to name a few..

<br><br>

## Setting it Up

- To start, lets first create a main project folder for all of Sam's nodes. Make sure to go into the new directory.

  `$ mkdir Sam; cd Sam`

- Next, we will need to pull this repo down.  Make sure to use lowercase letters.  React no longer likes capital letters in project names.  Lets go into this directory as well.

  `$ git clone git@github.com:vindennl48/Sam-SamCore samcore; cd samcore`

- Next, we will need to install the node dependencies.

  `$ npm ci`

  **OR**

  `$ yarn install --frozen-lockfile`

- After that, you should just be able to run

  `$ node .`

  and SamCore will boot right up.  Note, you will not see any output until another node interacts with it.

- To see some interaction, back out of this directory and clone in the `Console` node to try some things out.

  ```
  $ cd ..
  $ git clone git@github.com:vindennl48/Sam-Console console
  $ cd console
  $ npm ci OR yarn install --frozen-lockfile
  $ node . --node samcore -m "HELLO WORLD!"
  ```

  You should see some interaction between SamCore and Console!

  *Hint: if you run '`node . -h`' you can see more options for Console.

<br><br>

# JS Client/Server Libraries

There are 3 libraries built for JS that live inside the SamCore repo.  These libraries attempt to take out all of the tedious setup with IPC and make things streamlined.

<br>

## Helpers.js

This library is small right now, however, as it grows, it will be a staple in working with Node development.

At the momment, there are only two functions in this library.
  - `log({args..}, message)`

    This function currently prints to the terminal and provides some neat formatting to boot.

    `Helpers.log({leader: 'arrow', loud: true}, 'Hello World!:', dataObject);`

    Result:

    `----> Hello World!: { nodeName: 'TestNode', data: true }`

    Using this from the get-go will allow easier transition into writing to log-files and provided added log functionality without needing to re-write the entire code-base.

  - `defaultPackage({args..})`

    This function helps with adding new nodes to the network.  All of the nodes that are installed on the network live inside a `SamCoreSettings.json` file in the run directory.  This will be created upon first-boot-up.  `defaultPackage` will provide a boilerplate of settings and flags assigned to each node as they enter the network.

    More detailed descripton of each setting and flag are provided in the code.

<br><br>

## Client.js

This is probably the most important library of all 3.  This will be the library incorporated into all JS nodes (if desired).

Let's take a look at the intended use of this library before digging into the internals.
```
const { Client } = require('../../samcore/src/Client.js');

let myNode = new Client('testclient', 'samcore');

myNode
  .addApiCall('helloWorld', function(packet) {
    packet.data = 'HELLO WORLD! ' + packet.data;
    this.return(packet);
  })
  .addApiCall('return', function(packet) {
    if (this.receive('samcore', 'butter', packet)) {
      console.log('Result: ', packet.data);
    }
    else if (this.receive('testclient', 'helloWorld', packet)) {
      console.log('Result: ', packet.data);
    }
  })
  .run(function() {
    // Main Function. Called after connection is established
    this.call('samcore', 'butter', 'Butter the bread...');
  });

// Code located in the Client.js file under -> samcore/src/Client.js
```

We are creating a new `myNode` object from the `Client` class, adding 2 API calls to it, starting up the IPC connection to the SamCore server, and then providing a run function to execute.

To make a call to another node, you will use the command:

`this.call(<receiving node name>, <api call>, <any data that is required>);`

Example:

`this.call('samcore', 'withButter', 'Peanut butter and Jelly');`

To be able to receive the answer to this API request, we must provide an api call of our own.

```
.addApiCall('return', function(packet) {
  if ( this.receive('samcore', 'withButter', packet) ) {
    Helpers.log({leader: 'arrow', loud: true}, 'Result:', packet.data);
  }

  if ( this.receive('gdrive', 'uploadFile', packet) ) {
    if (!packet.complete) {
      Helpers.log({leader: 'sub', loud: true}, 'Status:', packet.data);
    } else {
      Helpers.log({leader: 'sub', loud: true}, 'Complete!');
    }
  }
})`
```

`----> Result: Peanut butter and Jelly...with butter!`

This is a good place to say that this 'return' API call is where you will receive your answers back from your API calls to other nodes.

<br><br>

## Server.js

This library is for SamCore operations.

```
const { Server } = require('./Server.js');

let SamCore = new Server('samcore');

SamCore
  .addApiCall('withButter', function(packet, socket) {
    packet.data = packet.data + '...with butter!';
    this.return(packet);
  })
  .run();

// Code located in the Server.js file under -> samcore/src/Server.js
```

This will make things much easier writing code for the SamCore moving into the future.

Note: There is a possibility that all non-gui interfaces may switch over to Rust at some point...

<br><br>

# Additional Notes

  - If you would like to take a deeper dive into some of the built-in functions to these libraries, the code has some great documentation to go through.
  - If you would like more information on how the IPC system works, take a look at [github node-ipc](https://github.com/RIAEvangelist/node-ipc).


