require('console-stamp')(console, {
	pattern: 'yyyy-mm-dd HH:MM:ss.l',
	label: false
}); //https://www.npmjs.com/package/console-stamp

var worker = require('./worker');

// create socket.io server, listening on port 3000
// communicate with game client
var SocketIO = require('socket.io'); //version 2.3.0
var ioServer = SocketIO.listen(3000);
console.log('***Game socket.io server is listening on port 3000***');

// create websocket server, listening on port 50000
// communicate with TmallGenie CC mini-program
var WebSocket = require('ws');
var wsServer = new WebSocket.Server({ port: 50000 });
console.log('***TmallGenie websocket server is listening on port 50000***');

wsServer.on('connection', function connection(websocket) {
  console.log('***TmallGenie Connect Event***');
  worker.tmallgenieConnect(websocket);
  
  websocket.on('close', function onclose(event) {
	console.log('***TmallGenie Disconnect Event***');
	worker.tmallgenieDisconnect(websocket);
  });
  
  websocket.on('message', function incoming(message) {
	console.log('***TmallGenie Message Event***');
	worker.readMsgFromTG(message);
  });
});

ioServer.on('connection', function(iosocket){
	console.log('***A Game_User Connected***');

	iosocket.on('newUser', function(user){
		console.log('***Add New User Event***');
		worker.newUser(user, iosocket);
	});
	
	iosocket.on('login', function(user){
		console.log('***User Login Event***');
		worker.login(user, iosocket);
	});
	
	iosocket.on('updateCoins', function(user){
		console.log('***Update User Coins Event***');
		worker.updateCoins(user, iosocket);
	});
	
	iosocket.on('newAction', function(msg){
		console.log('***Insert User Game Action Event***');
		worker.newAction(msg, iosocket);
	});
	
	iosocket.on('disconnect', function(){
		console.log('***A Game_User Disconnected***');
		worker.userDisconnect(iosocket);
	});
	
});
