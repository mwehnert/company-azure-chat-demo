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

// Chatroom

var numUsers = 0;

io.on("connection", function(socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on("new message", function(data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit("new message", {
      username: socket.username,
      message: data
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
    socket.emit("login", {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit("user joined", {
      username: socket.username,
      numUsers: numUsers
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
