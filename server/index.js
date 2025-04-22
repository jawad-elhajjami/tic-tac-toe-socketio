const http = require('http').createServer();

const io = require('socket.io')(http, {
    cors: {
        origin: "*"
    }
});

// Game state constants
const GAME_STATES = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    ENDED: 'ended',
    RESETTING: 'resetting'
};

// Initial game state
let gameState = {
    board: [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
    ],
    players: {},
    assignedSymbols: {
        'X': null, // Socket ID of player with X symbol
        'O': null  // Socket ID of player with O symbol
    },
    numOfMoves: 0,
    winner: null,
    lastMove: null,
    currentState: GAME_STATES.WAITING,
    isResetting: false,
    lastResetTime: 0
};

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

// Get a count of currently connected players
const getPlayerCount = () => Object.keys(gameState.players).length;

// Check for a win or draw
const checkResult = () => {
    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        const cellA = gameState.board[a[0]][a[1]];
        const cellB = gameState.board[b[0]][b[1]];
        const cellC = gameState.board[c[0]][c[1]];
        
        if (cellA !== '' && cellA === cellB && cellB === cellC) {
            return { result: cellA, combo };
        }
    }
    
    // Check for draw
    if (gameState.board.every(row => row.every(col => col !== ''))) {
        return { result: 'Draw', combo: null };
    }
    
    // Game is still in progress
    return { result: false, combo: null };
};

// Determine whose turn it is
const getCurrentTurnSymbol = () => {
    return gameState.numOfMoves % 2 === 0 ? 'X' : 'O';
};

// Update game state and emit to all clients
const updateGameState = (newState) => {
    if (newState) {
        gameState.currentState = newState;
    }
    
    // Add symbolic assignment info for debugging
    const symbolInfo = {
        xAssigned: gameState.assignedSymbols['X'] !== null,
        oAssigned: gameState.assignedSymbols['O'] !== null,
        xSocketId: gameState.assignedSymbols['X'],
        oSocketId: gameState.assignedSymbols['O']
    };
    
    // Broadcast game state update to all clients
    io.emit('game_state_update', {
        state: gameState.currentState,
        players: gameState.players,
        playerCount: getPlayerCount(),
        symbolInfo: symbolInfo // Send this for client debugging if needed
    });
    
    // If game is actively being played, also send board state
    if (gameState.currentState === GAME_STATES.PLAYING) {
        io.emit('board_change', {
            board: gameState.board,
            nextTurnSymbol: getCurrentTurnSymbol(),
            lastMove: gameState.lastMove
        });
    }
    
    console.log(`Game state updated to: ${gameState.currentState}, Players: ${getPlayerCount()}, X=${symbolInfo.xAssigned}, O=${symbolInfo.oAssigned}`);
};

// Complete reset of the game state
const resetGameState = () => {
    // Prevent multiple resets in quick succession
    const now = Date.now();
    if (now - gameState.lastResetTime < 2000) {
        console.log('Reset attempted too quickly, ignoring');
        return false;
    }
    
    // Mark that we're in the resetting process
    gameState.isResetting = true;
    gameState.lastResetTime = now;
    
    // Tell clients we're resetting
    io.emit('game_resetting');
    
    // Log current symbol assignments for debugging
    console.log(`Before reset - Symbols: X=${gameState.assignedSymbols['X']}, O=${gameState.assignedSymbols['O']}`);
    
    // Wait a moment for client-side cleanup
    setTimeout(() => {
        // Reset the board
        gameState.board = [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ];
        gameState.numOfMoves = 0;
        gameState.winner = null;
        gameState.lastMove = null;
        
        // Note: We don't reset assignedSymbols here
        // This ensures players keep their symbols after reset
        
        // Determine new game state based on player count
        if (getPlayerCount() < 2) {
            gameState.currentState = GAME_STATES.WAITING;
        } else {
            gameState.currentState = GAME_STATES.PLAYING;
        }
        
        gameState.isResetting = false;
        
        // Log after reset
        console.log(`After reset - Symbols: X=${gameState.assignedSymbols['X']}, O=${gameState.assignedSymbols['O']}`);
        
        // Notify clients of the reset completion
        io.emit('game_reset_complete');
        
        // Update all clients with new game state
        updateGameState();
        
        console.log('Game state has been completely reset');
        return true;
    }, 500); // Small delay to ensure client processes are complete
};

