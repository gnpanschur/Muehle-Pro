const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Game = require('./models/Game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Statische Dateien aus dem /public Ordner ausliefern
app.use(express.static(path.join(__dirname, '../public')));

// In-Memory Speicher für Spiele und Lobby
const games = new Map();
// Mapping: GegnerName (lowercase) -> GameID für das Lobby-System
const pendingGames = new Map();

io.on('connection', (socket) => {
    console.log(`Neuer Client verbunden: ${socket.id}`);

    // Lobby: Create Game
    socket.on('create-game', ({ playerName, opponentName }) => {
        if (!playerName || !opponentName) {
            return socket.emit('error', 'Felder dürfen nicht leer sein.');
        }

        const roomCodeLower = opponentName.toLowerCase().trim();

        if (pendingGames.has(roomCodeLower)) {
            return socket.emit('error', 'Dieser Raumcode wird bereits verwendet.');
        }

        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();

        const newGame = {
            id: gameId,
            player1: { id: socket.id, name: playerName, color: 'white' },
            player2: null,
            expectedOpponent: opponentName.trim(),
            status: 'WAITING'
        };

        games.set(gameId, newGame);
        // Der Joiner nutzt den "Raumcode" (opponentName) um beizutreten
        pendingGames.set(roomCodeLower, gameId);

        socket.join(gameId);
        socket.emit('game-created', gameId);
        console.log(`Spiel erstellt: ${gameId} von ${playerName} mit Raumcode ${opponentName}`);
    });

    // Lobby: Join Game
    socket.on('join-game', ({ code }) => {
        if (!code) {
            return socket.emit('error', 'Bitte einen Raumcode eingeben.');
        }

        const roomCodeLower = code.toLowerCase().trim();
        const gameId = pendingGames.get(roomCodeLower);

        if (!gameId) {
            return socket.emit('error', 'Kein Spiel mit diesem Raumcode gefunden.');
        }

        const gameData = games.get(gameId);

        // Den Namen für den Beitretenden aus der Erstellung übernehmen!
        const myName = gameData.expectedOpponent;

        const player2Data = { id: socket.id, name: myName, color: 'black' };
        const game = new Game(gameId, gameData.player1, player2Data);
        games.set(gameId, game);

        pendingGames.delete(roomCodeLower);
        socket.join(gameId);

        io.to(gameId).emit('game-started', {
            gameId: game.id,
            player1: game.players[gameData.player1.id],
            player2: game.players[player2Data.id]
        });

        io.to(gameId).emit('update-state', game.getState());
        console.log(`Spiel ${gameId} gestartet!`);
    });

    // In-Game Events
    socket.on('player-action', (action) => {
        let currentGame = null;
        for (const game of games.values()) {
            if (game instanceof Game && game.players[socket.id]) {
                currentGame = game;
                break;
            }
        }

        if (!currentGame) return socket.emit('error', 'Kein aktives Spiel gefunden.');

        const result = currentGame.handleAction(socket.id, action);
        if (result.error) {
            socket.emit('action-error', result.error);
        } else {
            io.to(currentGame.id).emit('update-state', currentGame.getState());
        }
    });

    socket.on('restart-game', () => {
        let currentGame = null;
        for (const game of games.values()) {
            if (game instanceof Game && game.players[socket.id]) {
                currentGame = game;
                break;
            }
        }

        if (!currentGame) return socket.emit('error', 'Kein aktives Spiel gefunden.');

        if (currentGame.status === 'GAME_OVER') {
            currentGame.restart();
            io.to(currentGame.id).emit('update-state', currentGame.getState());
            console.log(`Spiel ${currentGame.id} wurde neu gestartet.`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client getrennt: ${socket.id}`);
        // TODO: Aufräumen von Spielen bei Disconnect (Lobby/In-Game) implementieren
    });
});

server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
