// HTML ELEMENTS
const username = document.getElementById('username');
const start_game_btn = document.getElementById('start_game_btn');
const board_container = document.getElementById('board_container');
const form_container = document.getElementById('form_container');
const game_result = document.getElementById('game_result');
const error_container = document.getElementById('error');
const turn_indicator = document.getElementById('turn');
const restart_btn = document.getElementById('restart');
const result = document.getElementById('result');
const user_container = document.getElementById('user_container');

// Socket connection - use window.location to make it work in production
const socket = io('http://localhost:8080');

// Game state constants (must match server)
const GAME_STATES = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    ENDED: 'ended',
    RESETTING: 'resetting'
};

// GLOBAL VARS
let assignedSymbol = null;
let currentGameState = GAME_STATES.WAITING;
let isResetting = false;
let players = {};
let boardData = [
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
];

// Initialize game
const init = () => {
    // Create game board
    generateBoard();
    
    // Hide elements initially
    board_container.classList.add('hidden');
    restart_btn.classList.add('hidden');
    game_result.classList.add('hidden');
    error_container.classList.add('hidden');
    
    // Reset text fields
    result.textContent = '';
    turn_indicator.textContent = '';
    
    // Set initial game state
    currentGameState = GAME_STATES.WAITING;
    
    // Update UI based on initial state
    updateUIForGameState();
    
    console.log('Game initialized');
};

// Complete client-side reset
const completeReset = () => {
    // Reset all visuals
    game_result.classList.add('hidden');
    game_result.textContent = '';
    game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md hidden';
    
    result.textContent = '';
    turn_indicator.textContent = '';
    turn_indicator.className = 'text-center mb-8';
    turn_indicator.classList.remove('pulse-text');
    
    // Reset board visuals
    document.querySelectorAll('.tile').forEach(tile => {
        tile.textContent = '';
        tile.classList.remove('clicked', 'winning-tile', 'pulse-animation', 'shake-animation', 
                             'opacity-80', 'x-symbol', 'o-symbol', 'last-move');
        tile.removeAttribute('disabled');
    });
    
    // Reset local data
    boardData = [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
    ];
    
    console.log('Client-side reset complete');
};

// Create the game board
const generateBoard = () => {
    // Clear previous board if it exists
    board_container.innerHTML = '';
    
    for(let r=1; r<=3; r++){
        for(let c=1; c<=3; c++){
            let TILE_HTML_ELEMENT = document.createElement('button');
            TILE_HTML_ELEMENT.classList.add(
                'cursor-pointer', 'tile', 
                'w-24', 'h-24', 'border-2', 
                'border-gray-900', 'bg-white', 
                'font-bold', 'text-4xl',
                'transition-all', 'duration-300',
                'hover:bg-gray-100', 'focus:outline-none', 
                'flex', 'items-center', 'justify-center',
                'rounded-md', 'shadow-md'
            );
            TILE_HTML_ELEMENT.addEventListener('click', (event) => handleTileClick(event));
            TILE_HTML_ELEMENT.setAttribute('data-row', r);
            TILE_HTML_ELEMENT.setAttribute('data-col', c);
            board_container.appendChild(TILE_HTML_ELEMENT);
        }
    }
};

// Reset errors
const resetErrors = () => {
    error_container.textContent = '';
    error_container.classList.add('hidden');
};

// Show error message
const showError = (message) => {
    error_container.textContent = message;
    error_container.classList.remove('hidden');
    // Shake animation for error feedback
    form_container.classList.add('shake-animation');
    setTimeout(() => {
        form_container.classList.remove('shake-animation');
    }, 500);
};

// Start game function
const startGame = (event) => {
    if (event) event.preventDefault();
    
    const name = username.value.trim();
    if (name === '') {
        showError('Username is required!');
        return;
    }
    
    // Request to join
    socket.emit('user_join', name);
};

// Check if a tile has been clicked
const isTileClicked = (tile) => {
    return tile.classList.contains('clicked');
};

// Handle tile click
const handleTileClick = (event) => {
    // Don't process clicks if game isn't in play state or is resetting
    if (currentGameState !== GAME_STATES.PLAYING || isResetting) return;
    
    let clickedTile = event.target;
    if(!isTileClicked(clickedTile)){
        let row = parseInt(clickedTile.dataset.row);
        let col = parseInt(clickedTile.dataset.col);
        
        // Emit click event to the server
        let move_obj = {
            username: username.value,
            symbol: assignedSymbol,
            move: {row, col},
        }
        
        // Add visual feedback before server responds
        clickedTile.classList.add('clicked', 'pulse-animation');
        
        socket.emit('move_made', move_obj);
    } else {
        // Animate the tile to indicate it's already clicked
        clickedTile.classList.add('shake-animation');
        setTimeout(() => {
            clickedTile.classList.remove('shake-animation');
        }, 500);
    }
};

// Prevent further clicks on the board
const preventClicks = () => {
    document.querySelectorAll('.tile').forEach(tile => {
        tile.setAttribute('disabled', true);
        tile.classList.add('opacity-80');
    });
};

