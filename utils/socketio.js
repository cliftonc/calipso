
/**
 * 	NOT YET USED 
 **/		
		
var io = require('socket.io');

exports.version = '0.0.1';
exports.initialise = function(app){

	// socket.io 
	var socket = io.listen(app); 
	socket.on('connection', function(client){ 
	  // new client is here! 
	  console.log("Connection: " . client);
	  client.on('message', function(){ 
		console.log("message");	
	  }); 
	  client.on('disconnect', function(){ 
		console.log("disconnect")
	  }); 
	});
	
};