class Board {
    constructor() {
        // 24 points: null = empty, 'white' or 'black'
        this.nodes = Array(24).fill(null);
    }

    getMills() {
        return [
            [0, 1, 2], [8, 9, 10], [16, 17, 18],      // Top horizontal
            [6, 5, 4], [14, 13, 12], [22, 21, 20],   // Bottom horizontal
            [0, 7, 6], [8, 15, 14], [16, 23, 22],    // Left vertical
            [2, 3, 4], [10, 11, 12], [18, 19, 20],   // Right vertical
            [1, 9, 17],                              // Cross top
            [5, 13, 21],                             // Cross bottom
            [7, 15, 23],                             // Cross left
            [3, 11, 19]                              // Cross right
        ];
    }

    getAdjacent(index) {
        const ring = Math.floor(index / 8);
        const pos = index % 8;
        const adj = [];

        // Same ring neighbors
        adj.push(ring * 8 + ((pos + 1) % 8));
        adj.push(ring * 8 + ((pos + 7) % 8));

        // Cross ring neighbors for middle points (1, 3, 5, 7)
        if (pos % 2 !== 0) {
            if (ring > 0) adj.push((ring - 1) * 8 + pos); // connect to outer
            if (ring < 2) adj.push((ring + 1) * 8 + pos); // connect to inner
        }

        return adj;
    }

    isMill(index, color) {
        return this.getMills().some(mill =>
            mill.includes(index) && mill.every(i => this.nodes[i] === color)
        );
    }

    allOpponentPiecesInMills(opponentColor) {
        let allInMills = true;
        let piecesFound = false;

        for (let i = 0; i < 24; i++) {
            if (this.nodes[i] === opponentColor) {
                piecesFound = true;
                if (!this.isMill(i, opponentColor)) {
                    allInMills = false;
                    break;
                }
            }
        }
        return piecesFound && allInMills;
    }

    canMove(index) {
        return this.getAdjacent(index).some(i => this.nodes[i] === null);
    }

    hasLegalMoves(color) {
        let piecesCount = 0;
        for (let i = 0; i < 24; i++) {
            if (this.nodes[i] === color) {
                piecesCount++;
                if (this.canMove(i)) return true;
            }
        }
        if (piecesCount <= 3) return true; // Flying phase allows jumping anywhere

        return false;
    }
}
module.exports = Board;
