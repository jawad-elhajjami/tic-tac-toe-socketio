// HTML ELEMENTS
const username = document.getElementById('username');
const start_game_btn = document.getElementById('start_game_btn');
const board_container = document.getElementById('board_container');
const form_container = document.getElementById('form_container');
const error_container = document.getElementById('error');
const turn = document.getElementById('turn');
const restart = document.getElementById('restart');
const result = document.getElementById('result');
const tiles = document.querySelectorAll('.tile');

const socket = io('http://localhost:8080');

// GLOBAL VARS
let currentLetter = 'X';
let color = 'text-blue-500';
let winner;
let players_count;

socket.on('players_list_update', (players) => {
    players_count = Object.keys(players).length;
    console.log(players_count);
})


let board = [
    ['','',''],
    ['','',''],
    ['','','']
];

// ALL POSSIBLE WINNING COMBOS
const winningCombos = [
    // Rows
    [[0,0], [0,1], [0,2]],
    [[1,0], [1,1], [1,2]],
    [[2,0], [2,1], [2,2]],
    // Columns
    [[0,0], [1,0], [2,0]],
    [[0,1], [1,1], [2,1]],
    [[0,2], [1,2], [2,2]],
    // Diagonals
    [[0,0], [1,1], [2,2]],
    [[0,2], [1,1], [2,0]],
];

// initialize game
const init = () => {
    board_container.classList.add('hidden');
    restart.classList.add('hidden');
}

// reset errors
const reset_errors = () =>{
    error_container.textContent = '';
}

init();

const validate_username = () => {
    if(username.value === '' || username.value == null){
        error_container.textContent = 'Username is required !'
        return 'Username is required !';
    }
    return 'Valid'
}

const start_game = () => {
    
    // make sure only 2 players can join and play together
    if(players_count === 2){
        alert('Game is full at the moment !')
        return;
    }

    if(validate_username() === 'Valid'){

        socket.emit('user_join', username.value)

        board_container.classList.remove('hidden');
        reset_errors();
    }
    else hide_board();
    
}


// game logic
const check_if_clicked = (tile) => {
    if(tile.classList.contains('clicked')){
        return true;
    }return false;
}


const handleTileClick = (event) => {   
    let clickedTile = event.target;
    if(!check_if_clicked(clickedTile)){
        let row = parseInt(event.target.dataset.row);
        let col = parseInt(event.target.dataset.col);
        clickedTile.textContent = currentLetter;
        
        
        // switch letter (X/O)
        currentLetter = currentLetter === 'X' ? currentLetter = 'O' : 'X';
        color = color === 'text-blue-500' ? color = 'text-red-500' : 'text-blue-500';
        clickedTile.setAttribute('disabled', true);
        clickedTile.classList.add(color);
        clickedTile.classList.add('clicked');
        board[row - 1][col - 1] = clickedTile.textContent;
        turn.textContent = `it's (${currentLetter}'s turn) `

        // constantly check winner on each turn
        check_winner();
        
    }else alert('already clicked here !');
}

const resetGame = () => {
    turn.remove();
    result.textContent = `${winner} is the Winner`
    board_container.remove();
    form_container.remove();
    restart.classList.remove('hidden');
}

const check_winner = () => {
        
        for(const combo of winningCombos){
            const [a,b,c] = combo;
            const cellA = board[a[0]][a[1]];
            const cellB = board[b[0]][b[1]];
            const cellC = board[c[0]][c[1]];
            if(cellA !== '' && cellA === cellB && cellB === cellC) winner = cellA;
        }
        if(winner !== undefined) {
            resetGame();
            return winner;
        }
        // it's a draw
        else if(board.every(row => row.every(col => col !== ''))){
            resetGame();
            result.textContent = `It's a draw !`
            return;
        }return false
}

// events

start_game_btn.addEventListener('click', (event) => {
    event.preventDefault();
    start_game();
})

tiles.forEach((tile) => {
    tile.addEventListener('click', (event) => handleTileClick(event))
})

socket.on('connect', () => {
    console.log('Connected to websocket server')
})

socket.on('user_join', username => {
    let el = document.createElement('p');
    el.textContent = username;
    document.body.appendChild(el);
})

socket.on('symbol_assigned', (symbol) => {
    currentLetter = symbol;
    console.log('You are ', symbol);
})

// socket.on('game_full', () => {
//     alert('You cant play now join later please !');
//     return;
// });