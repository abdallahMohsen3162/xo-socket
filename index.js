const io = require("socket.io")(8900, {
    cors: {
        origin: "http://localhost:3000"
    }
})

let mp = new Map()
let st = new Set();
let games = new Map();

io.on("connection", (socket) => {
    socket.on("adduser", random_id => {
        st.add(socket.id)
        mp.set(random_id, socket.id);
    })

    socket.on("sendRequest", data => {
        console.log(data);
        io.to(mp.get(data.to)).emit("takeRequest", [data.from, data.message, data.board])
    })

    socket.on("getallusers", () => {
        let arr = [];
        for (let [a, b] of mp) {
            arr.push(a);
        }
        io.emit("responseallusers", arr)
    })

    socket.on("accept", (data) => {
        console.log(data);

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
        io.to(mp.get(data.to)).emit("accepted", data)
    })

    function validation(gameBoard) {
        let draw = true;
        for (let i = 0; i < gameBoard.length; i++) {
            for (let j = 0; j < gameBoard[i].length; j++) {
                if (gameBoard[i][j] == '.') {
                    draw = false;
                }
                let str = "";
                if (i + 2 < gameBoard.length) {
                    str += gameBoard[i][j];
                    str += gameBoard[i + 1][j];
                    str += gameBoard[i + 2][j];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }

                str = "";
                if (i - 2 >= 0) {
                    str += gameBoard[i][j];
                    str += gameBoard[i - 1][j];
                    str += gameBoard[i - 2][j];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }
                str = "";
                if (j + 2 < gameBoard.length) {
                    str += gameBoard[i][j];
                    str += gameBoard[i][j + 1];
                    str += gameBoard[i][j + 2];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }

                str = "";
                if (j - 2 >= 0) {
                    str += gameBoard[i][j];
                    str += gameBoard[i][j - 1];
                    str += gameBoard[i][j - 2];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }

                str = "";
                if (i + 2 < gameBoard.length && j + 2 < gameBoard.length) {
                    str += gameBoard[i][j];
                    str += gameBoard[i + 1][j + 1];
                    str += gameBoard[i + 2][j + 2];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }

                str = "";
                if (i - 2 >= 0 && j - 2 >= 0) {
                    str += gameBoard[i][j];
                    str += gameBoard[i - 1][j - 1];
                    str += gameBoard[i - 2][j - 2];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }

                str = "";
                if (i - 2 >= 0 && j + 2 < gameBoard.length) {
                    str += gameBoard[i][j];
                    str += gameBoard[i - 1][j + 1];
                    str += gameBoard[i - 2][j + 2];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }

                str = "";
                if (i + 2 < gameBoard.length && j - 2 >= 0) {
                    str += gameBoard[i][j];
                    str += gameBoard[i + 1][j - 1];
                    str += gameBoard[i + 2][j - 2];
                    if (str == "XXX" || str == "OOO") {
                        return str[0];
                    }
                }

            }
        }
        if (draw == true) {
            return "draw"
        }
        return '.';
    }

    socket.on("sendplay", (data) => {
        console.log(data);

        // Create game ID for this pair of players
        let gameId = [data.from, data.to].sort().join('-');

        // Get the specific game for these players
        let game = games.get(gameId);

        if (!game) {
            console.error(`Game not found for players: ${data.from} and ${data.to}`);
            return;
        }

        // Update the specific game board
        let G = game.board;
        let s = "";
        for (let j = 0; j < G[data.i].length; j++) {
            if (j == data.j) {
                s += data.char;
            } else {
                s += G[data.i][j];
            }
        }
        G[data.i] = s;


        games.set(gameId, {
            ...game,
            board: G
        });

        let ret = validation(G);
        if (ret != '.') {
            io.to(mp.get(data.to)).emit("winner", { player: ret });
            io.to(mp.get(data.from)).emit("winner", { player: ret });


            games.delete(gameId);
        }

        io.to(mp.get(data.to)).emit("update", { G: G, flg: true });
        io.to(mp.get(data.from)).emit("update", { G: G, flg: false });
    })

    socket.on("disconnect", () => {
        console.log("xxxxxxxxxxx", socket.id);


        for (let [gameId, game] of games) {
            if (game.players.includes(socket.id)) {
                games.delete(gameId);
                console.log(`Game ${gameId} removed due to player disconnect`);
            }
        }
    });
})