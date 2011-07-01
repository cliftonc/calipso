/**
 *  Sanity test
 *  Test must be executed serially as it runs
 *  against an app instance, this is typically executed by the make file
 **/
require.paths.unshift(__dirname + "/../"); //make local application paths accessible
 
var assert = require('assert'),
    sys = require('sys'),
    should = require('should'),
    table = require('lib/Table');

 // Stub request and translate 
var req = {t:function(st) { return st },url:'/'};
      
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
                sort:[{name:'name',dir:'asc'}]
              }
        };
/**
 * Tests
 */
exports['I can create a table'] = function() {
    
  
  var tb = table.CalipsoTable;
  
  var output = tb.render(table1,req);
  
  console.log(output);
    
  true.should.equal(true);
  
};

