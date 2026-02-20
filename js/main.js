import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  increment
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
const successSound = document.getElementById("successSound");
const failSound = document.getElementById("failSound");
const musicToggle = document.getElementById("musicToggle");

// Music control
let musicOn = true;
bgMusic.volume = 0.3;

musicToggle.addEventListener("click", () => {
  musicOn = !musicOn;
  musicToggle.textContent = musicOn ? "♪" : "🔇";
  if (musicOn) {
    bgMusic.play();
  } else {
    bgMusic.pause();
  }
});

// Game state
let currentUser = null;
let playerData = {
  health: 100,
  maxHealth: 100,
  money: 100,
  stats: {
    strength: 0,
    agility: 0,
    intelligence: 0
  },
  inventory: []
};

let logEntries = [];

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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Initialize player data in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: email,
      health: 100,
      maxHealth: 100,
      money: 100,
      stats: {
        strength: 0,
        agility: 0,
        intelligence: 0
      },
      inventory: [],
      createdAt: new Date()
    });
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

// Load player data from Firestore
async function loadPlayerData(userId) {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    playerData = docSnap.data();
    updateUI();
  }
}

// Update UI with player data
function updateUI() {
  document.getElementById('health-value').textContent = `${playerData.health}/${playerData.maxHealth}`;
  document.getElementById('health-bar').style.width = `${(playerData.health / playerData.maxHealth) * 100}%`;
  document.getElementById('money-value').textContent = `$${playerData.money}`;
  document.getElementById('strength-value').textContent = playerData.stats.strength;
  document.getElementById('agility-value').textContent = playerData.stats.agility;
  document.getElementById('intelligence-value').textContent = playerData.stats.intelligence;
  
  const networth = playerData.money;
  document.getElementById('networth').textContent = `$${networth}`;
}

// Add log entry
function addLog(message, type = 'info') {
  const logArea = document.getElementById('log-area');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
  
  // Keep only last 20 entries
  if (logArea.children.length > 20) {
    logArea.removeChild(logArea.children[0]);
  }
}

// Train stat
async function trainStat(statName) {
  if (!currentUser) return;
  if (playerData.health <= 0) {
    addLog("You're in the hospital! Pay to get treated.", 'failure');
    return;
  }
  
  const statDisplay = {
    strength: 'Strength',
    agility: 'Agility',
    intelligence: 'Intelligence'
  };
  
  // Update in Firestore
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    [`stats.${statName}`]: increment(1)
  });
  
  // Update local data
  playerData.stats[statName]++;
  
  // Play sound
  successSound.currentTime = 0;
  successSound.play();
  
  addLog(`You trained ${statDisplay[statName]}. Now: ${playerData.stats[statName]}`, 'success');
  updateUI();
}

// Commit crime
async function commitCrime() {
  if (!currentUser) return;
  if (playerData.health <= 0) {
    addLog("You're in the hospital! Pay to get treated.", 'failure');
    return;
  }
  
  // Crime success chance based on stats
  const totalStats = playerData.stats.strength + playerData.stats.agility + playerData.stats.intelligence;
  const successChance = Math.min(0.8, 0.2 + (totalStats / 50));
  
  if (Math.random() < successChance) {
    // Success - earn money
    const reward = Math.floor(50 + (totalStats * 2) + (Math.random() * 100));
    
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      money: increment(reward)
    });
    
    playerData.money += reward;
    
    successSound.currentTime = 0;
    successSound.play();
    
    addLog(`Crime successful! You made $${reward}`, 'success');
    
    // Chance to gain stats from crime
    if (Math.random() < 0.3) {
      const statGain = Math.floor(Math.random() * 2) + 1;
      await updateDoc(userRef, {
        [`stats.${['strength', 'agility', 'intelligence'][Math.floor(Math.random() * 3)]}`]: increment(statGain)
      });
      addLog(`You learned something from the job...`, 'success');
    }
  } else {
    // Failure - lose health
    const damage = Math.floor(20 + (Math.random() * 30));
    
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      health: increment(-damage)
    });
    
    playerData.health = Math.max(0, playerData.health - damage);
    
    failSound.currentTime = 0;
    failSound.play();
    
    addLog(`Crime failed! You took ${damage} damage`, 'failure');
    
    if (playerData.health <= 0) {
      addLog("You've been hospitalized! Pay $50 to recover.", 'failure');
    }
  }
  
  updateUI();
}

