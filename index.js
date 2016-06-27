/* TODO

	* Spiele löschen
	* Spieler neue Sicht geben, nachdem sie entweder erzeugen oder beitreten

	* get attending PLayers
	* Spielphasen entwicklen

*/

///////////////////////////////////////////////////////////////////////////////

/// Module ///
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var mongoose = require('mongoose');


// Server App
var app = express();

// Mongoose Stuff
var Schema = mongoose.Schema;

var playerSchema = new Schema({
	username: { type: String, required: true, unique: true },
	created_at: Date,
	victory_points: { type: Number, default: 1 },
	active: { type: Boolean, default: false },
	game: String,
	president: { type: Boolean, default: false },
	dice: { type: [Schema.Types.Mixed], default: [ { diceValue : 0, targetPlayer : "" } ] }
});

var Player = mongoose.model('Player', playerSchema);
module.exports = Player;

var gameSchema = new Schema({
	name: { type: String, required: true, unique: true },
	creator: { type: String },
	started: { type: Boolean, default: false }

});

var Game = mongoose.model('Game', gameSchema);
module.exports = Game;

mongoose.connect('mongodb://localhost');

// Session Stuff
app.use(session({secret: 'qwertz',
				 name: 'travel',
				 resave: true,
				 saveUninitialized: true }));


// Express Stuff
var jsonParser = bodyParser.json();
app.use(express.static('public'));

app.listen(process.env.PORT || 8080, function() {
	log('Server listening on port 8080...');
});

/// GAMEPLAY LOGIC ///

// Spielphasen in Form von Funktionen

function PRESIDENT_ELECTION(players, callback) {
	var highest = 0;
	var presidentPlayer;

	for(var i=0; i<players.length; i++) {

		if(players[i].dice[0].diceValue == 0) {
			return callback();
		} else if(players[i].dice[0].diceValue >= highest) {
			presidentPlayer = players[i];
		}
	}

	if(presidentPlayer)
		log(presidentPlayer.username + " is the president!");

	callback();
}

function FIGHT() {

}

function BUY() {

}

// Aktuelle Phase in variable

var currentPhase = PRESIDENT_ELECTION;

/// GET Routes ///

app.get('/getGames', function(req, res) {

	Game.find({}, function(err, games) {
		res.json(games);
	});
});

app.get('/getPlayers', function(req, res) {

	Player.find({}, function(err, players) {

		currentPhase(players, function() {
			res.json(players);
		});

	});
});


/// POST Routes ///

app.post('/startGame', jsonParser, function(req, res) {
log("starting game " + req.body.game);

	Game.update({ name: req.body.game }, { $set: { started: true }}, function(err, game) {
		res.json({ res: "good" });
	});
});

app.post('/leaveGame', jsonParser, function(req, res) {
	// TODO evtl. Prüfungen

	Player.update({ username: req.body.username }, { $set: { game: '' }}, function(err, uplayer) {

		// Seesion leeren
		req.session = null;

		res.json({res: "good"});
	});
});

app.post('/joinGame', jsonParser, function(req, res) {

	if(req.body.game == "") {
		return;
	}

	// suche das entsprechende Spiel in der DB
	Game.findOne({ name: req.body.game }, function(err, game) {
		if(err) {
			console.error(err);
			return;
		}

		if(!game)
			return;

		var data = { username: req.body.username };
		data.gameName = game.name;

		// Wenn das Spiel gefunden wurde, erzeuge Spieler mit GameId
		createPlayer(req, data, function(player) {
			res.json(game);
		});
	});

});

app.post('/createGame', jsonParser, function(req, res) {
	// Spiel erstellen
	var newGame = new Game({
		name: "Game"+ Date.now(),
		creator: req.body.username
	});

	//Spiel in DB speichern
	newGame.save(function(err, game) {
		//schauen ob es einen Fehler in der DB gab
		if(err) {
			console.error(err);
			return;
		}

		// req.body liefert aus der Anfrage die parameter
		var data = { username: req.body.username };
		data.gameName = game.name;
		data.gameCreator = req.body.username;

		log("Spiel " + game.id + " wurde erzeugt!");

		// Neuer Spieler erzeugen und dem Spiel automatisch zuordnen (join)
		// Username ist in diesem Request mitgesendet worden

		createPlayer(req, data, function(player) {
			res.json(game);
		});
	});
});

function createPlayer(req, data, callback) {

	var newPlayer = new Player({
		username: data.username,
		created_at: Date.now(),
		game: data.gameName
	});

	newPlayer.save(function(err, player) {
		if(err) {
			//Spieler bereits vorhanden, d.h. Player.game überschreiben
			// SQL bspw.: update player set game = 'neuesSpiel' where username = 'spielername';
			Player.update({ username: data.username }, { $set: { game: data.gameName }}, function(err, uplayer) {
				callback(uplayer);
			});
		} else {
			log("Neuer Spieler " + player.username + " wurde erzeugt!");
			log("Spieler wurde dem Spiel " + player.game + " hinzugefügt!");

			callback(player);
		}
	});
}

/// GAMEPLAY ROUTES ///
// TODO in eigene Datei auslagern

app.post('/addDice', jsonParser, function(req, res) {
	Player.findOne({ username: req.body.username}, function(err, player) {
		if(err) return log(err);

		player.dice.push({ diceValue : 0, targetPlayer : "" });

		updatePlayer(player, function(uplayer) {
			res.json(uplayer);
		});
	});
});

app.get('/rollDice', function(req, res) {

	log(req.query.username + " will roll the dice");
	Player.findOne({ username: req.query.username}, function(err, player) {

		log("Dice count for " + player.username + ": " + player.dice.length);

		// Alle Würfel würfeln lassen
		for(var i=0; i < player.dice.length; i++) {
			player.dice[i] = { diceValue : getRandom(), targetPlayer : null };
		}

		updatePlayer(player, function(uplayer) {
			res.json(uplayer);
		});

	});
});

function initGame() {

}

function updatePlayer(player, callback) {
	Player.findOneAndUpdate({ username: player.username }, { $set: { dice: player.dice }}, function(err, uplayer) {
		callback(uplayer);
	});
}

/// GAME FUNCTIONS ///

function getRandom() {
	return Math.round(Math.random() * 5) + 1;
}

/// DEBUG ///

function log(msg) {
	var date = new Date();

	var formattedTime = date.getHours() + ":"
			+ date.getMinutes() + ":"
			+ date.getSeconds();

	console.log("[" + formattedTime + "] " + msg);
}
