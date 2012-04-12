/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
    fs = require('fs'),
    rootpath = process.cwd() + '/',
    path = require('path'),
    exec = require('child_process').exec,
    Config = require(rootpath + 'lib/core/Config'),
    defaultConfig = {
      "test":"test",
      "modules": {
        "module":{
          "enabled":true
        }
      }
    };

describe('Configuration', function(){

  before(function(){
    // 
  });

  describe('Core', function(){
    
    it('I can create a new configuration file based on a default one.', function(){

      mkdir(path.join(rootpath,'tmp'), function() {
        fs.writeFileSync(path.join(rootpath,'tmp','default.json'),JSON.stringify(defaultConfig));
        var conf = new Config({env:'development', 'path':path.join(rootpath,'tmp')});
        conf.type.should.equal('file');
        conf.file.should.equal(path.join(rootpath,'tmp','development.json'));
      });

    });

    it('I can store and retrieve configuration values', function(){

      var conf = new Config({env:'development',path:path.join(rootpath,'tmp')});
      conf.init();

      conf.set('test:v1','v1');
      conf.get('test:v1').should.equal('v1');
      conf.set('test:v2','v2');
      conf.get('test:v2').should.equal('v2');

      var test = conf.get('test');
      test.v1.should.equal('v1');
      test.v2.should.equal('v2');

    });

    it('I can use different environments', function(){

      var confDev = new Config({env:'development',path:path.join(rootpath,'tmp')});
      confDev.init();

      var confTest = new Config({env:'test',path:path.join(rootpath,'tmp')});
      confTest.init();

      confDev.set('test:v1','v1');
      confDev.get('test:v1').should.equal('v1');
      confDev.save(function(err) {
          path.existsSync(confDev.file);
      });

      confTest.set('test:v1','v1');
      confTest.get('test:v1').should.equal('v1');
      confTest.save(function(err) {
          path.existsSync(confTest.file);
      });

    });

    it('I can use the setSave shortcut', function(){

      var conf = new Config({path:path.join(rootpath,'tmp')});
      conf.init();

      conf.setSave('test:setsave','Yah!',function(err) {
          var confTest = new Config({path:path.join(rootpath,'tmp')});
          confTest.init();
          confTest.get('test:setsave').should.equal('Yah!');
      });
   
    });

  }); 

  describe('Modules', function(){

    it('I can set and retrieve module configuration', function(){

      var conf = new Config({path:path.join(rootpath,'tmp')});
      conf.init();
      conf.setModuleConfig('module','hello','world');
      var value = conf.getModuleConfig('module','hello');
      value.should.equal('world');

    });

  });

  after(function() {
    fs.unlinkSync(path.join(rootpath,'tmp','default.json'));
    fs.unlinkSync(path.join(rootpath,'tmp','development.json'));
    fs.unlinkSync(path.join(rootpath,'tmp','test.json'));
  })

});

/**
 * Mkdir -p.
 *
 * TODO - these are unix only ...
 *
 * @param {String} path
 * @param {Function} fn
 */

function mkdir(path, fn) {
  exec('mkdir -p ' + path, function(err){
    if (err) throw err;
    fn && fn();
  });
}