// Consistency check - make sure symbols and players match
const verifySymbolConsistency = () => {
    // Check if any player has a symbol not properly tracked
    Object.entries(gameState.players).forEach(([socketId, player]) => {
        const symbol = player.symbol;
        if (symbol === 'X' && gameState.assignedSymbols['X'] !== socketId) {
            console.warn(`Fixing inconsistency: Player ${socketId} has X but not tracked`);
            gameState.assignedSymbols['X'] = socketId;
        }
        else if (symbol === 'O' && gameState.assignedSymbols['O'] !== socketId) {
            console.warn(`Fixing inconsistency: Player ${socketId} has O but not tracked`);
            gameState.assignedSymbols['O'] = socketId;
        }
    });
    
    // Check if symbol is tracked but player doesn't exist or has wrong symbol
    if (gameState.assignedSymbols['X'] && 
        (!gameState.players[gameState.assignedSymbols['X']] || 
         gameState.players[gameState.assignedSymbols['X']].symbol !== 'X')) {
        console.warn(`Fixing inconsistency: X is assigned to ${gameState.assignedSymbols['X']} but player doesn't exist or has wrong symbol`);
        gameState.assignedSymbols['X'] = null;
    }
    
    if (gameState.assignedSymbols['O'] && 
        (!gameState.players[gameState.assignedSymbols['O']] || 
         gameState.players[gameState.assignedSymbols['O']].symbol !== 'O')) {
        console.warn(`Fixing inconsistency: O is assigned to ${gameState.assignedSymbols['O']} but player doesn't exist or has wrong symbol`);
        gameState.assignedSymbols['O'] = null;
    }
};

// Socket connection handling
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Verify symbol consistency on each new connection
    verifySymbolConsistency();
    
    // Send current game state to new connection
    socket.emit('initial_state', {
        state: gameState.currentState,
        players: gameState.players,
        playerCount: getPlayerCount(),
        board: gameState.board,
        nextTurnSymbol: getCurrentTurnSymbol(),
        symbolInfo: {
            xAssigned: gameState.assignedSymbols['X'] !== null,
            oAssigned: gameState.assignedSymbols['O'] !== null
        }
    });
    
    // Assignment of player symbols
const assignSymbolToPlayer = (socketId) => {
    // Check if X is available, if yes assign X
    if (!gameState.assignedSymbols['X']) {
        gameState.assignedSymbols['X'] = socketId;
        return 'X';
    }
    // Otherwise assign O
    else if (!gameState.assignedSymbols['O']) {
        gameState.assignedSymbols['O'] = socketId;
        return 'O';
    }
    // No symbols available
    return null;
};

