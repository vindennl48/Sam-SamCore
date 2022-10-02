// Been running into issues where I have some functions returning differently
// than others.  This is a problem.  We need some standards.


// Standard packet format.
//   Anytime a packet is transferred, we MUST send the
//   entire packet and not just the packet.data. This helps with trying to figure
//   out what exactly is getting returned to a function later down the road.
//   status: If false, this means an error occured. If there is no error, this
//           returns as true.
     {
       sender:       {string},
       receiver:     {string},
       apiCall:      {string},
       returnCode:   {int},
       // This is the original data from api call.  Used in debugging.
       bdata:        {object},
       // Return data from api. MUST be returned as an object.
       data:         {object},
         status:       {bool},
         // If status is false, this must exist.
         errorMessage: {string},
     }

// Function Returns
//   Any returns will need to return an object with the following:
     {
       // If result is true, errorMessage isnt used.
       status:       {boolean},
       // If above returns false, this is required
       errorMessage: {string},
       // Any other type of return can either be as 'result' or any other
       // arguments required for the return.
       result:       {any},
       ...
     }

// Function arguments
//   Any function arguments are required to be checked for authenticity before
//   being used.  If an argument doesn't exist, it must return false with an
//   error message. This includes packets.
//
//   If a function is accepting a packet as an argument, it must be in the
//   standardized packet format stated above. It also must be used with the name
//   'packet'.

// Javascript Notes
// - Testing if a variable is a specific type
      if (typeof args !== 'object')  {}
      if (Array.isArray(path)) {}
      if (typeof args !== 'string')  {}
      if (typeof args !== 'boolean') {}
      if (typeof args !== 'number')  {}
// - Array manipulation
      let path      = parentPathArray.join('.');      // joins array to string
      let pathArray = parentPath.split('.');          // creates array from splitting
      let pathArray = parentPathArray.slice(0, -1);   // removes last element
      let pathArray = parentPathArray.unshift('new'); // adds to front of array
      let pathArray = parentPathArray.push('new');    // adds to back of array
