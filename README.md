<div align="center">
  <h2>🔴 🟢 <img src="https://media.giphy.com/media/l4hLAq7N67R5b8rO8/giphy.gif" alt="Rolling Dice Animation" width="80" style="vertical-align: middle; margin: 0 15px;"/> 🟡 🔵</h2>
  <h1>🎲 Ludo Royale</h1>
  <p><strong>A sleek, modern, real-time multiplayer Ludo game built with React, Node.js, and WebRTC Voice Chat!</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="NodeJS" />
    <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
    <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC" />
  </p>
</div>

---

## ✨ Features

- 🎮 **Real-time Multiplayer:** Play instantly with friends using room codes.
- 🎙️ **In-Game Voice Chat:** Talk to your opponents in real-time using WebRTC.
- 🎲 **Authentic Gameplay:** Classic Ludo rules including "three 6s in a row skips your turn".
- 💾 **State Persistence:** Never lose a game halfway! Game states are saved to MongoDB.
- 🎨 **Modern UI/UX:** Eye-catching design with smooth token animations.

## 🚀 Tech Stack

### Frontend
- **React.js** with React Router
- **CSS3** (Custom Modern Styling & Animations)
- **WebRTC** (Peer-to-Peer Voice Chat)
- **Lucide Icons**

### Backend
- **Node.js & Express**
- **Socket.io** (Real-time events: dice rolls, token moves, turn switching)
- **MongoDB + Mongoose** (Database)

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16+)
- MongoDB (Local or Atlas URL)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/ludo-royale.git
cd ludo-royale
```

### 2. Setup the Backend
```bash
cd backend
npm install
```
- Create a `.env` file in the `backend` folder and add your MongoDB URL and Port:
  ```env
  PORT=5000
  MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ludo?retryWrites=true&w=majority
  ```
- Start the server:
  ```bash
  npm run dev
  ```

### 3. Setup the Frontend
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

## 📜 How to Play

1. **Host a Game:** Create a room and share the room code with your friends.
2. **Join a Game:** Friends can join your lobby using the code.
3. **Roll the Dice:** The game will automatically assign colors and turns.
4. **Win:** Get all four of your tokens safely home!
   - *Rule Twist:* If you roll three 6s consecutively, your turn gets cancelled immediately!

## 📁 Folder Structure

```
ludo/
├── backend/            # Express server, Socket.io event handlers, Game Logic
│   ├── gameLogic/      # Ludo core logic (Game.js)
│   ├── models/         # MongoDB schemas
│   └── server.js       # Main server entry
└── frontend/           # React App
    ├── src/
    │   ├── components/ # Board, Dice, Game, Lobby, VoiceChat
    │   ├── context/    # Global Socket connection state
    │   └── App.jsx     # Main routes
```

## 👨‍💻 Author

Developed with ❤️ by **Aditya Kumar Sinha**
- Copyright &copy; 2026 All rights reserved.

---
<div align="center">
  <i>"Roll the dice, make your move, and dominate the board."</i>
</div>
