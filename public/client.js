const socket = io();

// DOM Elements
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');

// Create Game Form
const btnCreate = document.getElementById('btn-create-game');
const inputCreatePlayer = document.getElementById('create-player-name');
const inputCreateOpponent = document.getElementById('create-opponent-name');
const createMsg = document.getElementById('create-msg');

// Join Game Form
const btnJoin = document.getElementById('btn-join-game');
const inputJoinCode = document.getElementById('join-code');
const joinMsg = document.getElementById('join-msg');

// Fullscreen
document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

// Info Modal
const btnInfo = document.getElementById('btn-info');
const infoModal = document.getElementById('info-modal');
const closeInfo = document.getElementById('close-info');

btnInfo.addEventListener('click', () => {
    infoModal.style.display = 'flex';
});

closeInfo.addEventListener('click', () => {
    infoModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === infoModal) {
        infoModal.style.display = 'none';
    }
});

socket.on('connect', () => {
    console.log('Verbunden mit dem Server');
});

// Game State Variables
let myPlayerId = null;
let myColor = null;
let gameState = null;
let selectedNode = null;

// Lobby Actions
btnCreate.addEventListener('click', () => {
    const playerName = inputCreatePlayer.value;
    const opponentName = inputCreateOpponent.value;
    createMsg.innerText = '';
    if (!playerName || !opponentName) return createMsg.innerText = 'Bitte beide Namen eingeben.';
    socket.emit('create-game', { playerName, opponentName });
});

btnJoin.addEventListener('click', () => {
    const code = inputJoinCode.value;
    joinMsg.innerText = '';
    if (!code) return joinMsg.innerText = 'Bitte den Gegner Namen (Raumcode) eingeben.';
    socket.emit('join-game', { code });
});

// Lobby Events
socket.on('game-created', (gameId) => {
    createMsg.style.color = '#5cb85c';
    createMsg.innerText = `Spiel erstellt! Warte auf Gegner...`;
});

socket.on('error', (msg) => {
    createMsg.innerText = msg;
    joinMsg.innerText = msg;
    createMsg.style.color = '#d9534f';
    joinMsg.style.color = '#d9534f';
});

socket.on('game-started', (gameInfo) => {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    document.getElementById('in-game-title').style.display = 'block';
    document.body.classList.add('in-game');
    myPlayerId = socket.id;
    initBoard();
});

const toastElem = document.getElementById('toast');

function showToast(msg) {
    toastElem.innerText = msg;
    toastElem.classList.add('show');
    setTimeout(() => {
        toastElem.classList.remove('show');
    }, 3000);
}

socket.on('action-error', (msg) => {
    showToast(msg);
});

// ====== GAME LOGIC ====== //
const nodesContainer = document.getElementById('nodes');
const p1NameElem = document.getElementById('p1-name');
const p1PiecesElem = document.getElementById('p1-pieces');
const p1ScoreElem = document.getElementById('p1-score');
const p2NameElem = document.getElementById('p2-name');
const p2PiecesElem = document.getElementById('p2-pieces');
const p2ScoreElem = document.getElementById('p2-score');
const statusElem = document.getElementById('game-status');
const instructionsElem = document.getElementById('game-instructions');
const btnRestart = document.getElementById('btn-restart-game');

btnRestart.addEventListener('click', () => {
    socket.emit('restart-game');
});

const nodePositions = [
    { x: 5, y: 5 }, { x: 50, y: 5 }, { x: 95, y: 5 },
    { x: 95, y: 50 }, { x: 95, y: 95 }, { x: 50, y: 95 },
    { x: 5, y: 95 }, { x: 5, y: 50 },
    { x: 18, y: 18 }, { x: 50, y: 18 }, { x: 82, y: 18 },
    { x: 82, y: 50 }, { x: 82, y: 82 }, { x: 50, y: 82 },
    { x: 18, y: 82 }, { x: 18, y: 50 },
    { x: 31, y: 31 }, { x: 50, y: 31 }, { x: 69, y: 31 },
    { x: 69, y: 50 }, { x: 69, y: 69 }, { x: 50, y: 69 },
    { x: 31, y: 69 }, { x: 31, y: 50 }
];

let nodeElements = [];

function initBoard() {
    nodesContainer.innerHTML = '';
    nodeElements = [];
    nodePositions.forEach((pos, i) => {
        const el = document.createElement('div');
        el.className = 'node';
        el.style.left = `${pos.x}%`;
        el.style.top = `${pos.y}%`;
        el.dataset.index = i;
        el.addEventListener('click', () => handleNodeClick(i));
        nodesContainer.appendChild(el);
        nodeElements.push(el);
    });
}

