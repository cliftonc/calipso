var TestSuite = require('../async_testing').TestSuite;

exports['README examples suite'] = (new TestSuite())
  .setup(function(callback) {
    this.foo = 'bar';
    process.nextTick(function() {
        callback();
      });
  })
  .teardown(function(callback) {
    this.foo = null;

    process.nextTick(function() {
        callback();
      });
  })
  .addTests({
    "simple asynchronous": function(assert, finished) {
      setTimeout(function() {
        assert.ok(true);
        finished();
      },50);
    },
    "simple synchronous": function(assert) {
      assert.ok(true);
    },
    "synchronous foo equal bar": function(assert) {
      assert.equal('bar', this.foo);
    },
    "asynchronous foo equal bar": function(assert, finished, test) {
      process.nextTick(function() {
        assert.equal('bar', test.foo);
        finished();
      });
    },
    "assertions expected (fails)": function(assert) {
      this.numAssertionsExpected = 3;

      assert.ok(true);
      // this test will fail!
    },
    "uncaughtException listener": function(assert, finished, test) {
      test.numAssertionsExpected = 1;
      test.addListener('uncaughtException', function(err) {
          assert.equal('hello', err.message);
          finished();
        });

      throw new Error('hello');
    }
  });

if (module === require.main) {
  require('../async_testing').runSuites(exports);
}
