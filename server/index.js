const http = require('http').createServer();

const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});

// Game state
let board = [
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
];

// All possible winning combinations
const winningCombos = [
    // Rows
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    // Columns
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    // Diagonals
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]],
];

let players = {};
let numOfMoves = 0;
let winner = null;
let lastMove = null; // Track the last move for highlighting
let gameInProgress = false;

// Check for a win or draw
const checkResult = () => {
    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        const cellA = board[a[0]][a[1]];
        const cellB = board[b[0]][b[1]];
        const cellC = board[c[0]][c[1]];
        
        if (cellA !== '' && cellA === cellB && cellB === cellC) {
            return { result: cellA, combo };
        }
    }
    
    // Check for draw
    if (board.every(row => row.every(col => col !== ''))) {
        return { result: 'Draw', combo: null };
    }
    
    // Game is still in progress
    return { result: false, combo: null };
}

// Determine whose turn it is
const getCurrentTurnSymbol = () => {
    return numOfMoves % 2 === 0 ? 'X' : 'O';
}

// Reset the game state
const resetGame = () => {
    board = [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
    ];
    numOfMoves = 0;
    winner = null;
    lastMove = null;
    gameInProgress = Object.keys(players).length >= 2;
}

// Socket connection handling
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Handle player joining
    socket.on('user_join', (username) => {
        let players_count = Object.keys(players).length;
        
        // Check if game is full
        if (players_count >= 2) {
            socket.emit('game_full');
            return;
        }
        
        // Check if username already exists
        const alreadyExists = Object.values(players).some(
            player => player.username.toLowerCase() === username.toLowerCase()
        );
        
        if (!alreadyExists) {
            const symbol = players_count === 0 ? 'X' : 'O';
            players[socket.id] = { username, symbol };
            
            socket.emit('symbol_assigned', symbol);
            io.emit('players_list_update', players);
            
            // If we now have 2 players, start the game
            if (Object.keys(players).length === 2) {
                gameInProgress = true;
                io.emit('board_change', { 
                    board, 
                    nextTurnSymbol: getCurrentTurnSymbol(),
                    lastMove: null
                });
            }
        } else {
            socket.emit('username_already_exists');
        }
    });
    
    // Handle player moves
    socket.on('move_made', (move_obj) => {
        if (!gameInProgress) return;
        
        // Extract move data
        const { symbol, move } = move_obj;
        const { row, col } = move;
        
        // Validate turn
        if (getCurrentTurnSymbol() !== symbol) {
            console.log(`Not ${symbol}'s turn!`);
            return;
        }
        
        // Validate move
        if (row < 1 || row > 3 || col < 1 || col > 3 || board[row - 1][col - 1] !== '') {
            console.log('Invalid move!');
            return;
        }
        
        // Update the board
        board[row - 1][col - 1] = symbol;
        lastMove = [row - 1, col - 1];
        numOfMoves++;
        
        // Check for game result
        const { result, combo } = checkResult();
        
        // Broadcast the updated board
        io.emit('board_change', { 
            board, 
            nextTurnSymbol: getCurrentTurnSymbol(),
            lastMove
        });
        
        // Handle game end conditions
        if (result) {
            let message;
            if (result === 'Draw') {
                message = 'It\'s a draw!';
            } else {
                // Find the winner's username
                const winnerObj = Object.values(players).find(player => player.symbol === result);
                const winnerName = winnerObj ? winnerObj.username : result;
                message = `${winnerName} (${result}) wins!`;
            }
            
            winner = result;
            gameInProgress = false;
            
            io.emit('game_done', {
                result,
                message,
                winningCombo: combo
            });
        }
    });
    
    // Handle game reset request
    socket.on('reset_game', () => {
        resetGame();
        io.emit('game_reset');
        io.emit('board_change', { 
            board, 
            nextTurnSymbol: getCurrentTurnSymbol(),
            lastMove: null
        });
    });
    
    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Check if the disconnected player was in the game
        if (players[socket.id]) {
            delete players[socket.id];
            
            // Reset the game state
            resetGame();
            
            // Notify remaining players
            io.emit('player_disconnected');
            io.emit('players_list_update', players);
        }
    });
});

// Start the server
const PORT = process.env.PORT || 8080;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));