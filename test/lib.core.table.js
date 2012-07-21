/**
 * Mocha test case for core configuration library
 */
var should = require('should'),
    fs = require('fs'),
    rootpath = process.cwd() + '/',
    path = require('path'),
    calipsoHelper = require('./helpers/calipsoHelper', true),
    calipso = calipsoHelper.calipso,
    jsc = require('jscoverage'),
    require = jsc.require(module), // rewrite require function
    table = require('../lib/core/Table', true);

var table1 = {id:'1',
              cls:'my-table',
              sort:true,
              columns:[{name:'id',label:'ID'},{name:'name',label:'Name'},{name:'data',label:'Data'}],
              data:[{id:'1',name:'Hello',data:'World'},{id:'2',name:'Goodbye',data:'Again'}],
              view:{
                pager:true,
                from:0,
                limit:10,
                total:50,
                url:'/data',
                sort:[{name:'name',dir:'asc'}]
              }
        };


describe('Table', function(){

  before(function(){
    // Nothing
  });

  describe('Core', function(){


    it('I can create a table and render it', function(){

        var req = calipsoHelper.requests.testUser,
            output = table.render(req, table1);

        output.should.match(/my-table/);
        output.should.match(/\/data/);

    });

  });

  after(function() {

  })

});

