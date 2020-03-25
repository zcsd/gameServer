var mysql = require('mysql');
var request = require('request');

const httpURL = 'http://54.255.208.140:8000'

var pool = mysql.createPool({
	connectionLimit : 10,
	host : 'mydatabase.clshkb4yrqqj.ap-southeast-1.rds.amazonaws.com',
	user : 'test',
	password : 'test1024',
	database : 'gamedev'
});

var socketmap = {}, users = [];
var websocket;
var isWSConnected = false;

var select_sql = 'SELECT * FROM userinfo WHERE username=?';
var insert_sql = 'INSERT INTO userinfo VALUES (?, ?, ?, NOW(), ?, ?, NOW(), NOW())';
var update_sql = 'UPDATE userinfo SET coins=?, updatetime=NOW() WHERE username=?';
var lastLoginTime_sql = 'UPDATE userinfo SET lastLoginTime=NOW() WHERE username=?';
var insert_action_sql = 'INSERT INTO activity VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)';
var update_hint_sql = 'UPDATE activity SET hint=? WHERE username=? AND sequenceID=?';

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
			console.log('!!!INSERT USER ERROR!!! - ', err.message);
			socket.emit('newUser', 'failure');
			return;
		}else{
			console.log('- Insert new user (%s) successfully!', user.username);
			socket.emit('newUser', 'success'); // send success signal to game client
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
		updatetime: "",
		lastLoginTime: "",
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
				socket.emit('login', userinfo); //send history userinformation to game client
				//update LoginTime
				pool.query({sql:lastLoginTime_sql, values:username}, function(err, rows, fields){
					if(err){
						console.log("- Fail to Update lastLoginTime.");
					}else{
						console.log("- Update lastLoginTime Successfully.");
					}			
				});
				
				console.log('- User (%s) logged in.', username);
				socket.username = username;
				socketmap[username] = socket;
				users.push(username);
				console.log('<Online Users>: ', users);
			}else{ //the user existed in socketmap already, only allow one place login.
				socket.emit('login', 'reject');
				console.log('- User (%s) can not login again.', username);
			}	
		}else{ // multiple same username in database
			socket.emit('login', 'multiple');
		}
	});
}

exports.newAction = function newAction(msg, socket){
	//username, sequenceID, time, stage, actionType, operatedItem, rewardType, rewardQty, totalCoins
	var values = [];
	values.push(msg.username);
	values.push(msg.sequenceID);
	values.push(msg.stage);
	values.push(msg.actionType);
	values.push(msg.operatedItem);
	values.push(msg.rewardType);
	values.push(msg.rewardQty);
	values.push(msg.totalCoins);
	values.push(msg.itemsState);
	values.push('')
	
	//send http request
	if(msg.actionType == 'buy' || msg.actionType == 'takeback' || (msg.actionType == 'use')){
		getHint(msg);
	}else if(msg.actionType == 'init' && isWSConnected == true){
		var str1 = "欢迎来到";
		var str2;
		if(msg.stage == 'diffusion') 
			str2 = "扩散实验室";
		else if(msg.stage == 'osmosis')
			str2 = "渗透实验室";
		
		websocket.send(str1.concat(str2)); // send weclome msg to TG
	}
	
	pool.query({sql:insert_action_sql, values:values}, function(err, rows, fields){
		if(err){
			console.log('!!!INSERT Action ERROR!!! - ', err.message);
			return;
		}else{
			console.log('- Insert Action successfully!');
		}
	});
}

exports.updateCoins = function update(user, socket){
	var values = [];
	var result = {};

	values.push(user.coins);
	values.push(user.username);

	pool.query({sql:update_sql, values:values}, function(err, rows, fields){
		if(err){
			console.log('!!!UPDATE Coins ERROR!!! - ', err.message);
			socket.emit('updateCoins', 'failure');
			return;
		}else{
			console.log('- Update user coins successfully!');
			socket.emit('updateCoins', 'success');
		}
	});
}

exports.userDisconnect = function userDisconnect(socket){
	if(socket.username in socketmap){
		console.log('- Game User (%s) Disconnected.', socket.username);
		delete(socketmap[socket.username]);
		users.splice(users.indexOf(socket.username), 1);
		console.log('<Online Game Users>: ', users);
	}
}

exports.tmallgenieConnect = function tmallgenieConnect(socket){
	if(isWSConnected == false){
		console.log('- A TmallGenie Client Connected.');
		websocket = socket;
		isWSConnected = true;
	}else{
		console.log('!!!ERROR, TmallGenie already Connected!!!')
	}
}

exports.tmallgenieDisconnect = function tmallgenieDisconnect(socket){
	if(isWSConnected == true){
		console.log('- A TmallGenie Client Disconnected.');
		websocket = null;
		isWSConnected = false;
	}else{
		console.log('!!!ERROR, TmallGenie already Disconnected!!!')
	}
}

exports.readMsgFromTG = function readMsgFromTG(message){
	console.log('- Msg Received from TG: ', message)
	if(message == 'colder'){
		socketmap[users[0]].emit('command', 'colder');
	}else if(message == 'hotter'){
		socketmap[users[0]].emit('command', 'hotter');
	}
}

function sendHint(msgReceived){
	socketmap[msgReceived.username].emit(msgReceived.stage, msgReceived.hint);
	
	console.log('- Sent a Hint to Game Client ', msgReceived.username)
	if(isWSConnected){
		websocket.send(msgReceived.hint);
		console.log('- Sent a Hint to TmallGenie CC.')
	}
	
	var values = [];
	values.push(msgReceived.hint);
	values.push(msgReceived.username);
	values.push(msgReceived.sequenceID);
	// insert received hint to db
	pool.query({sql:update_hint_sql, values:values}, function(err, rows, fields){
		if(err){
			console.log('!!!UPDATE hints ERROR!!! - ', err.message);
			return;
		}
	});
}

function getHint(msg){
	var msgToSend = {username: msg.username, sequenceID: msg.sequenceID, stage: msg.stage, itemsState: msg.itemsState};
	var options = {
		url: httpURL,
		method: "GET",
		json: true,
		headers: {"content-type": "application/json",},
		body: JSON.stringify(msgToSend)
	};

	request(options, function getResponse(error, response, body){
		if (!error && response.statusCode == 200) {
			console.log('- Received a Hint from AI HTTP Server.');
			sendHint(body);
		}else{
			console.log('!!!HTTP Request ERROR!!! - ');
		}	
	}); 
}
	