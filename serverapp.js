require('console-stamp')(console, {
	pattern: 'yyyy-mm-dd HH:MM:ss.l',
	label: false
}); //https://www.npmjs.com/package/console-stamp

var io = require('socket.io'); //version 1.5.0
var server = io.listen(3000);

console.log('***Server is listening on port 3000***');

server.on('connection', function(socket){
	console.log('***A User/AI_User Connected***');

	socket.on('newUser', function(user){
		console.log('***Add New User Event***');
		var worker = require('./worker');
		worker.newUser(user, socket);
	});

	socket.on('login', function(user){
		console.log('***User Login Event***');
		var worker = require('./worker');
		worker.login(user, socket);
	});

	socket.on('update', function(user){
		console.log('***Update User Information Event***');
		var worker = require('./worker');
		worker.update(user, socket);
	});

	socket.on('disconnect', function(){
		console.log('***A User/AI_User Disconnected***');
		var worker = require('./worker');
		worker.userDisconnect(socket);
	});

	socket.on('AILogin', function(aiusername){
		console.log('***AI User Login Event***');
		var worker = require('./worker');
		worker.aiLogin(aiusername, socket);
	});
});
