import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp,
  where,
  doc,
  deleteDoc,
  getDoc,
  getDocs
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
let playerName = "Anonymous";
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
  easy: { speed: 6, decay: 0.8, multiplier: 1 },
  medium: { speed: 8, decay: 1, multiplier: 2 }, 
  hard: { speed: 12, decay: 1.2, multiplier: 3 }
};

let lastFrameTime = performance.now();

// Authentication functions
async function login(email, password) {
  if (!email || !password) {
    console.error("Login failed: Email or password is empty");
    alert("Please enter both email and password");
    return;
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login successful:", userCredential.user.email);
  } catch (error) {
    console.error("Login failed:", error.code, error.message);
    let message = "Login failed";
    if (error.code === 'auth/invalid-credential') {
      message = "Invalid email or password";
    } else if (error.code === 'auth/user-not-found') {
      message = "No user found with this email";
    } else if (error.code === 'auth/wrong-password') {
      message = "Incorrect password";
    }
    alert(`${message}: ${error.message}`);
  }
}

async function signup(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Signup failed:", error.code, error.message);
    alert("Signup failed: " + error.message);
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Logout failed: " + error.message);
  }
}

function updateUI(user) {
  const loginForm = document.getElementById('login-form');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  
  console.log("Updating UI for user:", user ? user.email : "null");
  
  if (user) {
    loginForm.style.display = 'none';
    userInfo.style.display = 'block';
    userEmail.textContent = user.email;
    document.getElementById('difficulty').style.display = 'flex';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';
    playerName = prompt('What is your name?') || "Anonymous";
  } else {
    loginForm.style.display = 'block';
    userInfo.style.display = 'none';
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

// Consolidated auth state listener
onAuthStateChanged(auth, async (user) => {
  updateUI(user);
  if (user) {
    try {
      resetBall();
      update();
      await showLeaderboard();
      const isUserAdmin = await isAdmin();
      const adminPanel = document.getElementById('admin-panel');
      if (isUserAdmin && adminPanel) {
        adminPanel.style.display = 'block';
        document.getElementById('delete-all-scores')?.addEventListener('click', deleteAllScores);
      } else if (adminPanel) {
        adminPanel.style.display = 'none';
      }
    } catch (error) {
      console.error("Error in auth state change:", error);
    }
  } else {
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.style.display = 'none';
  }
});

// Start game button
document.getElementById("startButton").addEventListener("click", startGame);

function startGame() {
  if (!auth.currentUser) {
    alert("Please login to play the game!");
    return;
  }
  if (gameActive) return;
  enterFullscreen();
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
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  clickFeedback = {
    active: true,
    x: mouseX,
    y: mouseY,
    time: performance.now()
  };
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'red';
  ctx.fill();
  const distance = Math.sqrt((mouseX - ball.x) ** 2 + (mouseY - ball.y) ** 2);
  if (distance <= ball.r * 1.5) {
    catchSound.currentTime = 0;
    catchSound.play();
    score = Math.round(ball.currentSpeed);
    const difficultyLevel = document.getElementById("difficultySelect").value;
    const multiplier = difficulty[difficultyLevel].multiplier;
    saveScore(playerName, score);
    alert(`Caught at ${score}% speed! (${multiplier}x multiplier = ${score * multiplier} points)`);
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
  exitFullscreen();
}

function getRandomColor() {
  return `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
}

async function saveScore(name, score) {
  if (!auth.currentUser) return;
  const baseScore = Math.round(ball.currentSpeed);
  const difficultyLevel = document.getElementById("difficultySelect").value;
  const multiplier = difficulty[difficultyLevel].multiplier;
  const finalScore = baseScore * multiplier;
  if (typeof name !== 'string' || name.length > 20) {
    alert("Invalid name");
    return;
  }
  if (typeof score !== 'number' || score < 0 || score > 1000) {
    alert("Invalid score");
    return;
  }
  await addDoc(collection(db, "scores"), {
    name,
    score: finalScore,
    baseScore: score,
    multiplier: multiplier,
    difficulty: difficultyLevel,
    timestamp: Timestamp.now(),
    userId: auth.currentUser.uid
  });
}

async function showLeaderboard() {
  const q = query(
    collection(db, "scores"),
    orderBy("score", "desc"),
    limit(100)
  );
  let isUserAdmin = false;
  try {
    isUserAdmin = auth.currentUser ? await isAdmin() : false;
  } catch (error) {
    console.error("Failed to check admin status in leaderboard:", error);
  }
  onSnapshot(q, (snapshot) => {
    const leaderboard = document.getElementById('scores-list');
    if (!leaderboard) {
      console.error("Leaderboard element not found");
      return;
    }
    leaderboard.innerHTML = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement("li");
      const scoreText = document.createElement("span");
      scoreText.textContent = `${data.name}: ${data.score}`;
      if (auth.currentUser && (data.userId === auth.currentUser.uid || isUserAdmin)) {
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "×";
        deleteBtn.className = "delete-btn";
        deleteBtn.onclick = () => deleteScore(doc.id, data.userId);
        li.appendChild(scoreText);
        li.appendChild(deleteBtn);
        if (data.userId === auth.currentUser.uid) {
          li.style.backgroundColor = "#ffeeba";
        }
      } else {
        li.appendChild(scoreText);
      }
      leaderboard.appendChild(li);
    });
  }, (error) => {
    console.error("Error in leaderboard snapshot:", error);
  });
}

async function showUserScoreHistory(userId) {
  const userScoresList = document.getElementById('user-scores-list');
  userScoresList.innerHTML = '<li>Loading your scores...</li>';
  const q = query(
    collection(db, "scores"),
    where("userId", "==", userId),
    orderBy("timestamp", "desc"),
    limit(20)
  );
  onSnapshot(q, (snapshot) => {
    userScoresList.innerHTML = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement('li');
      li.style.padding = '5px 0';
      li.style.borderBottom = '1px solid #eee';
      const date = data.timestamp.toDate();
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      const multiplierInfo = data.multiplier > 1 ? 
        ` (${data.baseScore || data.score} × ${data.multiplier})` : '';
      li.textContent = `${data.score}%${multiplierInfo} - ${formattedDate} (${data.difficulty || 'easy'})`;
      userScoresList.appendChild(li);
    });
  });
}

function enterFullscreen() {
  const canvas = document.getElementById("gameCanvas");
  if (canvas.requestFullscreen) {
    canvas.requestFullscreen();
  } else if (canvas.webkitRequestFullscreen) {
    canvas.webkitRequestFullscreen();
  } else if (canvas.msRequestFullscreen) {
    canvas.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
  const isFullscreen = document.fullscreenElement || 
                      document.webkitFullscreenElement || 
                      document.msFullscreenElement;
  if (isFullscreen) {
    resizeCanvas();
  } else {
    resizeCanvas(false);
  }
}

function resizeCanvas(fullscreen = true) {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  if (fullscreen) {
    const scale = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * scale;
    canvas.height = window.innerHeight * scale;
    ctx.scale(scale, scale);
  } else {
    canvas.width = 800;
    canvas.height = 600;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (gameActive) {
    resetBall();
  }
}

async function deleteScore(scoreId, userId) {
  if (!auth.currentUser) {
    console.error("No authenticated user");
    alert("You must be logged in!");
    return;
  }
  const isUserAdmin = await isAdmin();
  if (!isUserAdmin && auth.currentUser.uid !== userId) {
    console.error("Unauthorized attempt to delete score", { scoreId, userId });
    alert("You can only delete your own scores!");
    return;
  }
  try {
    await deleteDoc(doc(db, "scores", scoreId));
    console.log("Score deleted:", scoreId);
    alert("Score deleted successfully!");
  } catch (error) {
    console.error("Error deleting score:", error.code, error.message);
    alert("Error deleting score: " + error.message);
  }
}

async function deleteAllScores() {
  if (!auth.currentUser || !(await isAdmin())) {
    console.error("Admin access required for deleteAllScores");
    alert("Admin access required!");
    return;
  }
  if (!confirm("Are you sure you want to delete ALL scores? This cannot be undone!")) {
    return;
  }
  try {
    const scoresSnapshot = await getDocs(collection(db, "scores"));
    const deletePromises = scoresSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log("All scores deleted");
    alert("All scores deleted successfully!");
  } catch (error) {
    console.error("Error deleting all scores:", error);
    alert("Error deleting scores: " + error.message);
  }
}

async function isAdmin() {
  if (!auth.currentUser) {
    console.log("No authenticated user for admin check");
    return false;
  }
  try {
    const adminDoc = await getDoc(doc(db, "adminUsers", auth.currentUser.uid));
    console.log("Admin check for UID", auth.currentUser.uid, ":", adminDoc.exists() ? "Admin" : "Not admin");
    return adminDoc.exists();
  } catch (error) {
    console.error("Error checking admin status:", error.code, error.message);
    return false;
  }
}