const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;

let myStream = null;
let myPeerId = null;
const peers = {};

// PeerJS bağlantısı - Render.com için optimize edildi
const peer = new Peer({
    host: 'webmeet-0vbv.onrender.com',
    port: 443,
    path: '/peerjs',
    secure: true,
    debug: 3,
    config: {
        'iceServers': [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:stun1.l.google.com:19302' },
            {
                url: 'turn:numb.viagenie.ca',
                credential: 'muazkh',
                username: 'webrtc@live.com'
            }
        ]
    }
});

// Bağlantı yeniden deneme mekanizması
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;

function handlePeerDisconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
        console.log(`Yeniden bağlanmaya çalışılıyor... Deneme: ${reconnectAttempts + 1}`);
        reconnectAttempts++;
        
        // Mevcut peer bağlantısını temizle
        if (peer) {
            peer.destroy();
        }
        
        // 2 saniye bekle ve yeniden bağlan
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } else {
        alert('Bağlantı kurulamadı. Lütfen daha sonra tekrar deneyin.');
    }
}

peer.on('disconnected', () => {
    console.log('Peer bağlantısı koptu');
    handlePeerDisconnect();
});

// Medya bağlantısını başlat
async function startMedia() {
    try {
        // Medya izinlerini kontrol et
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        console.log('Medya erişimi başarılı:', stream);
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
        alert('Kamera veya mikrofon erişimi sağlanamadı! Lütfen tarayıcı izinlerini kontrol edin.');
    }
}

// Peer bağlantısı açıldığında
peer.on('open', id => {
    myPeerId = id;
    console.log('Peer bağlantısı açıldı. ID:', myPeerId);
    socket.emit('join-room', ROOM_ID, id);
    startMedia().catch(err => console.error('startMedia hatası:', err));
});

// Hata durumlarını yakala
peer.on('error', error => {
    console.error('Peer hatası:', error);
    alert('Bağlantı hatası oluştu. Lütfen sayfayı yenileyin.');
});

socket.on('connect_error', (error) => {
    console.error('Socket bağlantı hatası:', error);
});

// Ses kontrolü
function toggleMute() {
    if (myStream) {
        const audioTrack = myStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const muteBtn = document.getElementById('muteBtn');
            muteBtn.innerHTML = `<span class="material-symbols-rounded">
                ${audioTrack.enabled ? 'mic' : 'mic_off'}
            </span>`;
            console.log('Ses durumu:', audioTrack.enabled ? 'açık' : 'kapalı');
        }
    }
}

// Video kontrolü
function toggleVideo() {
    if (myStream) {
        const videoTrack = myStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const videoBtn = document.getElementById('videoBtn');
            videoBtn.innerHTML = `<span class="material-symbols-rounded">
                ${videoTrack.enabled ? 'videocam' : 'videocam_off'}
            </span>`;
            console.log('Video durumu:', videoTrack.enabled ? 'açık' : 'kapalı');
        }
    }
}

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

// Yeni debug fonksiyonu
function checkMediaStatus() {
    if (myStream) {
        const audioTrack = myStream.getAudioTracks()[0];
        const videoTrack = myStream.getVideoTracks()[0];
        console.log('Medya durumu:', {
            audio: audioTrack ? audioTrack.enabled : 'yok',
            video: videoTrack ? videoTrack.enabled : 'yok',
            audioTrackSettings: audioTrack ? audioTrack.getSettings() : null,
            videoTrackSettings: videoTrack ? videoTrack.getSettings() : null
        });
    } else {
        console.log('myStream henüz başlatılmadı');
    }
}

// Her 5 saniyede bir medya durumunu kontrol et
setInterval(checkMediaStatus, 5000); 
