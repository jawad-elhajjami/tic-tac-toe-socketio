const http = require('http').createServer();

const io = require('socket.io')(http, {
    cors:{
        origin: "*"
    }
});

io.on('connection', (socket) => {
    socket.on('user_join', (username)=>{
        console.log('username : ', username);
    })
})



http.listen(8080, () => console.log('listening on http://localhost:8080/'));