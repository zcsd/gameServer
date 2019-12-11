var mysql = require('mysql');

var pool = mysql.createPool({
	connectionLimit : 10,
	host : 'mydatabase.clshkb4yrqqj.ap-southeast-1.rds.amazonaws.com',
	user : 'test',
	password : 'test1024',
	database : 'gamedev'
});

var socketmap = {}, users = [];
var aisocketmap = {}, aiusers = [];

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
				console.log('<Online Users>: ', users);
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
			socket.emit('login', userinfo);
			console.log('- User (%s) logged in.', user.username);

			var username = user.username;
			if(!(username in socketmap)) {
				socket.username = username;
				socketmap[username] = socket;
				users.push(username);
				console.log('<Online Users>: ', users);
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
		console.log('<Online Users>: ', users);
	}else if(socket.username in aisocketmap){
		console.log('- AI User (%s) Disconnected.', socket.username);
		delete(aisocketmap[socket.username]);
		aiusers.splice(aiusers.indexOf(socket.username), 1);
		console.log('<Online AI Users>: ', aiusers);
	}
}

exports.aiLogin = function aiLogin(aiusername, socket){
	console.log('- AI User (%s) logged in.', aiusername);
	if(!(aiusername in aisocketmap)){
		socket.username = aiusername;
		aisocketmap[aiusername] = socket;
		aiusers.push(aiusername);
		socket.emit('AILogin', users);
		console.log('<Online AI Users>: ', aiusers);
	}
}
