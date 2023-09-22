const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const mongoose = require("mongoose");
const Room = require("./models/Room");
const { Socket } = require("socket.io");
const getWord = require("./api/getWord");

app.use(express.json());
const DB =
  "mongodb+srv://salazar:salazar@cluster0.ofk5f4j.mongodb.net/?retryWrites=true&w=majority";
// const DB =
//   "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.6.0";

mongoose
  .connect(DB)
  .then(() => {
    console.log("mongodb connection successful");
  })
  .catch((e) => {
    console.log(e);
  });

io.on("connection", (socket) => {
  console.log("socket connected ", socket.id);
  socket.on("create-room", async ({ nickName, name, occupancy, maxRounds }) => {
    try {
      const existingRoom = await Room.findOne({ name: name });
      if (existingRoom) {
        socket.emit("notCorrectGame", "Room with that name already exists!");
        return;
      }
      let room = new Room();
      const word = getWord();
      room.word = word;
      room.name = name;
      room.occupancy = occupancy;
      room.maxRounds = maxRounds;
      room.isJoin = true;

      let player = {
        socketID: socket.id,
        nickName,
        isPartyLeader: true,
      };
      room.players.push(player);
      room = await room.save();
      socket.join(name);
      io.to(name).emit("updateRoom", room);
    } catch (err) {
      console.log(err);
    }
  });
  socket.on("join-room", async ({ nickName, name }) => {
    try {
      let room = await Room.findOne({ name: name });
      if (!room) {
        socket.emit("notCorrectGame", "Please enter a valid room name");
        return;
      }
      if (room.isJoin) {
        let player = {
          socketID: socket.id,
          nickName,
        };
        room.players.push(player);
        socket.join(name);

        if (room.players.length === room.occupancy) {
          room.isJoin = false;
        }
        room.turn = room.players[room.turnIndex];
        room = await room.save();
        io.to(name).emit("updateRoom", room);
      } else {
        socket.emit("notCorrectGame", "Game in progress. Try later.");
      }
    } catch (error) {
      console.log(error);
    }
  });
  socket.on("paint", (obj) => {
    io.to(obj["roomName"]).emit("points", obj);
  });
  socket.on("color-change", (map) => {
    io.to(map["roomName"]).emit("color-change", map["color"]);
  });
  socket.on("strokeWidth-change", (map) => {
    io.to(map["roomName"]).emit("strokeWidth-change", map["strokeWidth"]);
  });
  socket.on("clear-screen", (roomName) => {
    io.to(roomName).emit("clear-screen", "");
  });
  socket.on("msg", async (obj) => {
    try {
      if (obj.msg === obj.word) {
        let room = await Room.find({ name: obj.roomName });
        let userPlayer = room[0].players.filter(
          (player) => player.nickName === obj.userName
        );
        if (obj.timeTaken != 0) {
          userPlayer[0].points += Math.round((200 / obj.timeTaken) * 10);
        }
        room = await room[0].save();
        io.to(obj.roomName).emit("msg", {
          userName: obj.userName,
          msg: "Guesses It!",
          guessedUserCtr: obj.guessedUserCtr + 1,
        });
        socket.emit("closeInput", "");
      } else {
        io.to(obj.roomName).emit("msg", {
          userName: obj.userName,
          msg: obj.msg,
          guessedUserCtr: obj.guessedUserCtr,
        });
      }
    } catch (error) {
      console.log(error.toString());
    }
  });
  socket.on("change-turn-time", async (roomName) => {
    try {
      let room = await Room.findOne({ name: roomName });
      if (room["players"][0]["socketID"] == socket.id) {
        let idx = room.turnIndex;
        if (idx + 1 == room.players.length) {
          room.currentRound += 1;
        }
        if (room.currentRound <= room.maxRounds) {
          const word = getWord();
          room.word = word;
          room.turnIndex = (idx + 1) % room.players.length;
          room.turn = room.players[room.turnIndex];
          room = await room.save();
          io.to(roomName).emit("change-turn", room);
        } else {
          io.to(roomName).emit("leaderBoard", room.players);
        }
      }
    } catch (error) {
      consoless.log(error.toString());
    }
  });
  socket.on("change-turn-guess", async (roomName) => {
    try {
      let room = await Room.findOne({ name: roomName });
      let idx = room.turnIndex;
      if (idx + 1 == room.players.length) {
        room.currentRound += 1;
      }
      if (room.currentRound <= room.maxRounds) {
        const word = getWord();
        room.word = word;
        room.turnIndex = (idx + 1) % room.players.length;
        room.turn = room.players[room.turnIndex];
        room = await room.save();
        io.to(roomName).emit("change-turn", room);
      } else {
        io.to(roomName).emit("leaderBoard", room.players);
      }
    } catch (error) {
      console.log(error.toString());
    }
  });
  socket.on("updateScore", async (name) => {
    try {
      const room = await Room.findOne({ name: name });
      io.to(name).emit("updateScore", room);
    } catch (error) {
      console.log(error.toString());
    }
  });
  socket.on("disconnect", async () => {
    try {
      let room = await Room.findOne({ "players.socketID": socket.id });
      for (let i = 0; i < room.players.length; i++) {
        if (room.players[i].socketID === socket.id) {
          console.log(room.players[i].socketID, " disconnected");
          room.players.splice(i, 1);
          break;
        }
      }
      room = await room.save();
      if (room.players.length == 1) {
        socket.broadcast.to(room.name).emit("leaderBoard", room.players);
      } else {
        socket.broadcast.to(room.name).emit("updateScore", room);
      }
    } catch (error) {
      console.log(error.toString());
    }
  });
});

server.listen(process.env.PORT || port, () => {
  console.log("Server started and running on port:" + port);
});
