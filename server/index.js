const http = require('http').createServer();

const io = require('socket.io')(http, {
    cors:{
        origin: "*"
    }
});

let players = {};
io.on('connection', (socket) => {
    socket.on('user_join', (username)=>{
        let players_count = Object.keys(players).length;
        if(players_count >= 2){
            socket.emit('game_full');
            return;
        }
        const symbol = players_count === 0 ? 'X' : 'O';
        players[socket.id] = {username, symbol};
        console.log(`Player ${username} joined as ${symbol}`);
        console.log(players);
        socket.emit('symbol_assigned', symbol);
        io.emit('players_list_update',players);
    })

    socket.on('disconnect', () => {
        console.log(`Player disconnected ! : ${socket.id}`);
        delete players[socket.id];
        io.emit('players_list_update',players);
    })

})



http.listen(8080, () => console.log('listening on http://localhost:8080/'));