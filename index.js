// Setup basic express server
var express = require("express");
var app = express();
var path = require("path");
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var port = process.env.PORT || 3000;
var fs = require("fs");
var SocketAntiSpam = require('socket-anti-spam');

let https = require('https');



// **********************************************
// *** Update or verify the following values. ***
// **********************************************

// Replace the accessKey string value with your valid access key.
let accessKey = 'ab0b52e78e5a44f7a5d491f5111bf79a';

// Replace or verify the region.

// You must use the same region in your REST API call as you used to obtain your access keys.
// For example, if you obtained your access keys from the westus region, replace 
// "westcentralus" in the URI below with "westus".

// NOTE: Free trial access keys are generated in the westcentralus region, so if you are using
// a free trial access key, you should not need to change this region.
let uri = 'westeurope.api.cognitive.microsoft.com';
let path1 = '/text/analytics/v2.0/languages';
var mydocuments;

function analyzeMessage(data, username) {
    mydocuments = {
        "documents": {
            "documents": [{ "id": 1, "text": data }]
        },
        "username": username
    };
    get_language(mydocuments);
}

let response_handler1 = function(response) {
    let body = '';
    response.on('data', function(d) {
        body += d;
    });
    response.on('end', function() {
        let body_ = JSON.parse(body);
        let body__ = JSON.stringify(body_, null, '  ');
        console.log(body__);
        mydocuments.documents.documents[0].language = body_.iso6391Name;
        get_sentiments(mydocuments);
    });
    response.on('error', function(e) {
        console.log('Error: ' + e.message);
        mydocuments = {};
    });
};

let response_handler2 = function(response) {
    let body = '';
    response.on('data', function(d) {
        body += d;
    });
    response.on('end', function() {
        let body_ = JSON.parse(body);
        let body__ = JSON.stringify(body_, null, '  ');
        console.log(body__);
        let clients = io.sockets.clients(); // This returns an array with all connected clients

        io.sockets.emit('sentiment computed', { 'data': mydocuments, 'response': body_ });

        mydocuments = {};
    });
    response.on('error', function(e) {
        console.log('Error: ' + e.message);

        mydocuments = {};
    });
};

let get_language = function(documents) {
    let body = JSON.stringify(documents.documents);

    let request_params = {
        method: 'POST',
        hostname: uri,
        path: path1,
        headers: {
            'Ocp-Apim-Subscription-Key': accessKey,
        }
    };

    let req = https.request(request_params, response_handler1);
    req.write(body);
    req.end();
}

let path2 = '/text/analytics/v2.0/sentiment';

let get_sentiments = function(documents) {
    let body = JSON.stringify(documents.documents);

    let request_params = {
        method: 'POST',
        hostname: uri,
        path: path2,
        headers: {
            'Ocp-Apim-Subscription-Key': accessKey,
        }
    };

    let req = https.request(request_params, response_handler2);
    req.write(body);
    req.end();
}

const socketAntiSpam = new SocketAntiSpam({
    banTime: 30, // Ban time in minutes
    kickThreshold: 10, // User gets kicked after this many spam score
    kickTimesBeforeBan: 2, // User gets banned after this many kicks
    banning: true, // Uses temp IP banning after kickTimesBeforeBan
    io: io, // Bind the socket.io variable
})

// Call functions with created reference 'socketAntiSpam'
socketAntiSpam.event.on('ban', data => {
    // Do stuff
    console.log(data);
})

const logToFile = content => {
    /* var d = new Date();
    var appendMessage =
        "[" + d.getHours() + ":" + d.getMinutes() + "] " + content + "\n";
    fs.appendFile("log.txt", appendMessage, () => {}); */
};

server.listen(port, function() {
    console.log("Server listening at port %d", port);
    fs.exists("log.txt", e => {
        if (e) {
            fs.truncate("log.txt", 0, () => {
                console.log("Prepared log file and started logging");
            });
        }
    });
});

// Routing
app.use(express.static(path.join(__dirname, "public")));

// Storage
//// Require Mongoose
var mongoose = require('mongoose');

// connect
mongoose.connect('mongodb://conet-azure-chat-mongodb.documents.azure.com:10255/chatlog?ssl=true', {
        auth: {
            user: 'conet-azure-chat-mongodb',
            password: '2dZQ9OHrN9lVRHunhudCB0HvXEHluIw8rjLMgRCnTtm93NiqvddT1Wia3WoU0xhF7RIhNzQW8tVSIactORVKmg=='
        }
    })
    .then(() => console.log('connection successful'))
    .catch((err) => console.error(err));

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log("Connected to DB");
});

//Define a schema
var Schema = mongoose.Schema;

var MessageModelSchema = new Schema({
    message: String,
    date: Date,
    user: String
});

// Compile model from schema
var MessageModel = mongoose.model('MessageModel', MessageModelSchema);


// HOW TO ADD MESSAGE TO DB

/* MessageModel.create({ message: 'testmessage', date: Date.now(), user: 'testname' }, function(err, awesome_instance) {
    if (err) return handleError(err);
    // saved!
}); */

// Chatroom

var numUsers = 0;

io.on("connection", function(socket) {
    var addedUser = false;

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function(data) {
        // we tell the client to execute 'new message'
        socket.broadcast.emit('new message', {
            username: socket.username,
            message: data
        });

        MessageModel.create({ message: data, date: Date.now(), user: socket.username }, function(err, awesome_instance) {
            if (err) return handleError(err);
            // saved!
        });

        analyzeMessage(data, socket.username);


        logToFile(socket.username + ": " + data);
    });


    // when the client emits 'add user', this listens and executes
    socket.on("add user", function(username) {
        if (addedUser) return;

        // we store the username in the socket session for this client
        socket.username = username;
        ++numUsers;
        addedUser = true;

        // chat history needs to be attached

        var messageStore = new Array();
        MessageModel.find({}, (err, messages) => {
            messages.forEach((element) => {
                messageStore.push({ "username": element.user, "message": element.message });
            });
            socket.emit('login', {
                numUsers: numUsers,
                messages: messageStore
            });

        });

        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
            username: socket.username,
            numUsers: numUsers,
            messages: messageStore
        });
        logToFile(socket.username + " joined");
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on("typing", function() {
        socket.broadcast.emit("typing", {
            username: socket.username
        });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on("stop typing", function() {
        socket.broadcast.emit("stop typing", {
            username: socket.username
        });
    });

    // when the user disconnects.. perform this
    socket.on("disconnect", function() {
        if (addedUser) {
            --numUsers;

            // echo globally that this client has left
            socket.broadcast.emit("user left", {
                username: socket.username,
                numUsers: numUsers
            });
            logToFile(socket.username + " disconnected");
        }
    });
});