// Enable clicks on the board
const enableClicks = () => {
    document.querySelectorAll('.tile').forEach(tile => {
        tile.removeAttribute('disabled');
        tile.classList.remove('opacity-80');
    });
};

// Highlight winning combination
const highlightWinningCombo = (combo) => {
    if (!combo) return;
    
    combo.forEach(([row, col]) => {
        // Convert from 0-based to 1-based indexing
        row++; 
        col++;
        
        const tile = document.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
        if (tile) {
            tile.classList.add('winning-tile');
        }
    });
};

// Update player list display
const updatePlayersList = (players) => {
    user_container.innerHTML = '';
    
    // Create header
    const header = document.createElement('h2');
    header.textContent = 'Players';
    header.className = 'text-xl font-bold mb-2 text-center';
    user_container.appendChild(header);
    
    // Create player cards container
    const playersList = document.createElement('div');
    playersList.className = 'flex gap-4 justify-center mb-4';
    
    // Add player cards
    Object.values(players).forEach((user) => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${user.symbol === 'X' ? 'player-x' : 'player-o'} p-3 rounded-lg shadow-md transition-all duration-300`;
        
        const playerSymbol = document.createElement('span');
        playerSymbol.textContent = user.symbol;
        playerSymbol.className = 'text-2xl font-bold block text-center';
        
        const playerName = document.createElement('span');
        playerName.textContent = user.username;
        playerName.className = 'block text-center text-sm mt-1';
        
        playerCard.appendChild(playerSymbol);
        playerCard.appendChild(playerName);
        playersList.appendChild(playerCard);
    });
    
    user_container.appendChild(playersList);
    
    // Check if waiting for another player
    const playersCount = Object.values(players).length;
    if (playersCount < 2) {
        const waitingMsg = document.createElement('p');
        waitingMsg.textContent = 'Waiting for another player...';
        waitingMsg.className = 'text-center text-gray-600 animate-pulse';
        user_container.appendChild(waitingMsg);
    }
};

// Update board display based on server data
const updateBoardDisplay = (board, nextTurnSymbol, lastMove) => {
    // Store board data locally
    boardData = board;
    
    // Update turn indicator with animation
    const isYourTurn = nextTurnSymbol === assignedSymbol;
    turn_indicator.textContent = isYourTurn ? 'Your turn!' : 'Opponent\'s turn!';
    turn_indicator.className = `text-center mb-8 font-bold ${isYourTurn ? 'text-green-600' : 'text-blue-600'} transition-all duration-300`;
    
    if (isYourTurn) {
        turn_indicator.classList.add('pulse-text');
    } else {
        turn_indicator.classList.remove('pulse-text');
    }
    
    // Update board tiles
    document.querySelectorAll('.tile').forEach(tile => {
        const row = parseInt(tile.dataset.row) - 1;
        const col = parseInt(tile.dataset.col) - 1;
        const cellValue = board[row][col];
        
        if (cellValue) {
            tile.textContent = cellValue;
            tile.classList.add('clicked');
            
            // Add color based on symbol
            if (cellValue === 'X') {
                tile.classList.add('x-symbol');
                tile.classList.remove('o-symbol');
            } else if (cellValue === 'O') {
                tile.classList.add('o-symbol');
                tile.classList.remove('x-symbol');
            }
        } else {
            // Clear empty cells
            tile.textContent = '';
            tile.classList.remove('clicked', 'x-symbol', 'o-symbol');
        }
        
        // Highlight the last move if provided
        if (lastMove && row === lastMove[0] && col === lastMove[1]) {
            tile.classList.add('last-move');
            setTimeout(() => {
                tile.classList.remove('last-move');
            }, 1000);
        }
    });
};

// Update UI based on game state
const updateUIForGameState = () => {
    console.log(`Updating UI for game state: ${currentGameState}, isResetting: ${isResetting}`);
    
    // Don't make UI changes during reset
    if (isResetting) return;
    
    switch(currentGameState) {
        case GAME_STATES.WAITING:
            form_container.classList.remove('hidden');
            board_container.classList.add('hidden');
            restart_btn.classList.add('hidden');
            game_result.classList.add('hidden');
            turn_indicator.textContent = '';
            break;
            
        case GAME_STATES.PLAYING:
            form_container.classList.add('hidden');
            board_container.classList.remove('hidden');
            restart_btn.classList.remove('hidden');
            game_result.classList.add('hidden');
            enableClicks();
            break;
            
        case GAME_STATES.ENDED:
            form_container.classList.add('hidden');
            board_container.classList.remove('hidden');
            restart_btn.classList.remove('hidden');
            preventClicks();
            break;
            
        default:
            // No changes for other states
            break;
    }
};

// Request game reset
const requestGameReset = () => {
    // Prevent multiple reset requests
    if (isResetting) return;
    
    // Visual feedback that reset is happening
    isResetting = true;
    restart_btn.classList.add('opacity-50');
    restart_btn.textContent = 'Resetting...';
    
    // Tell server we want to reset
    socket.emit('reset_game');
    
    console.log('Reset requested');
};

// Handle confetti effect for winners
const showConfetti = () => {
    if (typeof window.confetti !== 'function') {
        console.log('Confetti library not loaded');
        return;
    }
    
    const count = 200;
    const defaults = {
        origin: { y: 0.7 }
    };

    function fire(particleRatio, opts) {
        window.confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
        });
    }

    fire(0.25, {
        spread: 26,
        startVelocity: 55,
    });
    fire(0.2, {
        spread: 60,
    });
    fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
    });
    fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
    });
    fire(0.1, {
        spread: 120,
        startVelocity: 45,
    });
};

// Initialize game on load
init();

// Event listeners
start_game_btn.addEventListener('click', startGame);
restart_btn.addEventListener('click', (event) => {
    event.preventDefault();
    requestGameReset();
});

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to websocket server');
});

socket.on('initial_state', (data) => {
    console.log('Received initial state:', data);
    
    // Set local game state from server
    currentGameState = data.state;
    players = data.players;
    
    // Update the UI
    updatePlayersList(players);
    updateUIForGameState();
    
    // If game is in progress, update the board
    if (data.board && (currentGameState === GAME_STATES.PLAYING || currentGameState === GAME_STATES.ENDED)) {
        updateBoardDisplay(data.board, data.nextTurnSymbol, null);
    }
});

socket.on('game_state_update', (data) => {
    console.log('Game state update:', data);
    
    // Update local state
    currentGameState = data.state;
    players = data.players;
    
    // Check if our symbol is still valid
    let symbolStillValid = false;
    Object.values(players).forEach(player => {
        if (player.symbol === assignedSymbol) {
            symbolStillValid = true;
        }
    });
    
    // Log symbol information if available
    if (data.symbolInfo) {
        console.log(`Symbol status - X assigned: ${data.symbolInfo.xAssigned}, O assigned: ${data.symbolInfo.oAssigned}`);
    }
    
    // If our symbol is no longer valid (e.g. due to some edge case), show warning
    if (assignedSymbol && !symbolStillValid && Object.keys(players).length > 0) {
        console.warn(`Warning: Your symbol ${assignedSymbol} is no longer valid in the game!`);
        
        // Show error to user
        showError(`There was a problem with your game symbol. Please refresh the page to rejoin.`);
        
        // Disable board interaction
        preventClicks();
    }
    
    // Update player list
    updatePlayersList(players);
    
    // Update UI based on new state
    updateUIForGameState();
});

socket.on('username_already_exists', () => {
    showError('Username already exists!');
});

socket.on('game_full', () => {
    showError('Game is currently full. Please try again later.');
});

socket.on('try_again', (data) => {
    showError(data.message);
});

socket.on('symbol_assigned', (symbol) => {
    assignedSymbol = symbol;
    resetErrors();
});

socket.on('board_change', (data) => {
    updateBoardDisplay(data.board, data.nextTurnSymbol, data.lastMove);
});

socket.on('game_done', (data) => {
    // Show game result with animation
    if (data.result !== 'Draw') {
        game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md text-center text-white font-bold text-xl fade-in';
        game_result.classList.add(data.result === 'X' ? 'bg-blue-500' : 'bg-red-500');
        highlightWinningCombo(data.winningCombo);
    } else {
        game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md text-center text-white font-bold text-xl fade-in bg-orange-500';
    }
    
    game_result.textContent = data.message;
    game_result.classList.remove('hidden');
    
    // Update result text
    result.textContent = data.message;
    
    // Show confetti for winner
    if (data.result === assignedSymbol) {
        showConfetti();
    }
});

socket.on('game_resetting', () => {
    console.log('Server is resetting the game');
    
    // Visual feedback
    isResetting = true;
    game_result.classList.add('hidden');
    turn_indicator.classList.remove('pulse-text');
    turn_indicator.textContent = 'Game is resetting...';
    
    // Complete client-side reset
    completeReset();
});

socket.on('game_reset_complete', () => {
    console.log('Game reset complete');
    
    // Reset local flags
    isResetting = false;
    
    // Reset button appearance
    restart_btn.classList.remove('opacity-50');
    restart_btn.textContent = 'New Game';
});

socket.on('player_disconnected', (data) => {
    // Show notification if we're in a game
    if (currentGameState === GAME_STATES.PLAYING || currentGameState === GAME_STATES.ENDED) {
        game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md text-center text-white font-bold text-xl fade-in bg-gray-500';
        
        // Show more specific message if we have details
        if (data && data.message) {
            game_result.textContent = data.message;
        } else {
            game_result.textContent = 'Your opponent disconnected!';
        }
        
        game_result.classList.remove('hidden');
        
        // Update text indicator
        turn_indicator.textContent = 'Waiting for a new player';
        turn_indicator.className = 'text-center mb-8 text-gray-600';
        
        // Log which player left if we have that info
        if (data && data.playerSymbol) {
            console.log(`Player with symbol ${data.playerSymbol} disconnected`);
        }
    }
});