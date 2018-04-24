// Setup basic express server
var express = require("express");
var app = express();
var path = require("path");
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var port = process.env.PORT || 3000;
var fs = require("fs");

const logToFile = content => {
    var d = new Date();
    var appendMessage =
        "[" + d.getHours() + ":" + d.getMinutes() + "] " + content + "\n";
    fs.appendFile("log.txt", appendMessage, () => {});
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
            console.log(messages);
            messages.forEach((element) => {
                console.log(element);
                messageStore.push({ "username": element.user, "message": element.message });
            });

            console.log(messageStore);

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