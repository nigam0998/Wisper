// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const getStartedBtn = document.getElementById('get-started-btn');
const setupScreen = document.getElementById('setup-screen');
const chatScreen = document.getElementById('chat-screen');
const createBtn = document.getElementById('create-btn');
const linkContainer = document.getElementById('link-container');
const shareLinkInput = document.getElementById('share-link');
const copyBtn = document.getElementById('copy-btn');
const joinSection = document.getElementById('join-section');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

// Sidebar Elements
const chatSidebar = document.querySelector('.chat-sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const sidebarShareLink = document.getElementById('sidebar-share-link');
const sidebarCopyBtn = document.getElementById('sidebar-copy-btn');
const sidebarStatusVal = document.getElementById('sidebar-status-val');
const newChatBtn = document.getElementById('new-chat-btn');

// Cryptography/Passcode Elements
const setupPasscodeContainer = document.getElementById('setup-passcode-container');
const setupPasscode = document.getElementById('setup-passcode');
const regenPasscodeBtn = document.getElementById('regen-passcode-btn');
const joinPasscodeContainer = document.getElementById('join-passcode-container');
const joinPasscode = document.getElementById('join-passcode');
const joinConnectBtn = document.getElementById('join-connect-btn');
const guestConnectingStatus = document.getElementById('guest-connecting-status');

// WebRTC State
let peerConnection;
let dataChannel;
let signalingSocket;
let isHost = false;
let roomID = null;
let typingTimeout = null;

// Cryptography State
let chatPasscode = null;
let derivedAESKey = null;
const CRYPTO_SALT = new TextEncoder().encode("WhisperSecureP2PSaltHex");

const signalingUrl = 'ws://127.0.0.1:8080';
const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// --- Web Crypto PBKDF2 & AES-GCM Key Helpers ---
async function deriveKeyFromPasscode(passcode) {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(passcode),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: CRYPTO_SALT,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptPayload(plaintext, aesKey) {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        encoder.encode(plaintext)
    );

    // Convert IV and Ciphertext buffer to safe Base64 transmission formats
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

    return {
        iv: ivBase64,
        ciphertext: ciphertextBase64
    };
}

async function decryptPayload(payload, aesKey) {
    try {
        if (!payload.iv || !payload.ciphertext) {
            throw new Error("Invalid AES-GCM envelope formats");
        }

        // Decode Base64
        const iv = new Uint8Array(atob(payload.iv).split("").map(c => c.charCodeAt(0)));
        const ciphertext = new Uint8Array(atob(payload.ciphertext).split("").map(c => c.charCodeAt(0)));

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            ciphertext
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        console.error("AES-GCM Decryption failure:", err);
        return "[Error: Decryption failed. Incorrect or modified passcode key]";
    }
}

// Generate an elegant, human-readable random passcode key (6 characters, base-36)
function generatePasscode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Initialize App
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    roomID = urlParams.get('room');

    if (roomID) {
        // Guest mode
        isHost = false;
        welcomeScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
        document.getElementById('host-section').classList.add('hidden');
        joinSection.classList.remove('hidden');
        
        // Zero-friction check: Retrieve passcode from URL hash (#passcode)
        const hashPasscode = window.location.hash.substring(1);
        if (hashPasscode) {
            chatPasscode = hashPasscode;
            joinPasscodeContainer.classList.add('hidden');
            guestConnectingStatus.classList.remove('hidden');
            
            // Sync guest sidebar link (with passcode preserved in hash!)
            sidebarShareLink.value = window.location.href;
            
            deriveKeyFromPasscode(chatPasscode).then(key => {
                derivedAESKey = key;
                connectSignaling();
            });
        } else {
            // No hash found, prompt Guest for manual passcode entry
            joinPasscodeContainer.classList.remove('hidden');
            guestConnectingStatus.classList.add('hidden');
            
            joinConnectBtn.addEventListener('click', () => {
                const enteredPasscode = joinPasscode.value.trim();
                if (!enteredPasscode) {
                    alert('Please enter a passcode key to decrypt messages.');
                    return;
                }
                
                chatPasscode = enteredPasscode;
                joinPasscodeContainer.classList.add('hidden');
                guestConnectingStatus.classList.remove('hidden');
                
                // Construct guest sidebar invite link (with custom passcode in hash)
                sidebarShareLink.value = `${window.location.origin}/?room=${roomID}#${chatPasscode}`;
                
                deriveKeyFromPasscode(chatPasscode).then(key => {
                    derivedAESKey = key;
                    connectSignaling();
                });
            });
        }
    } else {
        // Host mode
        isHost = true;
        
        // Auto-generate a beautiful secure passcode
        const autoPasscode = generatePasscode();
        setupPasscode.value = autoPasscode;
        
        createBtn.addEventListener('click', () => {
            const enteredPasscode = setupPasscode.value.trim();
            if (!enteredPasscode) {
                alert('Please enter or generate a passcode to secure the chat room.');
                return;
            }
            
            chatPasscode = enteredPasscode;
            setupPasscodeContainer.classList.add('hidden');
            generateRoom();
        });
        
        regenPasscodeBtn.addEventListener('click', () => {
            setupPasscode.value = generatePasscode();
        });
    }

    // Welcome Screen Transition
    getStartedBtn.addEventListener('click', () => {
        welcomeScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
    });

    // Chat Event Listeners
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = messageInput.value.trim().length === 0;
        sendTypingState(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => sendTypingState(false), 2000);
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !sendBtn.disabled) {
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
    copyBtn.addEventListener('click', () => copyLink(shareLinkInput, copyBtn));
    sidebarCopyBtn.addEventListener('click', () => copyLink(sidebarShareLink, sidebarCopyBtn));

    // Mobile Sidebar Drawer Toggles
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            chatSidebar.classList.add('active');
        });
    }

    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => {
            chatSidebar.classList.remove('active');
        });
    }

    // New Chat Button (Disconnects current session and returns home)
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            if (confirm('Start a new chat session? Your current encrypted channel will close.')) {
                if (dataChannel) dataChannel.close();
                window.location.href = window.location.origin;
            }
        });
    }
}

