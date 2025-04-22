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
let tiles = document.querySelectorAll('.tile');

// Socket connection - use window.location to make it work in production
const socket = io('http://localhost:8080');

// GLOBAL VARS
const BOARD_SIZE = 9;
let assignedSymbol;
let winner;
let players_count;
let currentGameState = 'waiting'; // 'waiting', 'playing', 'ended'

// Initialize game
const init = () => {
    board_container.classList.add('hidden');
    restart_btn.classList.add('hidden');
    game_result.classList.add('hidden');
    result.textContent = '';
    currentGameState = 'waiting';
    updateUIForGameState();
}

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
    
    // Update the reference to the tiles
    tiles = document.querySelectorAll('.tile');
}

// Hide form and show game board
const showGameBoard = () => {
    form_container.classList.add('hidden');
    board_container.classList.remove('hidden');
    restart_btn.classList.remove('hidden');
}

// Reset errors
const resetErrors = () => {
    error_container.textContent = '';
    error_container.classList.add('hidden');
}

// Show error message
const showError = (message) => {
    error_container.textContent = message;
    error_container.classList.remove('hidden');
    // Shake animation for error feedback
    form_container.classList.add('shake-animation');
    setTimeout(() => {
        form_container.classList.remove('shake-animation');
    }, 500);
}

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
}

// Check if a tile has been clicked
const isTileClicked = (tile) => {
    return tile.classList.contains('clicked');
}

// Handle tile click
const handleTileClick = (event) => {
    if (currentGameState !== 'playing') return;
    
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
}

// Prevent further clicks on the board
const preventClicks = () => {
    tiles.forEach(tile => {
        tile.setAttribute('disabled', true);
        tile.classList.add('opacity-80');
    });
}

// Enable clicks on the board
const enableClicks = () => {
    tiles.forEach(tile => {
        tile.removeAttribute('disabled');
        tile.classList.remove('opacity-80');
    });
}

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
}

// Update UI based on game state
const updateUIForGameState = () => {
    switch(currentGameState) {
        case 'waiting':
            form_container.classList.remove('hidden');
            board_container.classList.add('hidden');
            restart_btn.classList.add('hidden');
            break;
        case 'playing':
            form_container.classList.add('hidden');
            board_container.classList.remove('hidden');
            restart_btn.classList.remove('hidden');
            enableClicks();
            break;
        case 'ended':
            preventClicks();
            restart_btn.classList.remove('hidden');
            break;
    }
}

// Reset the game
const resetGame = () => {
    // Ask server to reset the game
    socket.emit('reset_game');
    
    // Reset local UI
    game_result.classList.add('hidden');
    game_result.textContent = '';
    game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md hidden'; // Reset classes
    result.textContent = '';
    turn_indicator.textContent = '';
    turn_indicator.classList.remove('pulse-text'); // Stop animation
    
    // Reset board visuals
    tiles.forEach(tile => {
        tile.textContent = '';
        tile.classList.remove('clicked', 'winning-tile', 'pulse-animation', 'shake-animation', 'opacity-80', 'x-symbol', 'o-symbol', 'last-move');
        tile.removeAttribute('disabled');
    });
    
    // Don't set game state here - let the server drive it
    // We'll update game state when we receive the game_reset event
}

// Initialize game on load
init();
generateBoard();

// Event listeners
start_game_btn.addEventListener('click', startGame);
restart_btn.addEventListener('click', (event) => {
    event.preventDefault();
    
    // Clear UI first
    game_result.classList.add('hidden');
    game_result.textContent = '';
    result.textContent = '';
    turn_indicator.textContent = '';
    turn_indicator.classList.remove('pulse-text');
    
    // Reset the board visuals immediately for better UX
    tiles.forEach(tile => {
        tile.textContent = '';
        tile.classList.remove('clicked', 'winning-tile', 'pulse-animation', 'shake-animation', 
                             'opacity-80', 'x-symbol', 'o-symbol', 'last-move');
        tile.removeAttribute('disabled');
    });
    
    // Then tell the server to reset the game
    resetGame();
});

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to websocket server');
});

