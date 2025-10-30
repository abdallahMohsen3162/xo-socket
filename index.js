const express = require("express");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

let mp = new Map();
let st = new Set();
let games = new Map();

// ====================================================
// SOCKET LOGIC
// ====================================================
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("adduser", random_id => {
        st.add(socket.id);
        mp.set(random_id, socket.id);
    });

    socket.on("sendRequest", data => {
        console.log("Request:", data);
        io.to(mp.get(data.to)).emit("takeRequest", [data.from, data.message, data.board]);
    });

    socket.on("getallusers", () => {
        let arr = Array.from(mp.keys());
        io.emit("responseallusers", arr);
    });

    socket.on("accept", (data) => {
        console.log("Accept:", data);

        let gameId = [data.from, data.to].sort().join('-');
        let G = [];

        for (let i = 0; i < data.board; i++) {
            G[i] = "";
            for (let j = 0; j < data.board; j++) {
                G[i] += '.';
            }
        }

        games.set(gameId, {
            board: G,
            players: [data.from, data.to],
            boardSize: data.board
        });

        console.log(`Game ${gameId} created:`, G);
        io.to(mp.get(data.to)).emit("accepted", data);
    });

    function validation(gameBoard) {
        let draw = true;
        for (let i = 0; i < gameBoard.length; i++) {
            for (let j = 0; j < gameBoard[i].length; j++) {
                if (gameBoard[i][j] == '.') {
                    draw = false;
                }
                let directions = [
                    [[1, 0], [2, 0]], // down
                    [[-1, 0], [-2, 0]], // up
                    [[0, 1], [0, 2]], // right
                    [[0, -1], [0, -2]], // left
                    [[1, 1], [2, 2]], // down-right
                    [[-1, -1], [-2, -2]], // up-left
                    [[-1, 1], [-2, 2]], // up-right
                    [[1, -1], [2, -2]] // down-left
                ];

                for (let d of directions) {
                    let str = gameBoard[i][j];
                    for (let [di, dj] of d) {
                        let ni = i + di, nj = j + dj;
                        if (ni >= 0 && ni < gameBoard.length && nj >= 0 && nj < gameBoard.length)
                            str += gameBoard[ni][nj];
                    }
                    if (str === "XXX" || str === "OOO") return str[0];
                }
            }
        }
        if (draw) return "draw";
        return '.';
    }

    socket.on("sendplay", (data) => {
        console.log("Play:", data);

        let gameId = [data.from, data.to].sort().join('-');
        let game = games.get(gameId);

        if (!game) {
            console.error(`Game not found for players: ${data.from} and ${data.to}`);
            return;
        }

        let G = game.board;
        let s = "";
        for (let j = 0; j < G[data.i].length; j++) {
            s += (j === data.j) ? data.char : G[data.i][j];
        }
        G[data.i] = s;

        games.set(gameId, { ...game, board: G });

        let ret = validation(G);
        if (ret !== '.') {
            io.to(mp.get(data.to)).emit("winner", { player: ret });
            io.to(mp.get(data.from)).emit("winner", { player: ret });
            games.delete(gameId);
        }

        io.to(mp.get(data.to)).emit("update", { G, flg: true });
        io.to(mp.get(data.from)).emit("update", { G, flg: false });
    });

       socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);
        
        // Find and remove the user from mp
        let disconnectedUserId = null;
        for (let [userId, socketId] of mp) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                mp.delete(userId);
                break;
            }
        }
        
        // Remove from st
        st.delete(socket.id);
        
        // Clean up any games involving this user
        for (let [gameId, game] of games) {
            if (game.players.includes(disconnectedUserId)) {
                games.delete(gameId);
                console.log(`Game ${gameId} removed due to player disconnect`);
                
                // Notify the other player
                let otherPlayer = game.players.find(p => p !== disconnectedUserId);
                if (otherPlayer && mp.has(otherPlayer)) {
                    io.to(mp.get(otherPlayer)).emit("opponentDisconnected");
                }
            }
        }
        
        // Broadcast updated user list to all connected clients
        let arr = Array.from(mp.keys());
        io.emit("responseallusers", arr);
        
        console.log(`User ${disconnectedUserId} removed. Active users:`, arr.length);
    });
});

// ====================================================
// BASIC HTTP ENDPOINT
// ====================================================
app.get("/", (req, res) => {
    res.send("Socket.IO server is running and alive 🚀");
});

// ====================================================
// KEEP SERVER AWAKE ON RENDER
// ====================================================
setInterval(() => {
    https.get("https://xo-socket.onrender.com", (res) => {
        console.log("Self-ping status:", res.statusCode);
    }).on("error", (err) => {
        console.error("Self-ping failed:", err.message);
    });
}, 10 * 60 * 1000); // every 10 minutes

// ====================================================
// START SERVER
// ====================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