function generateRoom() {
    roomID = Math.random().toString(36).substring(2, 10);
    
    // Embed passcode into location hash parameter for zero-friction client-side key transfer
    const joinLink = `${window.location.origin}/?room=${roomID}#${chatPasscode}`;
    shareLinkInput.value = joinLink;
    sidebarShareLink.value = joinLink;
    
    createBtn.classList.add('hidden');
    linkContainer.classList.remove('hidden');

    deriveKeyFromPasscode(chatPasscode).then(key => {
        derivedAESKey = key;
        connectSignaling();
    });
}

function copyLink(inputElement, buttonElement) {
    inputElement.select();
    document.execCommand('copy');
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Copied!';
    buttonElement.style.background = 'var(--green)';
    setTimeout(() => { 
        buttonElement.textContent = originalText; 
        buttonElement.style.background = '';
    }, 2000);
}

function connectSignaling() {
    if (sidebarStatusVal) {
        sidebarStatusVal.textContent = 'Connecting...';
    }

    signalingSocket = new WebSocket(signalingUrl);

    signalingSocket.onopen = () => {
        console.log('Connected to signaling server');
        signalingSocket.send(JSON.stringify({
            type: 'join',
            room: roomID,
            role: isHost ? 'host' : 'guest'
        }));

        if (!isHost) {
            // Guest initiates the WebRTC offer
            setupWebRTC();
            createOffer();
        }
    };

    signalingSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'peer_joined') {
            console.log('Peer joined, setting up WebRTC');
            if (sidebarStatusVal) {
                sidebarStatusVal.textContent = 'Securing Pipe...';
            }
            setupWebRTC();
        } else if (message.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingSocket.send(JSON.stringify({
                type: 'answer',
                room: roomID,
                role: isHost ? 'host' : 'guest',
                answer: answer
            }));
        } else if (message.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.type === 'candidate') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
    };

    signalingSocket.onerror = (err) => {
        console.error('Signaling error:', err);
        if (sidebarStatusVal) {
            sidebarStatusVal.textContent = 'Signaling Offline';
        }
    };
}

function setupWebRTC() {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingSocket.send(JSON.stringify({
                type: 'candidate',
                room: roomID,
                role: isHost ? 'host' : 'guest',
                candidate: event.candidate
            }));
        }
    };

    if (isHost) {
        // Host waits for data channel from guest
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    } else {
        // Guest creates data channel
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel();
    }
}

async function createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingSocket.send(JSON.stringify({
        type: 'offer',
        room: roomID,
        role: 'guest',
        offer: offer
    }));
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        console.log('Data channel is open');
        
        // Transition UI to chat
        setupScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        
        if (sidebarStatusVal) {
            sidebarStatusVal.textContent = 'Double Secure';
        }

        // Disconnect signaling server since P2P is established
        if (signalingSocket) {
            signalingSocket.close();
        }
    };

    dataChannel.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                // Decrypt AES-GCM envelope
                const plaintext = await decryptPayload(data.payload, derivedAESKey);
                appendMessage(plaintext, 'received');
            } else if (data.type === 'typing') {
                if (data.isTyping) {
                    typingIndicator.classList.remove('hidden');
                    chatContainerScrollBottom();
                } else {
                    typingIndicator.classList.add('hidden');
                }
            }
        } catch (err) {
            console.error('Error handling channel message:', err);
        }
    };

    dataChannel.onclose = () => {
        if (sidebarStatusVal) {
            sidebarStatusVal.textContent = 'Disconnected';
        }
        alert('Chat disconnected.');
        window.location.search = ''; // reset
    };
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // Encrypt content using 256-bit AES-GCM derived key
    const envelope = await encryptPayload(text, derivedAESKey);

    // Send payload wrapped in structural metadata envelope
    dataChannel.send(JSON.stringify({ 
        type: 'message', 
        payload: envelope 
    }));
    
    // Add plaintext to Host/Guest UI local bubble
    appendMessage(text, 'sent');
    
    // Clear input
    messageInput.value = '';
    sendBtn.disabled = true;
    sendTypingState(false);
}

function appendMessage(text, type) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${type}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    
    wrapper.appendChild(bubble);
    messagesContainer.appendChild(wrapper);
    chatContainerScrollBottom();
}

function sendTypingState(isTyping) {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'typing', isTyping }));
    }
}

function chatContainerScrollBottom() {
    const container = document.getElementById('chat-container');
    container.scrollTop = container.scrollHeight;
}

// Start app
init();