socket.on('username_already_exists', () => {
    showError('Username already exists!');
});

socket.on('game_full', () => {
    showError('Game is currently full. Please try again later.');
});

socket.on('symbol_assigned', (symbol) => {
    assignedSymbol = symbol;
    resetErrors();
    currentGameState = 'playing';
    updateUIForGameState();
});

socket.on('players_list_update', (players) => {
    user_container.innerHTML = '';
    const header = document.createElement('h2');
    header.textContent = 'Players';
    header.className = 'text-xl font-bold mb-2 text-center';
    user_container.appendChild(header);
    
    const playersList = document.createElement('div');
    playersList.className = 'flex gap-4 justify-center mb-4';
    
    Object.values(players).forEach((user, index) => {
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
        
        // Update game state to waiting
        currentGameState = 'waiting';
        updateUIForGameState();
    } else if (playersCount === 2 && currentGameState !== 'ended') {
        // If we have 2 players and game is not ended, we should be playing
        currentGameState = 'playing';
        updateUIForGameState();
    }
});

socket.on('board_change', ({board, nextTurnSymbol, lastMove}) => {
    // Update turn indicator with animation
    const isYourTurn = nextTurnSymbol === assignedSymbol;
    turn_indicator.textContent = isYourTurn ? 'Your turn!' : 'Opponent\'s turn!';
    turn_indicator.className = `text-center mb-8 font-bold ${isYourTurn ? 'text-green-600' : 'text-blue-600'} transition-all duration-300`;
    
    if (isYourTurn) {
        turn_indicator.classList.add('pulse-text');
    } else {
        turn_indicator.classList.remove('pulse-text');
    }
    
    // Update board
    tiles.forEach(tile => {
        const row = parseInt(tile.dataset.row) - 1;
        const col = parseInt(tile.dataset.col) - 1;
        const cellValue = board[row][col];
        
        if (cellValue && tile.textContent !== cellValue) {
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
            
            // Highlight the last move
            if (lastMove && row === lastMove[0] && col === lastMove[1]) {
                tile.classList.add('last-move');
                setTimeout(() => {
                    tile.classList.remove('last-move');
                }, 1000);
            }
        }
    });
});

socket.on('game_done', ({result, message, winningCombo}) => {
    currentGameState = 'ended';
    
    // Show game result with animation
    if (result !== 'Draw') {
        game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md text-center text-white font-bold text-xl fade-in';
        game_result.classList.add(result === 'X' ? 'bg-blue-500' : 'bg-red-500');
        highlightWinningCombo(winningCombo);
    } else {
        game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md text-center text-white font-bold text-xl fade-in bg-orange-500';
    }
    
    game_result.textContent = message;
    game_result.classList.remove('hidden');
    
    // Update result text
    result.textContent = message;
    
    // Show confetti for winner
    if (result === assignedSymbol) {
        showConfetti();
    }
    
    preventClicks();
    updateUIForGameState();
});

socket.on('game_reset', () => {
    // Fully reset the game state on server-initiated reset
    resetGame();
    
    // Clear any lingering turn indicators and animations
    turn_indicator.textContent = '';
    turn_indicator.className = 'text-center mb-8';
    turn_indicator.classList.remove('pulse-text');
    result.textContent = '';
    
    // Re-enable the board for new game if we have 2 players
    if (Object.keys(players).length >= 2) {
        currentGameState = 'playing';
    } else {
        currentGameState = 'waiting';
    }
    
    updateUIForGameState();
});

socket.on('player_disconnected', () => {
    if (currentGameState === 'playing') {
        game_result.className = 'p-4 rounded-lg mb-8 mt-8 min-w-md text-center text-white font-bold text-xl fade-in bg-gray-500';
        game_result.textContent = 'Your opponent disconnected!';
        game_result.classList.remove('hidden');
        currentGameState = 'ended';
        updateUIForGameState();
    }
});

// Confetti effect for winners
function showConfetti() {
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
}