// Handle player joining
socket.on('user_join', (username) => {
    // Check if game is in reset process
    if (gameState.isResetting) {
        socket.emit('try_again', { message: 'Game is currently resetting, please try again shortly' });
        return;
    }
    
    // Check if game is full
    if (getPlayerCount() >= 2) {
        socket.emit('game_full');
        return;
    }
    
    // Check if username already exists
    const alreadyExists = Object.values(gameState.players).some(
        player => player.username.toLowerCase() === username.toLowerCase()
    );
    
    if (!alreadyExists) {
        // Assign a symbol to this player
        const symbol = assignSymbolToPlayer(socket.id);
        
        if (!symbol) {
            socket.emit('game_full', { message: 'Could not assign a symbol. Game may be full.' });
            return;
        }
        
        // Add player to the game
        gameState.players[socket.id] = { username, symbol };
        
        socket.emit('symbol_assigned', symbol);
        
        console.log(`Player ${username} joined as ${symbol}. Symbols now: X=${gameState.assignedSymbols['X']}, O=${gameState.assignedSymbols['O']}`);
        
        // Determine if we now have enough players to start
        if (getPlayerCount() === 2 && gameState.currentState === GAME_STATES.WAITING) {
            gameState.currentState = GAME_STATES.PLAYING;
        }
        
        // Update all clients
        updateGameState();
    } else {
        socket.emit('username_already_exists');
    }
});
    
    // Handle player moves
    socket.on('move_made', (move_obj) => {
        // Don't process moves if game isn't in play state
        if (gameState.currentState !== GAME_STATES.PLAYING || gameState.isResetting) {
            return;
        }
        
        // Extract move data
        const { symbol, move } = move_obj;
        const { row, col } = move;
        
        // Verify this socket owns the symbol they claim
        const playerSymbol = gameState.players[socket.id]?.symbol;
        if (playerSymbol !== symbol) {
            console.log(`Symbol mismatch! Socket ${socket.id} claims ${symbol} but has ${playerSymbol}`);
            return;
        }
        
        // Additional safety check - make sure symbols are assigned correctly
        if ((symbol === 'X' && gameState.assignedSymbols['X'] !== socket.id) ||
            (symbol === 'O' && gameState.assignedSymbols['O'] !== socket.id)) {
            console.log(`Symbol assignment error! Socket ${socket.id} using ${symbol} but not properly assigned`);
            verifySymbolConsistency();
            return;
        }
        
        // Validate turn
        if (getCurrentTurnSymbol() !== symbol) {
            console.log(`Not ${symbol}'s turn!`);
            return;
        }
        
        // Validate move
        if (row < 1 || row > 3 || col < 1 || col > 3 || gameState.board[row - 1][col - 1] !== '') {
            console.log('Invalid move!');
            return;
        }
        
        // Update the board
        gameState.board[row - 1][col - 1] = symbol;
        gameState.lastMove = [row - 1, col - 1];
        gameState.numOfMoves++;
        
        // Broadcast the updated board
        io.emit('board_change', { 
            board: gameState.board, 
            nextTurnSymbol: getCurrentTurnSymbol(),
            lastMove: gameState.lastMove
        });
        
        // Check for game result
        const { result, combo } = checkResult();
        
        // Handle game end conditions
        if (result) {
            let message;
            if (result === 'Draw') {
                message = 'It\'s a draw!';
            } else {
                // Find the winner's username
                const winnerObj = Object.values(gameState.players).find(player => player.symbol === result);
                const winnerName = winnerObj ? winnerObj.username : result;
                message = `${winnerName} (${result}) wins!`;
            }
            
            gameState.winner = result;
            gameState.currentState = GAME_STATES.ENDED;
            
            // Update all clients
            updateGameState();
            
            // Send game end notification
            io.emit('game_done', {
                result,
                message,
                winningCombo: combo
            });
        }
    });
    
    // Handle game reset request
    socket.on('reset_game', () => {
        // Only proceed if game isn't already resetting
        if (!gameState.isResetting) {
            console.log(`Reset requested by ${socket.id}`);
            resetGameState();
        } else {
            console.log('Reset already in progress, ignoring duplicate request');
        }
    });
    
    // Handle player disconnect
socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Check if the disconnected player was in the game
    if (gameState.players[socket.id]) {
        // Get the symbol of the disconnected player
        const playerSymbol = gameState.players[socket.id].symbol;
        const playerName = gameState.players[socket.id].username;
        
        console.log(`Player ${playerName} with symbol ${playerSymbol} disconnected`);
        
        // Remove player from players list
        delete gameState.players[socket.id];
        
        // Clear the symbol assignment
        if (gameState.assignedSymbols['X'] === socket.id) {
            gameState.assignedSymbols['X'] = null;
            console.log('Symbol X is now available');
        } else if (gameState.assignedSymbols['O'] === socket.id) {
            gameState.assignedSymbols['O'] = null;
            console.log('Symbol O is now available');
        }
        
        // If in playing/ended state when a player leaves, we need to reset
        if (gameState.currentState === GAME_STATES.PLAYING || 
            gameState.currentState === GAME_STATES.ENDED) {
            // Set to waiting if we don't have enough players
            if (getPlayerCount() < 2) {
                gameState.currentState = GAME_STATES.WAITING;
            }
            
            // Reset the game
            resetGameState();
            
            // Notify remaining players
            io.emit('player_disconnected', { 
                message: `Player ${playerName} (${playerSymbol}) disconnected`,
                playerSymbol
            });
        } else {
            // Just update the player list
            updateGameState();
        }
    }
});
});

// Start the server
const PORT = process.env.PORT || 8080;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));