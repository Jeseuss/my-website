import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDtKRlsPmdOMtzY_ESJFq3JiduLPPbz1QQ",
  authDomain: "dbfinal-9fadb.firebaseapp.com",
  projectId: "dbfinal-9fadb",
  storageBucket: "dbfinal-9fadb.appspot.com",
  messagingSenderId: "980549293595",
  appId: "1:980549293595:web:17876489c9aeea26e78abe"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Audio elements
const bgMusic = document.getElementById("backgroundMusic");
const catchSound = document.getElementById("catchSound");
const missSound = document.getElementById("missSound");
const musicToggle = document.getElementById("musicToggle");

// Music control
let musicOn = true;
bgMusic.volume = 0.5;

musicToggle.addEventListener("click", () => {
  musicOn = !musicOn;
  musicToggle.textContent = musicOn ? "♪" : "🔇";
  if (musicOn) {
    bgMusic.play();
  } else {
    bgMusic.pause();
  }
});

// Game setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let ballVisible = false;
let clickFeedback = { active: false, x: 0, y: 0, time: 0 };
let playerName = "Anonymous"; // Will be set after login
let score = 0;
let attemptsLeft = 3;
let gameActive = false;
let speedDecayInterval;

// Ball physics
let ball = { 
  x: 0, y: 0,
  r: 15, 
  color: "blue", 
  vx: 0, vy: 0,
  currentSpeed: 100
};

let BASE_SPEED = 8;
let SPEED_DECAY_RATE = 1;

const difficulty = {
  easy: { speed: 6, decay: 0.8 },
  medium: { speed: 8, decay: 1 }, 
  hard: { speed: 12, decay: 1.2 }
};

let lastFrameTime = performance.now();

// Authentication functions
async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}

async function signup(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Signup failed: " + error.message);
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    alert("Logout failed: " + error.message);
  }
}

// Update UI based on auth state
function updateUI(user) {
  const loginForm = document.getElementById('login-form');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  
  if (user) {
    // User is logged in
    loginForm.style.display = 'none';
    userInfo.style.display = 'block';
    userEmail.textContent = user.email;
    
    // Enable game elements
    document.getElementById('difficulty').style.display = 'flex';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';
    
    // Prompt for player name
    playerName = prompt("What do your friends call you?") || "Anonymous";
  } else {
    // User is logged out
    loginForm.style.display = 'block';
    userInfo.style.display = 'none';
    
    // Disable game elements
    document.getElementById('difficulty').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('leaderboard').style.display = 'none';
  }
}

// Set up auth event listeners
document.getElementById('login-btn').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  login(email, password);
});

document.getElementById('signup-btn').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  signup(email, password);
});

document.getElementById('logout-btn').addEventListener('click', logout);

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  updateUI(user);
});

// Start game button
document.getElementById("startButton").addEventListener("click", startGame);

function startGame() {
  if (!auth.currentUser) {
    alert("Please login to play the game!");
    return;
  }
  
  if (gameActive) return;
  if (musicOn) {
    bgMusic.currentTime = 0;
    bgMusic.play();
  }
  
  const difficultyLevel = document.getElementById("difficultySelect").value;
  
  gameActive = true;
  attemptsLeft = 3;
  score = 0;
  ballVisible = true;
  
  resetBall();
  ball.currentSpeed = 100;
  BASE_SPEED = difficulty[difficultyLevel].speed;
  SPEED_DECAY_RATE = difficulty[difficultyLevel].decay;
  
  do {
    ball.vx = (Math.random() * 2 - 1) * BASE_SPEED;
    ball.vy = (Math.random() * 2 - 1) * BASE_SPEED;
  } while (Math.abs(ball.vx) < 0.5 || Math.abs(ball.vy) < 0.5);
  
  if (speedDecayInterval) clearInterval(speedDecayInterval);
  speedDecayInterval = setInterval(() => {
    if (gameActive) {
      ball.currentSpeed = Math.max(20, ball.currentSpeed - SPEED_DECAY_RATE);
      updateSpeed();
    }
  }, 1000);
  
  lastFrameTime = performance.now();
  update();
}

