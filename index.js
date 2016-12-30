//initialize express
var express = require('express');
//initialize alexa-app
var alexa = require('alexa-app');
//initialize the app and set the port
var app = express();
//verifier to make sure our certs come from Amazon
var verifier = require('alexa-verifier');

app.set('port', (process.env.PORT || 5000));
app.use(express.static('public'));
app.set('view engine','ejs');

app.use(function(req, res, next) {
	if (!req.headers || !req.headers.signaturecertchainurl) {
		return next();
	}

	req._body = true;
	req.rawBody = '';
	req.on('data', function(data) {
		return req.rawBody += data;
	});
	return req.on('end', function() {
		var cert_url, er, requestBody, signature;
		try {
			req.body = JSON.parse(req.rawBody);
		} catch (_error) {
			er = _error;
			req.body = {};
		}
		cert_url = req.headers.signaturecertchainurl;
		signature = req.headers.signature;
		requestBody = req.rawBody;
		return verifier(cert_url, signature, requestBody, function(er) {
			if (er) {
				console.error('error validating the alexa cert:', er);
				return res.status(401).json({
					status: 'failure',
					reason: er
				});
			} else {
				return next();
			}
		});
	});
});


//what we say when we can't find a new thing for some reason
var newThingFailed = "Sorry, something went wrong....I couldn;t find any new thing";

//create and assign our Alexa App instance to an address on express, in this case https://new-things-jar.herokuapp.com/api/new-things-jar
var alexaApp = new alexa.app('new-things-jar');
alexaApp.express(app, "/api/");

//make sure our app is only being launched by the correct application (our Amazon Alexa app)
alexaApp.pre = function(request,response,type) {
	if (request.sessionDetails.application.applicationId != "amzn1.ask.skill.3fd8679b-bfea-4d94-b829-2259fb99ba5e") {
		// Fail ungracefully 
		response.fail("Invalid applicationId");
	}
};

// Our intent that is launched when "Hey Alexa, open New Things Jar" command is made
// We will go straight and pick new thing on launching
alexaApp.launch(function(request,response) {
	//log our app launch
	console.log("App launched"); 
	
	//our new thing which we share to both the companion app and the Alexa device
	var newThing = getNewThing();
	//if we failed to get a new thing, apologize
	if(!newThing){
		newThing = newThingFailed;
	}else{
		//only display it in the companion app if we have a joke
		response.card(newThing);
	}
	response.say(newThing);
	response.send();
	
});

// TellMeANewThing intent, this handles the majority of our interactions.
alexaApp.intent('TellMeANewThing',{
		// Define our custom variables, in this case, none
        "slots" : {},
		// Define our utterances
        "utterances" : ["Tell me a new thing", "Get me a new thing", "A new thing", "Tell me {another|} new thing"]
    },
    function(request, response){
		// Our new thing which we share to both the companion app and the Alexa device
		var newThing = getNewThing();
		//if we failed to get a new thing, apologize
		if(!newThing){
			newThing = newThingFailed;
		}else{
			//only display it in the companion app if we have a new thing
			response.card(newThing);
		}
		response.say(newThing);
		response.send();
});

//our TellMeANewThingAbout intent, this handles specific topic queries.
alexaApp.intent('TellMeANewThingAbout',{
		//define our custom variables, in this case the topic of our new thing
        "slots" : {"TOPIC":"LITERAL"},
		//define our utterance
        "utterances" : ["Get me a new thing about {Julian|Henry|TOPIC}",
			"Tell me a new thing about {Julian|Henry|TOPIC}",
			"I want to hear a new thing about {Julian|Henry|TOPIC}",
			"Tell me a {topic|TOPIC} new thing"]
    },
    function(request, response){
		
		//our topic variable from the intent
		var topic = request.slot('TOPIC');
		
		//our new thing which we share to both the companion app and the Alexa device
		var newThing = getNewThingAbout(topic);
		//if we failed to get a new thing, apologize
		if(!newThing){
			newThing = "Sorry....I couldn't find a joke about "+topic;
		}else{
			//only display it in the companion app if we have a new thing
			response.card(newThing);
		}
		response.say(newThing);
		response.send();
});


//our About intent, this talks about the icons we used
alexaApp.intent('IntentAbout',{
		//define our custom variables, in this case, none
        "slots" : {},
		//define our utterance
        "utterances" : ["Tell me about this app"]
    },
    function(request, response){
		response.say("This app was brought to you by the great Papa");
		response.send();
});

//this function gets a single joke based on a RNG
var getNewThing = function(){
	var length = newThingsList.length;
	var newThingNumber = Math.floor(Math.random() * length);
	console.log("Getting joke #" + newThingNumber);
	var newThing = newThingsList[newThingNumber];
	console.log("Our new thing is: " + newThing);
	return newThing;
}

//this function tries to do a dumb string match against our joke list, this is not performant
var getNewThingAbout = function(topic){

	console.log("Our topic is: "+topic);
	
	var newThings = shuffle(newThingsList);
	
	//so that we can randomize and not always get the first new thing about a topic
	var length = newThings.length;
	var randomOffset = Math.floor(Math.random() * length);
	
	for(var i = 0; i < newThings.length; i++){
			//start somewhere and modulo us back down
			var which = (i + randomOffset) % length;
			var newThing = newThings[which];
			console.log("Checking new thing:"+which);
			if(newThing.toLowerCase().indexOf(topic) > -1){
				console.log("Getting new thing #"+which);
				console.log("Our new thing is: "+newThing);
				return newThing;
			}
	}
	return null;
}

//shuffle our new things for our topic function
var shuffle = function(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

//a shortcut to get our app schema
app.get('/schema', function(request, response) {
    response.send('<pre>'+alexaApp.schema()+'</pre>');
});

//a shortcut to get our app utterances
app.get('/utterances', function(request, response) {
    response.send('<pre>'+alexaApp.utterances()+'</pre>');
});


//make sure we're listening on the assigned port
app.listen(app.get('port'), function() {
    console.log("Node app is running at localhost:" + app.get('port'));
});



var newThingsList = 
["Henry tried to eat a snail",
"Julian learnt to ride a bike"]