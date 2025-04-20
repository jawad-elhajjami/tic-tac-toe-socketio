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

        const alreadyExists = () => {
            return Object.values(players).some(val => val.username.toLowerCase() === username.toLowerCase());
        }

        if(!alreadyExists()){
            const symbol = players_count === 0 ? 'X' : 'O';
            players[socket.id] = {username, symbol};
            socket.emit('symbol_assigned', symbol);
            io.emit('players_list_update',players);
        }else{
            socket.emit('username_alreay_exits');
        }
        
    })

    socket.on('disconnect', () => {
        console.log(`Player disconnected ! : ${socket.id}`);
        delete players[socket.id];
        io.emit('players_list_update',players);
    })

})



http.listen(8080, () => console.log('listening on http://localhost:8080/'));