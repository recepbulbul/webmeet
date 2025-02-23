const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;

let myStream = null;
let myPeerId = null;
const peers = {};

// PeerJS bağlantısı
const peer = new Peer(undefined, {
    host: '/',
    path: '/peerjs',
    port: location.port || (location.protocol === 'https:' ? 443 : 80),
    secure: location.protocol === 'https:'
});

// Medya bağlantısını başlat
async function startMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        myStream = stream;
        addVideoStream(myVideo, stream, 'Ben');

        // Gelen aramaları yanıtla
        peer.on('call', call => {
            console.log('Gelen arama:', call.peer);
            call.answer(stream);
            
            const video = document.createElement('video');
            call.on('stream', userVideoStream => {
                if (!document.querySelector(`[data-peer-id="${call.peer}"]`)) {
                    addVideoStream(video, userVideoStream, `Kullanıcı ${call.peer.slice(0, 5)}`, call.peer);
                }
            });
        });

    } catch (err) {
        console.error('Medya erişim hatası:', err);
        alert('Kamera veya mikrofon erişimi sağlanamadı!');
    }
}

// Peer bağlantısı açıldığında
peer.on('open', id => {
    myPeerId = id;
    console.log('Benim Peer ID:', myPeerId);
    socket.emit('join-room', ROOM_ID, id);
    startMedia();
});

// Socket olayları
socket.on('user-connected', userId => {
    console.log('Yeni kullanıcı bağlandı:', userId);
    if (userId !== myPeerId && myStream) {
        connectToNewUser(userId, myStream);
    }
});

// Yeni kullanıcıya bağlan
function connectToNewUser(userId, stream) {
    if (peers[userId]) return;
    
    console.log('Yeni kullanıcıya bağlanılıyor:', userId);
    const call = peer.call(userId, stream);
    const video = document.createElement('video');

    call.on('stream', userVideoStream => {
        if (!document.querySelector(`[data-peer-id="${userId}"]`)) {
            addVideoStream(video, userVideoStream, `Kullanıcı ${userId.slice(0, 5)}`, userId);
            peers[userId] = call;
        }
    });

    call.on('close', () => {
        removeVideo(userId);
    });
}

function addVideoStream(video, stream, username, peerId = null) {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    if (peerId) {
        videoContainer.setAttribute('data-peer-id', peerId);
    }
    
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.error('Video oynatma hatası:', e));
    });
    
    const nameOverlay = document.createElement('div');
    nameOverlay.className = 'participant-name';
    nameOverlay.textContent = username;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(nameOverlay);
    videoGrid.appendChild(videoContainer);
    
    updateVideoLayout();
}

function removeVideo(userId) {
    const videoContainer = document.querySelector(`[data-peer-id="${userId}"]`);
    if (videoContainer) {
        videoContainer.remove();
        if (peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
        updateVideoLayout();
    }
}

// Kullanıcı ayrıldığında
socket.on('user-disconnected', userId => {
    console.log('Kullanıcı ayrıldı:', userId);
    removeVideo(userId);
});

function updateVideoLayout() {
    const containers = document.querySelectorAll('.video-container');
    containers.forEach(container => container.classList.remove('main-video'));
    
    if (containers.length === 1) {
        containers[0].classList.add('main-video');
    }
}

// Ses kontrolü
function toggleMute() {
    if (myStream) {
        const audioTrack = myStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        const muteBtn = document.getElementById('muteBtn');
        muteBtn.innerHTML = `<span class="material-symbols-rounded">
            ${audioTrack.enabled ? 'mic' : 'mic_off'}
        </span>`;
    }
}

// Video kontrolü
function toggleVideo() {
    if (myStream) {
        const videoTrack = myStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        const videoBtn = document.getElementById('videoBtn');
        videoBtn.innerHTML = `<span class="material-symbols-rounded">
            ${videoTrack.enabled ? 'videocam' : 'videocam_off'}
        </span>`;
    }
}

// Odadan ayrılma
function leaveRoom() {
    if (confirm('Görüşmeden ayrılmak istediğinize emin misiniz?')) {
        // Tüm medya akışlarını kapat
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
        }
        
        // Tüm peer bağlantılarını kapat
        for (let userId in peers) {
            peers[userId].close();
        }
        
        // Socket bağlantısını kapat
        socket.disconnect();
        
        // Ana sayfaya yönlendir
        window.location.href = '/';
    }
}

// Oda ID kopyalama
function copyRoomId() {
    const roomInput = document.getElementById('roomId');
    roomInput.select();
    document.execCommand('copy');
    
    // Kopyalama animasyonu
    const copyBtn = document.querySelector('.icon-button i');
    copyBtn.textContent = 'check';
    setTimeout(() => {
        copyBtn.textContent = 'content_copy';
    }, 2000);
}

// Hata yakalama
peer.on('error', err => {
    console.error('Peer bağlantı hatası:', err);
});

socket.on('connect_error', err => {
    console.error('Socket bağlantı hatası:', err);
}); 
