const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { ExpressPeerServer } = require('peer');
const { v4: uuidV4 } = require('uuid');

const port = process.env.PORT || 3000;

// PeerJS sunucusu
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/peerjs',
    ssl: {
        key: null,
        cert: null
    }
});

app.use('/peerjs', peerServer);
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.json());

// CORS ayarlarını ekleyelim
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/room/:room', (req, res) => {
    res.render('room', { roomId: req.params.room });
});

app.get('/:room', (req, res) => {
    res.redirect('/');
});

// Oda oluşturma endpoint'i
app.post('/create-room', (req, res) => {
    const roomId = uuidV4();
    res.json({ roomId });
});

io.on('connection', socket => {
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.broadcast.to(roomId).emit('user-connected', userId);

        socket.on('disconnect', () => {
            socket.broadcast.to(roomId).emit('user-disconnected', userId);
        });
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 
