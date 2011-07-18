var sys = require('sys'),
    assert = require('assert'),
    events = require('events'),
    fs = require('fs'),
    path = require('path');


var AssertWrapper = exports.AssertWrapper = function(test) {
  var test = this.__test = test;
  var assertion_functions = [
    'ok',
    'equal',
    'notEqual',
    'deepEqual',
    'notDeepEqual',
    'strictEqual',
    'notStrictEqual',
    'throws',
    'doesNotThrow'
    ];

  assertion_functions.forEach(function(func_name) {
    this[func_name] = function() {
        try {
          assert[func_name].apply(null, arguments);
          test.__numAssertions++;
        }
        catch(err) {
          if( err instanceof assert.AssertionError ) {
            test.failed(err);
          }
        }
      }
    }, this);
};

var Test = function(name, func, suite) {
  events.EventEmitter.call(this);

  this.assert = new AssertWrapper(this);
  this.numAssertionsExpected = null;

  this.__name = name;
  this.__phase = 'setup';
  this.__func = func;
  this.__suite = suite;
  this.__finishedCallback = null;
  this.__numAssertions = 0;
  this.__finished = false;
  this.__failure = null;
  this.__symbol = '.';
};
sys.inherits(Test, events.EventEmitter);

Test.prototype.run = function() {
  var self = this;

  try {
    this.__phase = 'test';
    this.__func(this.assert, function() { self.finish(); }, this);
  }
  catch(err) {
    if( this.listeners('uncaughtException').length > 0 ) {
      this.emit('uncaughtException',err);
    }
    else {
      this.failed(err);
    }
  }

  // they didn't ask for the finish function so assume it is synchronous
  if( this.__func.length < 2 ) {
    this.finish();
  }
};
Test.prototype.finish = function() {
  if( !this.__finished ) {
    this.__finished = true;

    if( this.__failure === null && this.numAssertionsExpected !== null ) {
      try {
        var message = this.numAssertionsExpected + (this.numAssertionsExpected == 1 ? ' assertion was ' : ' assertions were ')
                    + 'expected but ' + this.__numAssertions + ' fired';
        assert.equal(this.numAssertionsExpected, this.__numAssertions, message);
      }
      catch(err) {
        this.__failure = err;
        this.__symbol = 'F';
      }
    }

    if( this.__finishedCallback ) {
      this.__finishedCallback(this.__numAssertions);
    }
  }
};
Test.prototype.failureString = function() {
  var output = '';

  if( this.__symbol == 'F' ) {
    output += '  test "' + this.__name + '" failed: \n';
  }
  else {
    output += '  test "' + this.__name + '" threw an error';
    if( this.__phase !== 'test' ) {
      output += ' during ' + this.__phase;
    }
    output += ': \n';
  }

  if( this.__failure.stack ) {
    this.__failure.stack.split("\n").forEach(function(line) {
        output += '  ' + line + '\n';
      });
    
  }
  else {
    output += '  '+this.__failure;
  }

  return output;
};
Test.prototype.failed = function(err) {
  this.__failure = err;
  if( err instanceof assert.AssertionError ) {
    this.__symbol = 'F';
  }
  else {
    this.__symbol = 'E';
  }

  if( !this.__finished ) {
    this.finish();
  }
};

var TestSuite = exports.TestSuite = function(name) {
  this.name = name;
  this.wait = true;
  this.tests = [];
  this.numAssertions = 0;
  this.numFinishedTests = 0;
  this.numFailedTests = 0;
  this.finished = false;
  this.callback = null;

  this._setup = null;
  this._teardown = null;

  var suite = this;
  process.addListener('exit', function() {
      if( !suite.wait ) {
        suite.finish();
      }
    });

  // I'm having trouble doing instance of tests to see if something
  // is a test suite, so i'll add a property nothing is likely to have
  this.nodeAsyncTesting = 42;
};
TestSuite.prototype.finish = function() {
  if( this.finished ) {
    return;
  }

  this.finished = true;

  var failures = [];
  this.tests.forEach(function(t) {
      if( !t.__finished ) {
        t.finish();
      }
      if( t.__failure !== null ) {
        this.numFailedTests++;
        failures.push(t);
      }
    },this);


  output = '\n';
  output += this.tests.length + ' test' + (this.tests.length == 1 ? '' : 's') + '; ';
  output += failures.length + ' failure' + (failures.length == 1 ? '' : 's') + '; ';
  output += this.numAssertions + ' assertion' + (this.numAssertions == 1 ? '' : 's') + ' ';
  sys.error(output);

  sys.error('');
  failures.forEach(function(t) {
      sys.error(t.failureString());
    });

  if( this.callback ) {
    this.callback();
  }
};

