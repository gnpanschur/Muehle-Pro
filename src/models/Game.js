const Board = require('./Board');

class Game {
    constructor(id, player1, player2) {
        this.id = id;
        this.players = {
            [player1.id]: { ...player1, unplacedPieces: 9, piecesOnBoard: 0 },
            [player2.id]: { ...player2, unplacedPieces: 9, piecesOnBoard: 0 }
        };
        this.board = new Board();
        this.turn = player1.id; // Ersteller fängt an
        this.phase = 'SETTING'; // SETTING, MOVING, FLYING, GAME_OVER
        this.status = 'ACTIVE';
        this.winner = null;
        this.waitingForCapture = false;

        this.matchScore = {
            [player1.id]: 0,
            [player2.id]: 0
        };

        this.colors = {
            [player1.id]: 'white', // Ersteller (Blau/Feld A) ist 'white'
            [player2.id]: 'black'  // Beitretender ist 'black'
        };
    }

    getOpponentId(playerId) {
        return Object.keys(this.players).find(id => id !== playerId);
    }

    handleAction(playerId, action) {
        if (this.status !== 'ACTIVE' || this.turn !== playerId) return { error: "Nicht am Zug oder Spiel beendet." };

        const opponentId = this.getOpponentId(playerId);

        if (this.waitingForCapture) {
            if (action.type !== 'CAPTURE') return { error: "Du musst einen gegnerischen Stein entfernen." };
            return this.handleCapture(playerId, opponentId, action.index);
        }

        if (this.phase === 'SETTING') {
            if (action.type !== 'PLACE') return { error: "Ungültige Aktion in der Setzphase." };
            return this.handlePlace(playerId, action.index);
        }

        if (this.phase === 'MOVING' || this.phase === 'FLYING') {
            if (action.type !== 'MOVE') return { error: "Ungültige Aktion in der Zugphase." };
            return this.handleMove(playerId, action.from, action.to);
        }

        return { error: "Unbekannte Aktion." };
    }

    handlePlace(playerId, index) {
        if (this.board.nodes[index] !== null) return { error: "Feld ist bereits belegt." };

        const color = this.colors[playerId];
        this.board.nodes[index] = color;
        this.players[playerId].unplacedPieces--;
        this.players[playerId].piecesOnBoard++;

        if (this.board.isMill(index, color)) {
            this.waitingForCapture = true;
            return { success: true, message: "Mühle! Wähle einen gegnerischen Stein." };
        }

        this.checkPhaseTransition();
        this.switchTurn();
        return { success: true };
    }

    handleMove(playerId, from, to) {
        const color = this.colors[playerId];
        if (this.board.nodes[from] !== color) return { error: "Das ist nicht dein Stein." };
        if (this.board.nodes[to] !== null) return { error: "Zielfeld ist nicht frei." };

        const isFlying = this.players[playerId].piecesOnBoard <= 3 && this.players[playerId].unplacedPieces === 0;

        if (!isFlying) {
            const adj = this.board.getAdjacent(from);
            if (!adj.includes(to)) return { error: "Ungültiger Zug. Feld ist nicht angrenzend." };
        }

        this.board.nodes[from] = null;
        this.board.nodes[to] = color;

        if (this.board.isMill(to, color)) {
            this.waitingForCapture = true;
            return { success: true, message: "Mühle! Wähle einen gegnerischen Stein." };
        }

        this.updateGameState();
        this.switchTurn();
        return { success: true };
    }

    handleCapture(playerId, opponentId, index) {
        const oppColor = this.colors[opponentId];
        if (this.board.nodes[index] !== oppColor) return { error: "Das ist kein gegnerischer Stein." };

        if (this.board.isMill(index, oppColor)) {
            if (!this.board.allOpponentPiecesInMills(oppColor)) {
                return { error: "Stein ist Teil einer Mühle und geschützt." };
            }
        }

        this.board.nodes[index] = null;
        this.players[opponentId].piecesOnBoard--;
        this.waitingForCapture = false;

        this.updateGameState();

        if (this.status === 'ACTIVE') {
            this.checkPhaseTransition();
            this.switchTurn();
        }

        return { success: true };
    }

    checkPhaseTransition() {
        if (this.phase === 'SETTING') {
            const keys = Object.keys(this.players);
            if (this.players[keys[0]].unplacedPieces === 0 && this.players[keys[1]].unplacedPieces === 0) {
                this.phase = 'MOVING';
            }
        }
    }

    updateGameState() {
        const keys = Object.keys(this.players);
        const p1Id = keys[0];
        const p2Id = keys[1];
        const p1 = this.players[p1Id];
        const p2 = this.players[p2Id];

        if (this.phase !== 'SETTING') {
            if (p1.piecesOnBoard < 3) return this.endGame(p2Id, 'Steinmangel.');
            if (p2.piecesOnBoard < 3) return this.endGame(p1Id, 'Steinmangel.');

            // Validate the NEXT player's ability to move (blockade check)
            // But we evaluate before switchTurn, so opponent is `getOpponentId(this.turn)`
            const nextTurn = this.getOpponentId(this.turn);
            if (!this.board.hasLegalMoves(this.colors[nextTurn])) {
                return this.endGame(this.turn, 'Eingekesselt (keine legalen Züge).');
            }
        }
    }

    endGame(winnerId, reason) {
        this.status = 'GAME_OVER';
        this.winner = winnerId;
        this.endReason = reason;
        this.phase = 'GAME_OVER';
        if (winnerId && this.matchScore[winnerId] !== undefined) {
            this.matchScore[winnerId]++;
        }
    }

    restart() {
        this.board = new Board();

        const keys = Object.keys(this.players);
        this.players[keys[0]].unplacedPieces = 9;
        this.players[keys[0]].piecesOnBoard = 0;
        this.players[keys[1]].unplacedPieces = 9;
        this.players[keys[1]].piecesOnBoard = 0;

        // Verlierer (oder Nicht-Macher des letzten Zugs) fängt an, oder einfach wechseln
        this.turn = this.turn === keys[0] ? keys[1] : keys[0];

        this.phase = 'SETTING';
        this.status = 'ACTIVE';
        this.winner = null;
        this.waitingForCapture = false;
    }

    switchTurn() {
        this.turn = this.getOpponentId(this.turn);
    }

    getState() {
        return {
            id: this.id,
            board: this.board.nodes,
            players: this.players,
            turn: this.turn,
            phase: this.phase,
            status: this.status,
            winner: this.winner,
            endReason: this.endReason,
            waitingForCapture: this.waitingForCapture,
            matchScore: this.matchScore
        };
    }
}

module.exports = Game;