function resetBall() {
  ball.x = Math.max(ball.r, Math.min(canvas.width - ball.r, Math.random() * canvas.width));
  ball.y = Math.max(ball.r, Math.min(canvas.height - ball.r, Math.random() * canvas.height));
  ball.color = getRandomColor();
  ballVisible = true;
}

function updateSpeed() {
  const speedFactor = ball.currentSpeed / 100;
  const directionX = ball.vx === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(ball.vx);
  const directionY = ball.vy === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(ball.vy);
  
  ball.vx = directionX * BASE_SPEED * speedFactor;
  ball.vy = directionY * BASE_SPEED * speedFactor;
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (gameActive) {
    const now = performance.now();
    const deltaTime = (now - lastFrameTime) / 16;
    lastFrameTime = now;
    
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;
    
    if (ball.x < ball.r) {
      ball.x = ball.r;
      ball.vx *= -1;
      ball.color = getRandomColor();
    } else if (ball.x > canvas.width - ball.r) {
      ball.x = canvas.width - ball.r;
      ball.vx *= -1;
      ball.color = getRandomColor();
    }
    
    if (ball.y < ball.r) {
      ball.y = ball.r;
      ball.vy *= -1;
      ball.color = getRandomColor();
    } else if (ball.y > canvas.height - ball.r) {
      ball.y = canvas.height - ball.r;
      ball.vy *= -1;
      ball.color = getRandomColor();
    }
  }
  
  if (ballVisible) {
    drawBall();
  }
  
  if (clickFeedback.active) {
    const fade = 1 - (performance.now() - clickFeedback.time) / 500;
    if (fade > 0) {
      ctx.beginPath();
      ctx.arc(clickFeedback.x, clickFeedback.y, 30 * fade, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 0, 0, ${fade})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      clickFeedback.active = false;
    }
  }
  
  drawSpeedMeter();
  requestAnimationFrame(update);
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
}

function drawSpeedMeter() {
  ctx.fillStyle = "black";
  ctx.font = "16px Arial";
  ctx.fillText(`Speed: ${Math.round(ball.currentSpeed)}%`, 20, 30);
  ctx.fillText(`Attempts: ${attemptsLeft}`, 20, 60);
}

canvas.addEventListener("click", (e) => {
  if (!gameActive || !auth.currentUser) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  clickFeedback = {
    active: true,
    x: mouseX,
    y: mouseY,
    time: performance.now()
  };
  
  const distance = Math.sqrt((mouseX - ball.x) ** 2 + (mouseY - ball.y) ** 2);
  
  if (distance <= ball.r * 1.5) {
    catchSound.currentTime = 0;
    catchSound.play();
    score = Math.round(ball.currentSpeed);
    saveScore(playerName, score);
    alert(`Caught at ${score}% speed!`);
    endGame();
  } else {
    missSound.currentTime = 0;
    missSound.play();
    attemptsLeft--;
    document.getElementById("score").textContent = `Attempts: ${attemptsLeft}`;
    
    if (attemptsLeft <= 0) {
      alert("Game over!");
      endGame();
    }
  }
});

function endGame() {
  bgMusic.pause();
  gameActive = false;
  clearInterval(speedDecayInterval);
  ball.vx = 0;
  ball.vy = 0;
}

function getRandomColor() {
  return `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
}

async function saveScore(name, score) {
  if (!auth.currentUser) return;
  
  await addDoc(collection(db, "scores"), {
    name,
    score,
    timestamp: Timestamp.now(),
    userId: auth.currentUser.uid
  });
}

function showLeaderboard() {
  const q = query(
    collection(db, "scores"),
    orderBy("score", "desc"),
    limit(10)
  );
  
  onSnapshot(q, (snapshot) => {
    const leaderboard = document.getElementById("scores-list");
    leaderboard.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = `${doc.data().name}: ${doc.data().score}`;
      leaderboard.appendChild(li);
    });
  });
}

// Initialize
resetBall();
update();
showLeaderboard();