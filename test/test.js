
/**
 * Module dependencies.
 */

var nedis = require('../')
  , net = require('net')
  , fs = require('fs')
  , port = 8888;

/**
 * Server.
 */

var server = nedis.createServer();
server.on('listening', function startTest () {

  /**
   * Client.
   */

  var client = net.createConnection(port);

  /**
   * Monkey-patch .once()/
   *
   * @param {String} event
   * @param {String} fn
   */

  client.once = function(event, fn){
    client.on(event, function callback(chunk){
      client.removeListener(event, callback);
      fn(chunk);
    });
  };

  /**
   * Timeout support.
   */

  client.setEncoding('utf8');
  client.setTimeout(1000);
  client.on('timeout', function(){
    console.error('timed out');
    process.exit(1);
  });

  /**
   * Test cases.
   */

  var files = fs.readdirSync(__dirname + '/cases').filter(function(file){
    return !~file.indexOf('.out');
  });

  /**
   * Pending tests.
   */

  var pending = files.length;

  /**
   * Normalize `str`.
   *
   * @return {String}
   */

  function normalize(str) {
    return str
      .replace(/^\-+\n/gm, '')
      .replace(/\n/g, '\r\n');
  }

  /**
   * Expose hidden chars in `str`.
   *
   * @param {String} str
   * @return {String}
   */

  function expose(str) {
    return str
      .replace(/\r\n/g, '\\r\\n\n')
      .replace(/^/gm, '  ');
  }

  /**
   * Run tests.
   */

  client.on('connect', function(){
    (function next(){
      file = files.shift();
      process.stdout.write('\033[90m...\033[0m \033[33m' + file + '\033[0m ');

      // Read test case
      var input
        , expected
        , path = __dirname + '/cases/' + file;

      // input
      fs.readFile(path, 'utf8', function(err, str){
        input = normalize(str);
        input && expected && test();
      });

      // output
      fs.readFile(path + '.out', 'utf8', function(err, str){
        expected = '+OK\r\n' + normalize(str);
        input && expected && test();
      });

      function test(){
        var start = new Date;
        client.write('*1\r\n$7\r\nFLUSHDB\r\n');
        client.write(input);
        client.once('data', function(reply){
          // TODO: fram to prevent race-condition

          // All good
          if (expected == reply) {
            console.error('\033[32m%dms\033[0m', new Date - start);
            --pending || process.exit(0);
          // Not so good  
          } else {
            console.error('\n');
            console.error('  \033[31m%s:\033[0m ', 'expected');
            console.error(expose(expected));
            console.error('  \033[31m%s:\033[0m ', 'got');
            console.error(expose(reply));
            process.exit(1);
          }

          // TATFT
          next();
        });
      }
    })();
  });
});
server.listen(port);
