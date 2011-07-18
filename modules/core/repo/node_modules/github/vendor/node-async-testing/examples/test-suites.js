var sys = require('sys');
var TestSuite = require('../async_testing').TestSuite;

exports['First Suite'] = new TestSuite()
  .addTests({
    "this does something": function(assert) {
        assert.ok(true);
      },
    "this doesn't fail": function(assert, finished) {
        assert.ok(true);
        setTimeout(function() {
            assert.ok(true);
            finished();
          }, 300);
      },
    "this does something else": function(assert) {
        assert.ok(true);
        assert.ok(true);
      },
  });

exports['Second Suite'] = new TestSuite()
  .addTests({
    "this does something": function(assert) {
        assert.ok(true);
      },
    "this fails": function(assert, finished) {
        setTimeout(function() {
            assert.ok(false);
            finished();
          }, 300);
      },
    "this does something else": function(assert) {
        assert.ok(true);
        assert.ok(true);
      },
    "this errors": function() {
        throw new Error();
      },
    "this errors asynchronously": function(assert, finished) {
        process.nextTick(function() {
          throw new Error();
          finished();
        });
      },
    "more": function(assert) {
        assert.ok(true);
      },
    "throws": function(assert) {
        assert.throws(function() {
            throw new Error();
          });
      },
    "expected assertions": function(assert) {
        this.numAssertionsExpected = 1;
        assert.throws(function() {
            throw new Error();
          });
      },
  });

exports['Setup Suite'] = (new TestSuite())
  .setup(function() {
    this.foo = 'bar';
  })
  .addTests({
    "foo equals bar": function(assert, finished, test) {
      assert.equal('bar', this.foo);
      assert.equal('bar', test.foo);
      finished();
    }
  });

var count = 0;
exports['Wait Suite'] = new TestSuite();
exports['Wait Suite'].addTests({
    "count equal 0": function(assert, finished) {
      assert.equal(0, count);
      setTimeout(function() {
        count++;
        finished();
        }, 300);
    },
    "count equal 1": function(assert) {
      assert.equal(1, count);
    }
  });

if (module === require.main) {
  require('../async_testing').runSuites(exports);
}
