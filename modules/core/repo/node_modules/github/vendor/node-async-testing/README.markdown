node-async-testing
==================

A simple test runner with testing asynchronous code in mind.

Some goals of the project:

+ Simple and intuitive.  You create a test and then run the code you want to
  test and make assertions as you go along.  Tests should be functions.
+ Use the assertion module that comes with Node. If you are 
  familiar with it you won't have any problems.  You shouldn't have to learn
  new assertion functions.  
+ Test files to be executable by Node.  No preprocessors.  If your test file is
  called "my_test_file.js" then "node my_test_file.js" should run the tests.
+ Address the issue of testing asynchronouse code.  Node is asynchronous, so
  testing should be too.
+ Not another Behavior Driven Development testing framework. I don't
  like specifications and what not. They only add verbosity. 
  
    test('X does Y',function() {
      //test goes here
    });

  is good enough for me.
+ Make no assumptions about the code being tested.

Feedback/suggestions encouraged!

Writing Tests
-------------

The hard part of writing a test suite for asynchronous code is that when a test
fails, you don't know which test it was that failed. Errors won't get caught by
`try`/`catch` statements.

This module aims to address that by making sure

1. First, it gives each test its own unique assert object. That way you know
   which assertions correspond to which tests.
2. Second, the tests get ran one at a time.  That way, it is possible to add a
   global exceptionHandler for the process and catch the tests whenever
   they happen.

   To only run one test at a time, asynchronous tests receive a `finished()`
   function as an argument.  They must call this function when they are done.
   The next test won't be run until this function is called.

Tests are added to a TestSuite object.
    
    var TestSuite = require('async_testing').TestSuite;

    var suite = new TestSuite();
    suite.addTests({
        "simple asynchronous": function(assert, finished) {
          setTimeout(function() {
            assert.ok(true);
            finished();
          });
        }
      });

If your test isn't asynchronous, you don't have to use the finished callback.
If you don't list the finished callback in the parameters of the test, 
node-async-testing will assume the test is synchronous.

    var suite = new TestSuite();
    suite.addTests({
        "simple synchronous": function(assert) {
          assert.ok(true);
        }
      });

You can add a setup function that is ran once at the beginning of each test.
You can do a teardown function, as well:

    var suite = new TestSuite();
    suite.setup(function() {
      this.foo = 'bar';
    });
    suite.teardown(function() {
      this.foo = null;
    });
    suite.addTests({
      "synchronous foo equals bar": function(assert) {
        assert.equal('bar', this.foo);
      }
    });

If you need to access the variables created in the setup function asynchronously
your tests receive a third argument which has this information:

    var suite = new TestSuite();
    suite.setup(function() {
      this.foo = 'bar';
    });
    suite.teardown(function() {
      this.foo = null;
    });
    suite.addTests({
      "asynchronous foo equals bar": function(assert, finished, test) {
        process.nextTick(function() {
          assert.equal('bar', test.foo);
          finished();
        });
      }
    });

If you want to be explicit about the number of assertions run in a given test,
you can set `numAssertionsExpected` on the test. This can be helpful in
asynchronous tests where you want to be sure all callbacks get fired.

    var suite = new TestSuite();
    suite.addTests({
        "assertions expected (fails)": function(assert) {
          this.numAssertionsExpected = 3;

          assert.ok(true);
          // this test will fail!
        }
      });

If you need to make assertions about what kind of errors are thrown, you can listen
for the uncaughtException event on the test:

    var suite = new TestSuite();
    suite.addTests({
        "uncaughtException listener": function(assert, finished, test) {
          test.numAssertionsExpected = 1;
          test.addListener('uncaughtException', function(err) {
              assert.equal('hello', err.message);
              finished();
            });

          throw new Error('hello');
        }
      });

All the functions to a TestSuite can be chained to cut down on verbosity:

    (new TestSuite())
      .setup(function() {
        this.foo = 'bar';
      })
      .teardown(function() {
        this.foo = null;
      })
      .addTests({
        "foo equal bar": function(assert) {
          assert.equal('bar', foo);
        }
      });

Running test suites
-------------------

To run a test suite, you call `runTests()` on it.

    var suite = new TestSuite();
    suite.addTests({
        "simple": function(assert) {
          assert.ok(true);
        }
      });
    suite.runTests();

There is also a test runner which can run many TestSuites at once:

    var suites = {
      'first suite':  new TestSuite(),
      'second suite':  new TestSuite()
    };

    require('async_testing').runSuites(suites);

It is recommended that you export your test suites, so other more capable
scripts can handle running them. However, it is still convenient to be able to
run a specific file.  Here's how you can allow both:

    exports['first suite'] = new TestSuite();
    exports['second suite'] = new TestSuite();

    if (module === require.main) {
      require('../async_testing').runSuites(exports);
    }

This way the tests will only be run automatically if the file containing them is
the script being ran.

node-async-testing also comes with a script that will run all test files in a 
specified directory. A test file is one that matches this regular expression:
`/^test-.*\.js$/`. To use the script make sure node-async-testing has been 
installed properly and then run:

    node-async-test testsDir

Installing
----------

To install, the file `async_testing.js` needs to be in your Node path.  The
easiest place to put it is in `~/.node_libraries`.

Notes
-----

+ If you don't care about being able to count the number of assertions in a given
  test, you can use any assertion library you'd like.