socket.on('update-state', (state) => {
    gameState = state;

    // Determine colors
    const players = Object.values(state.players);
    const me = players.find(p => p.id === myPlayerId);
    myColor = me ? me.color : null;

    const p1 = players.find(p => p.color === 'white');
    const p2 = players.find(p => p.color === 'black');

    p1NameElem.innerText = p1.name;
    p2NameElem.innerText = p2.name;

    // Display match scores (Fallback auf 0, falls der Server noch alte Daten sendet)
    const p1Score = state.matchScore && state.matchScore[p1.id] !== undefined ? state.matchScore[p1.id] : 0;
    const p2Score = state.matchScore && state.matchScore[p2.id] !== undefined ? state.matchScore[p2.id] : 0;
    p1ScoreElem.innerText = `Punkte: ${p1Score}`;
    p2ScoreElem.innerText = `Punkte: ${p2Score}`;

    // Display piece counts
    if (state.phase === 'SETTING') {
        p1PiecesElem.innerText = p1.unplacedPieces;
        p2PiecesElem.innerText = p2.unplacedPieces;
    } else {
        p1PiecesElem.innerText = p1.piecesOnBoard;
        p2PiecesElem.innerText = p2.piecesOnBoard;
    }

    // Status Message
    if (state.status === 'GAME_OVER') {
        const winnerName = state.players[state.winner] ? state.players[state.winner].name : 'Niemand';
        statusElem.innerText = `Spiel beendet! Sieger: ${winnerName} (${state.endReason})`;
        statusElem.style.color = '#d9534f';
    } else if (state.turn === myPlayerId) {
        if (state.waitingForCapture) {
            statusElem.innerText = "MÜHLE! Gegn. Stein wählen.";
            statusElem.style.color = '#d9534f';
        } else {
            statusElem.innerText = "Du bist am Zug!";
            statusElem.style.color = '#5cb85c';
        }
    } else {
        statusElem.innerText = "Gegner am Zug...";
        statusElem.style.color = '#555';
    }

    // Setup dynamic instructions
    let instructionText = "";
    if (state.status === 'GAME_OVER') {
        instructionText = "🏆 Das Spiel ist vorbei! Klicke auf 'Neues Spiel starten', um direkt die nächste Runde im selben Raum zu spielen.";
        btnRestart.style.display = 'block';
    } else {
        btnRestart.style.display = 'none';
        if (state.turn === myPlayerId) {
            if (state.waitingForCapture) {
                instructionText = "💡 **Tipp:** Du hast eine Mühle geschlossen! Klicke auf einen gegnerischen Stein, um ihn vom Feld zu nehmen. Steine aus einer geschlossenen Mühle darfst du nur entfernen, wenn keine anderen mehr übrig sind.";
            } else if (state.phase === 'SETTING') {
                instructionText = "💡 **Tipp:** Deine Setz-Phase. Klicke auf einen leeren (schwarzen) Punkt, um dort einen deiner Spielsteine zu platzieren. Versuche, drei in eine Reihe (Mühle) zu bekommen!";
            } else {
                const myPieces = me ? me.piecesOnBoard : 0;
                if (myPieces <= 3) {
                    instructionText = "💡 **Tipp:** Du hast nur noch 3 Steine! Du bist nun in der Sprung-Phase. Wähle erst einen eigenen Stein an und klicke dann auf einen *beliebigen* freien Platz auf dem Spielfeld.";
                } else {
                    instructionText = "💡 **Tipp:** Zieh-Phase. Klicke zuerst auf einen deiner Steine, den du bewegen willst, und danach auf einen leeren benachbarten schwarzen Punkt, um dorthin zu ziehen.";
                }
            }
        } else {
            instructionText = "⏳ Dein Gegner ist am Zug. Überlege dir schon mal deinen nächsten Schritt!";
        }
    }

    // Parse mini markdown for bold text (Tipp:)
    instructionsElem.innerHTML = instructionText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Reset selection if not my turn
    if (state.turn !== myPlayerId) {
        selectedNode = null;
    }

    renderBoard();
});

function renderBoard() {
    if (!gameState) return;

    nodeElements.forEach((el, i) => {
        const color = gameState.board[i];
        el.className = 'node'; // reset

        if (color === 'white') el.classList.add('piece-white');
        else if (color === 'black') el.classList.add('piece-black');

        if (i === selectedNode) el.classList.add('selected');

        if (gameState.turn === myPlayerId && gameState.waitingForCapture) {
            const oppColor = myColor === 'white' ? 'black' : 'white';
            if (color === oppColor) {
                el.classList.add('highlight-capture');
            }
        }
    });
}

function handleNodeClick(index) {
    if (!gameState || gameState.status !== 'ACTIVE' || gameState.turn !== myPlayerId) return;

    if (gameState.waitingForCapture) {
        const oppColor = myColor === 'white' ? 'black' : 'white';
        if (gameState.board[index] === oppColor) {
            socket.emit('player-action', { type: 'CAPTURE', index });
        }
        return;
    }

    if (gameState.phase === 'SETTING') {
        if (gameState.board[index] === null) {
            socket.emit('player-action', { type: 'PLACE', index });
        }
    } else if (gameState.phase === 'MOVING' || gameState.phase === 'FLYING') {
        if (gameState.board[index] === myColor) {
            selectedNode = index;
            renderBoard();
        } else if (gameState.board[index] === null && selectedNode !== null) {
            socket.emit('player-action', { type: 'MOVE', from: selectedNode, to: index });
            selectedNode = null;
        }
    }
}