TestSuite.prototype.setup = function(func) {
  this._setup = func;
  return this;
};
TestSuite.prototype.teardown = function(func) {
  this._teardown = func;
  return this;
};
TestSuite.prototype.waitForTests = function(yesOrNo) {
  if(typeof yesOrNo == 'undefined') {
    yesOrNo = true;
  }
  this.wait = yesOrNo;
  return this;
};
TestSuite.prototype.addTests = function(tests) {
  for( var testName in tests ) {
    var t = new Test(testName, tests[testName], this);
    this.tests.push(t);
  };

  return this;
};
TestSuite.prototype.runTests = function(callback) {
  if( callback ) {
    this.callback = callback;
  }
  sys.error('Running "' + this.name + '"');
  this.runTest(0);
};
TestSuite.prototype.runTest = function(testIndex) {
  if( testIndex >= this.tests.length ) {
    return;
  }

  var t = this.tests[testIndex];
  t.__finishedCallback = finishedCallback;
  var suite = this;

  var wait = suite.wait;

  if(wait) {
    // if we are waiting then let's assume we are only running one test at 
    // a time, so we can catch all errors
    var errorListener = function(err) {
      if( t.listeners('uncaughtException').length > 0 ) {
        t.emit('uncaughtException',err);
      }
      else {
        t.failed(err);
      }
    };
    process.addListener('uncaughtException', errorListener);

    var exitListener = function() {
      sys.error("\n\nOoops! The process exited in the middle of the test '" + t.__name + "'\nDid you forget to finish it?\n");
    };
    process.addListener('exit', exitListener);
  }
  else {
    sys.error('  Starting test "' + this.__name + '"');
  }

  try {
    if(this._setup) {
      if( this._setup.length == 0 ) {
        this._setup.call(t);
        afterSetup();
      }
      else {
        this._setup.call(t, afterSetup, t);
      }
    }
    else {
      afterSetup();
    }
  }
  catch(err) {
    t.failed(err);
  }

  function afterSetup() {
    t.run();

    if( !wait ) {
      suite.runTest(testIndex+1);
    }
  }

  function finishedCallback(numAssertions) {
    var teardownCallback = function() {
      suite.numAssertions += numAssertions;
      suite.numFinishedTests++;

      if( wait ) {
        process.binding('stdio').writeError(t.__symbol);
        process.removeListener('uncaughtException', errorListener);
        process.removeListener('exit', exitListener);
        suite.runTest(testIndex+1);
      }

      if( suite.numFinishedTests == suite.tests.length ) {
        suite.finish();
      }
    }

    try {
      if(suite._teardown) {
        t.__phase = 'teardown';
        if( suite._teardown.length == 0 ) {
          suite._teardown.call(t);
          teardownCallback();
        }
        else {
          suite._teardown.call(t, teardownCallback, t);
        }
      }
      else {
        teardownCallback();
      }
    }
    catch(err) {
      t.failed(err);
      teardownCallback();
    }
  }
};

exports.runSuites = function(module, callback) {
  var suites = [];

  for( var suiteName in module ) {
    var suite = module[suiteName];

    if(suite && suite.nodeAsyncTesting == 42) {
      suite.name = suiteName;
      suites.push(suite);
    }
  }

  var stats = {
    numSuites: 0,
    numFailed: 0
  };

  function runNextSuite() {
    if( suites.length < 1 ) {
      return callback ? callback(stats) : null;
    }
    var suite = suites.shift();
    suite.runTests(function() {
        if( suites.length > 0 ) {
          sys.error('----------------------------------\n');
        }
        stats.numSuites++;
        if( suite.numFailedTests > 0 ) {
          stats.numFailed++;
        }
        runNextSuite();
      });
  }

  sys.error('');
  runNextSuite();
};

exports.runSuitesInPaths = function(paths) {
  var testFiles = [];
  var stats = {
    numSuites: 0,
    numFailed: 0
  };

  loadNextPath();

  function loadNextPath() {
    if( paths.length == 0 ) {
      return runNextFile();
    }

    var cur_path = paths.shift();

    fs.readdir(cur_path, function (error, dir) {
        if(error) {
          throw error;
        }
        dir.forEach(function(file_name) {
            if( file_name.charAt(0) == '.' ) {
              // ignore 'hidden' files and folders
              return;
            }
            var stat = fs.statSync(path.join(cur_path, file_name));
            if( stat.isFile() ) {
              if( !file_name.match(/^test-.*\.js$/) ) {
                return;
              }
              testFiles.push(path.join(cur_path, file_name));
            }
            else if( stat.isDirectory() ) {
              paths.push(path.join(cur_path, file_name));
            }
          });
        loadNextPath();
      });
  }

  function runNextFile(sts) {
    if( sts ) {
      stats.numSuites += sts.numSuites;
      stats.numFailed += sts.numFailed;
      sys.error('----------------------------------');
    }

    if( testFiles.length < 1 ) {
      var output = '\n' + (stats.numSuites == 1 ? '1 suite' : stats.numSuites+' suites') + ' ran';
      if( stats.numFailed > 0 ) {
        output += ': ' + stats.numFailed + ' had failures';
      }
      sys.error(output);
      return;
    }
    var file = testFiles.shift();
    file = file.substr(0, file.length-3);
    var suites = require(file);

    exports.runSuites(suites, runNextFile);
  }
};

