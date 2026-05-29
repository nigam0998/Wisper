# 💬 Whisper — Secure Peer-to-Peer Chat

A beautiful, responsive, and **serverless end-to-end encrypted real-time chat application** built using **WebRTC peer-to-peer data channels and HTML5/Vanilla CSS/JavaScript**.

This project demonstrates how two clients can establish a direct, zero-knowledge communication pipe directly between their browsers. An ultra-lightweight WebSockets signaling server is used solely to facilitate the initial WebRTC handshake (offer, answer, and ICE candidate exchanges), after which the clients communicate directly without any server intermediary.

---

## 🚀 Features

* 🔐 **True P2P Privacy:** Messages are end-to-end encrypted and transmitted directly from browser to browser.
* 🖥️ **Responsive Dashboard Design:** Full-screen responsive grid layout with a rich left panel showcasing room parameters, connection diagnostics, and copyable links.
* 📱 **Mobile Drawer UI:** On smaller screens, the sidebar slides gracefully out of view and can be toggled using a modern drawer animation.
* 🌓 **Automatic Dark/Light Mode:** Full custom-themed stylesheet utilizing advanced HSL variables reacting seamlessly to system color preferences.
* ⚡ **Live Diagnostics:** Integrated session statistics detailing WebRTC state changes and transmission channels.
* 💬 **Real-time Indicators:** Micro-animations for message transit and a fluid custom-typing bubble.
* 🔄 **Serverless Relay:** Disconnects the signaling server immediately once the direct connection is established, ensuring maximum efficiency.

---

## 🛠️ Tech Stack

* **Frontend:** Vanilla HTML5, CSS3 Grid/Flexbox, ES6 JavaScript, Vite
* **Backend (Signaling):** Python, `websockets`, `asyncio`
* **Protocol:** WebRTC Data Channels (reliable, encrypted P2P data transport)
* **Fonts:** Outfit, Plus Jakarta Sans (Google Fonts)

---

## 📂 Project Structure

```
TCP-chat-application/
│── signaling_server.py     # WebSockets signaling server for WebRTC
│── client-app/             # Modern Vite/JavaScript web application
│   ├── src/                # Source assets/scripts
│   ├── index.html          # Chat interface UI
│   ├── style.css           # Premium responsive CSS stylesheet with glassmorphism
│   └── main.js             # WebRTC peer-to-peer connection logic
└── README.md
```

---

## ▶️ How to Run

### 1️⃣ Start the Signaling Server

Ensure Python and the `websockets` library are installed, then run:
```bash
python signaling_server.py
```

### 2️⃣ Start the Frontend Client

Navigate to the `client-app` directory and start the Vite development server:
```bash
cd client-app
npm run dev
```

### 3️⃣ Create or Join a Chat Room 🎉
- Open `http://localhost:5173/` in your browser.
- Click **Get Started** then **Start New Chat** to generate a unique room link.
- Open the generated link in a second browser window (or share it with a friend) to initiate a secure, end-to-end encrypted WebRTC channel!

---

## 💡 How It Works under the Hood

1. **Room Creation:** The Host creates a room which generates a random Room ID. The Host joins the room on the Python signaling server.
2. **Handshake Initialization:** The Guest loads the shared room link, connects to the signaling server, and immediately creates a WebRTC Offer.
3. **Offer Relay:** The signaling server forwards the Offer to the Host. The Host sets the remote session description, generates a WebRTC Answer, and relays it back to the Guest.
4. **ICE Candidate Exchange:** Both clients discover their network paths (ICE Candidates) and exchange them via the signaling server to establish direct contact.
5. **Direct Channel & Disconnect:** Once a direct WebRTC Data Channel is open, the WebSockets signaling connection is closed. Messages fly directly between browsers over an encrypted channel.

---

## 🧑‍💻 Author

**Devyansh Nigam**

---

<!-- Whisper Secure P2P Chat -->