// Work legit job
async function work() {
  if (!currentUser) return;
  if (playerData.health <= 0) {
    addLog("You're in the hospital! Pay to get treated.", 'failure');
    return;
  }
  
  const earnings = 20 + Math.floor(Math.random() * 30);
  
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    money: increment(earnings)
  });
  
  playerData.money += earnings;
  
  successSound.currentTime = 0;
  successSound.play();
  
  addLog(`You worked a legit job and earned $${earnings}`, 'success');
  updateUI();
}

// Go to hospital
async function goToHospital() {
  if (!currentUser) return;
  if (playerData.health === playerData.maxHealth) {
    addLog("You're already healthy!", 'info');
    return;
  }
  
  const cost = 50;
  if (playerData.money < cost) {
    addLog(`Hospital costs $${cost}. You can't afford it!`, 'failure');
    return;
  }
  
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    money: increment(-cost),
    health: playerData.maxHealth
  });
  
  playerData.money -= cost;
  playerData.health = playerData.maxHealth;
  
  successSound.currentTime = 0;
  successSound.play();
  
  addLog(`You paid $${cost} and recovered fully.`, 'success');
  updateUI();
}

// Update UI based on auth state
function updateUIForUser(user) {
  const loginForm = document.getElementById('login-form');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  const actionButtons = document.querySelectorAll('.action-btn');
  
  if (user) {
    // User is logged in
    loginForm.style.display = 'none';
    userInfo.style.display = 'block';
    userEmail.textContent = user.email;
    
    // Enable action buttons
    actionButtons.forEach(btn => btn.disabled = false);
    
    // Start background music
    if (musicOn) {
      bgMusic.play();
    }
    
    currentUser = user;
    loadPlayerData(user.uid);
    
    // Set up real-time listener for player data
    const userRef = doc(db, "users", user.uid);
    onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        playerData = doc.data();
        updateUI();
      }
    });
  } else {
    // User is logged out
    loginForm.style.display = 'block';
    userInfo.style.display = 'none';
    
    // Disable action buttons
    actionButtons.forEach(btn => btn.disabled = true);
    
    bgMusic.pause();
    currentUser = null;
    playerData = {
      health: 100,
      maxHealth: 100,
      money: 100,
      stats: { strength: 0, agility: 0, intelligence: 0 },
      inventory: []
    };
    updateUI();
  }
}

// Event listeners
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

document.getElementById('train-strength').addEventListener('click', () => trainStat('strength'));
document.getElementById('train-agility').addEventListener('click', () => trainStat('agility'));
document.getElementById('train-intelligence').addEventListener('click', () => trainStat('intelligence'));
document.getElementById('commit-crime').addEventListener('click', commitCrime);
document.getElementById('work').addEventListener('click', work);
document.getElementById('hospital').addEventListener('click', goToHospital);

// Auth state listener
onAuthStateChanged(auth, (user) => {
  updateUIForUser(user);
});

// Leaderboard
function showLeaderboard() {
  const q = query(
    collection(db, "users"),
    orderBy("money", "desc"),
    limit(10)
  );
  
  onSnapshot(q, (snapshot) => {
    const leaderboard = document.getElementById("scores-list");
    leaderboard.innerHTML = "";
    let rank = 1;
    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.className = "leaderboard-item";
      div.innerHTML = `
        <span><span class="leaderboard-rank">#${rank}</span> ${data.email.split('@')[0]}</span>
        <span>$${data.money}</span>
      `;
      leaderboard.appendChild(div);
      rank++;
    });
    
    // Update players online count (random for now)
    document.getElementById('players-online').textContent = Math.floor(Math.random() * 50) + 20;
  });
}

// Initialize
showLeaderboard();

// Disable buttons initially
document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = true);
