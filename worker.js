var mysql = require('mysql');

var pool = mysql.createPool({
	connectionLimit : 10,
	host : 'mydatabase.clshkb4yrqqj.ap-southeast-1.rds.amazonaws.com',
	user : 'test',
	password : 'test1024',
	database : 'gamedev'
});

var socketmap = {}, users = [], busyUsers = [], idleUsers = [];
var aisocketmap = {}, aiusers = [], busyAIUsers = [], idleAIUsers = [];
var matchMap = {}; //dict {aiuser1: gameuser2, aiuser3: gameuser9, ...}

var select_sql = 'SELECT * FROM userinfo WHERE username=?';
var insert_sql = 'INSERT INTO userinfo VALUES (?, ?, ?, NOW(), ?, ?, NOW())';
var update_sql = 'UPDATE userinfo SET coins=?, updatetime=NOW() WHERE id=? AND username=?';

exports.newUser = function newUser(user, socket){
	var values = [];
	var result = {};

	values.push(user.username);
	values.push(user.nickname);
	values.push(user.sex);
	values.push(user.coins);
	values.push(user.whichavatar);

	pool.query({sql:insert_sql, values:values}, function(err, rows, fields){
		if(err){
			console.log('!!!INSERT ERROR!!! - ', err.message);
			socket.emit('newUser', 'failure');
			return;
		}else{
			console.log('- Insert new user (%s) successfully!', user.username);
			socket.emit('newUser', 'success');
			console.log('- User (%s) logged in.', user.username);

			var username = user.username;
			if(!(username in socketmap)) {
				socket.username = username;
				socketmap[username] = socket;
				users.push(username);
				idleUsers.push(username);
				console.log('<Online Users>: ', users);
				console.log('<Idle Users>: ', idleUsers);
				if(aiusers.length != 0){
					for(var i = 0; i < aiusers.length; i++){
						aisocketmap[aiusers[i]].emit('new user joined', username);
					}	
				}	
			}
		}
	});
}

exports.login = function login(user, socket){
	var values = [];
	var result = {};
	var userinfo = {
		username: "",
		nickname: "",
		sex: "",
		timeofbirth: "",
		coins: "",
		whichavatar: "",
		updatetime: ""
	};

	values.push(user.username);

	pool.query({sql:select_sql, values:values}, function(err, rows, fields){
		if(rows.length == 0){ // no same usersame in database
			socket.emit('login', 'new');
		}else if(rows.length == 1){ //one username existed in database
			for(var field of fields){
				var colName = field.name;
				userinfo[colName] = rows[0][field.name];
			}
			//console.log(userinfo);

			var username = user.username;
			if(!(username in socketmap)) {
				socket.emit('login', userinfo);
				console.log('- User (%s) logged in.', username);
				socket.username = username;
				socketmap[username] = socket;
				users.push(username);
				idleUsers.push(username);
				console.log('<Online Users>: ', users);
				console.log('<Idle Users>: ', idleUsers);
				if(aiusers.length != 0){
					for(var i = 0; i < aiusers.length; i++){
						aisocketmap[aiusers[i]].emit('new user joined', username);
					}	
				}
			}else{ //the user existed in socketmap already, only allow one place login.
				socket.emit('login', 'reject');
				console.log('- User (%s) can not login again.', username);
			}	
		}else{ // multiple same username in database
			socket.emit('login', 'multiple');
		}
	});
}

exports.update = function update(user, socket){
	var values = [];
	var result = {};

	values.push(user.coins);
	values.push(user.id);
	values.push(user.username);

	pool.query({sql:update_sql, values:values}, function(err, rows, fields){
		if(err){
			console.log('!!!UPDATE ERROR!!! - ', err.message);
			socket.emit('update', 'failure');
			return;
		}else{
			console.log('- Update user information successfully!');
			socket.emit('update', 'success');
		}
	});
}

exports.userDisconnect = function userDisconnect(socket){
	if(socket.username in socketmap){
		console.log('- User (%s) Disconnected.', socket.username);
		delete(socketmap[socket.username]);
		users.splice(users.indexOf(socket.username), 1);
		
		if(busyUsers.includes(socket.username)){
			var key = Object.keys(matchMap).find(key => matchMap[key] === socket.username);
			busyAIUsers.splice(busyAIUsers.indexOf(key), 1);
			busyUsers.splice(busyUsers.indexOf(socket.username), 1);
			idleAIUsers.push(key);
			delete(matchMap[key]);
		}else{
			idleUsers.splice(idleUsers.indexOf(socket.username), 1);
		}
		
		if(aiusers.length != 0){
			for(var i = 0; i < aiusers.length; i++){
				aisocketmap[aiusers[i]].emit('user left', socket.username);
			}	
		}
		
		console.log('<Online Users>: ', users);
		console.log('<Idle Users>: ', idleUsers);
		console.log('<Busy Users>: ', busyUsers);
		console.log('<Idle AI Users>: ', idleAIUsers);
		console.log('<Busy AI Users>: ', busyAIUsers);
		console.log('<Match Map>: ', matchMap);
	}else if(socket.username in aisocketmap){
		console.log('- AI User (%s) Disconnected.', socket.username);
		delete(aisocketmap[socket.username]);
		aiusers.splice(aiusers.indexOf(socket.username), 1);
		
		if(busyAIUsers.includes(socket.username)){
			busyUsers.splice(busyUsers.indexOf(matchMap[socket.username]), 1);
			busyAIUsers.splice(busyAIUsers.indexOf(socket.username), 1);
			idleUsers.push(matchMap[socket.username]);
			delete(matchMap[socket.username]);
		}else{
			idleAIUsers.splice(idleAIUsers.indexOf(socket.username), 1);
		}
		
		console.log('<Online AI Users>: ', aiusers);
		console.log('<Idle Users>: ', idleUsers);
		console.log('<Busy Users>: ', busyUsers);
		console.log('<Idle AI Users>: ', idleAIUsers);
		console.log('<Busy AI Users>: ', busyAIUsers);
		console.log('<Match Map>: ', matchMap);
	}
}

exports.aiLogin = function aiLogin(aiusername, socket){
	if(!(aiusername in aisocketmap)){
		console.log('- AI User (%s) logged in.', aiusername);
		socket.username = aiusername;
		aisocketmap[aiusername] = socket;
		aiusers.push(aiusername);
		idleAIUsers.push(aiusername);
		socket.emit('AILogin', idleUsers);
		console.log('<Online AI Users>: ', aiusers);
		console.log('<Idle AI Users>: ', idleAIUsers);
	}else{
		console.log('- AI User (%s) can not login again.', aiusername);
		socket.emit('AILogin', 'reject');
	}
}

exports.matchUser = function matchUser(username, socket){
	var aiusername = socket.username;
	console.log('- AI User (%s) will match User (%s)', aiusername, username);
	
	if(idleUsers.includes(username) && idleAIUsers.includes(aiusername)){
		busyAIUsers.push(aiusername);
		busyUsers.push(username);
		idleAIUsers.splice(idleAIUsers.indexOf(aiusername), 1);
		idleUsers.splice(idleUsers.indexOf(username), 1);
		matchMap[aiusername] = username;
		aisocketmap[aiusername].emit('matchUser', 'success');
		console.log('- AI User (%s) has matched User (%s)', aiusername, username);
		console.log('<Match Map>: ', matchMap);
	}else{
		aisocketmap[aiusername].emit('matchUser', 'failure');
		console.log('- AI User (%s) match failed.', aiusername);
	}
}
