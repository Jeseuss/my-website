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
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Config (use your existing config)
const firebaseConfig = {
  apiKey: "AIzaSyDtKRlsPmdOMtzY_ESJFq3JiduLPPbz1QQ",
  authDomain: "dbfinal-9fadb.firebaseapp.com",
  projectId: "dbfinal-9fadb",
  storageBucket: "dbfinal-9fadb.appspot.com",
  messagingSenderId: "980549293595",
  appId: "1:980549293595:web:17876489c9aeea26e78abe"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize Groq (YOU NEED TO ADD YOUR API KEY HERE)
const GROQ_API_KEY = "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"; // Replace with your actual key

// Game State
let currentUser = null;
let playerData = {
  money: 1000,
  reputation: 0,
  inventory: [],
  stats: {
    strength: 10,
    agility: 10,
    intelligence: 10
  }
};

let cityState = {
  day: 1,
  crimeRate: 50,
  economy: 50,
  policePresence: 50,
  description: "A new day dawns in Groq City..."
};

// Available actions
const actions = [
  { id: 'rob', name: '💵 Rob Store', type: 'crime', cost: 0, baseSuccess: 40 },
  { id: 'hack', name: '💻 Hack Bank', type: 'crime', cost: 0, baseSuccess: 30 },
  { id: 'sell', name: '📦 Sell Goods', type: 'business', cost: 0, baseSuccess: 70 },
  { id: 'train', name: '🏋️ Train', type: 'stats', cost: 100, baseSuccess: 100 },
  { id: 'bribe', name: '🤝 Bribe Official', type: 'crime', cost: 200, baseSuccess: 60 }
];

// Market items
const marketItems = [
  { id: 'weapon', name: '🔫 Pistol', price: 500, stat: 'strength' },
  { id: 'lockpick', name: '🔓 Lockpick Set', price: 200, stat: 'agility' },
  { id: 'mask', name: '🎭 Disguise', price: 300, stat: 'intelligence' }
];

// Audio elements
const bgMusic = document.getElementById("backgroundMusic");
const musicToggle = document.getElementById("musicToggle");
let musicOn = true;

// Music control
bgMusic.volume = 0.3;
musicToggle.addEventListener("click", () => {
  musicOn = !musicOn;
  musicToggle.textContent = musicOn ? "♪" : "🔇";
  if (musicOn) bgMusic.play();
  else bgMusic.pause();
});

// Authentication functions (same as before)
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
  const gameContainer = document.getElementById('game-container');
  const leaderboard = document.getElementById('leaderboard');
  
  if (user) {
    currentUser = user;
    loginForm.style.display = 'none';
    userInfo.style.display = 'block';
    userEmail.textContent = user.email;
    gameContainer.style.display = 'block';
    leaderboard.style.display = 'block';
    
    // Load player data
    loadPlayerData();
    
    // Start music
    if (musicOn) bgMusic.play();
    
    // Initialize city with AI
    initializeCity();
  } else {
    currentUser = null;
    loginForm.style.display = 'block';
    userInfo.style.display = 'none';
    gameContainer.style.display = 'none';
    leaderboard.style.display = 'none';
    bgMusic.pause();
  }
}

// Load player data from Firebase
async function loadPlayerData() {
  if (!currentUser) return;
  
  const playerRef = doc(db, "players", currentUser.uid);
  const playerSnap = await getDoc(playerRef);
  
  if (playerSnap.exists()) {
    playerData = playerSnap.data();
  } else {
    // Create new player
    await setDoc(playerRef, playerData);
  }
  
  updatePlayerDisplay();
}

// Update player display
function updatePlayerDisplay() {
  document.getElementById('player-money').textContent = playerData.money;
  document.getElementById('player-rep').textContent = playerData.reputation;
}

// Initialize city with AI-generated description
async function initializeCity() {
  showAIThinking();
  
  try {
    const description = await getAICityDescription();
    cityState.description = description;
    document.getElementById('city-description').textContent = description;
    
    // Generate initial city stats
    updateCityStats();
    renderActions();
    renderMarket();
    
    // Start day cycle
    startDayCycle();
  } catch (error) {
    console.error("Error initializing city:", error);
    document.getElementById('city-description').textContent = 
      "Welcome to Groq City. The AI is currently unavailable, but the city lives on...";
  } finally {
    hideAIThinking();
  }
}

// AI Integration Functions
async function queryGroq(prompt) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768', // or another available model
        messages: [
          {
            role: 'system',
            content: 'You are the AI god of a crime-ridden city. Generate immersive, gritty descriptions and outcomes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Groq API error:', error);
    return null;
  }
}

async function getAICityDescription() {
  const prompt = `Generate a gritty, immersive description of a crime-ridden city called "Groq City" for the start of a new day. Include details about the atmosphere, the streets, and the general mood. Make it dark and exciting.`;
  
  const response = await queryGroq(prompt);
  return response || "The neon lights flicker over wet pavement as Groq City wakes to another day of crime and opportunity...";
}

async function getAIActionOutcome(action, playerStats, cityState) {
  const prompt = `A player in Groq City is attempting to: ${action.name}. 
    Player stats: Strength ${playerStats.strength}, Agility ${playerStats.agility}, Intelligence ${playerStats.intelligence}
    City state: Crime rate ${cityState.crimeRate}%, Economy ${cityState.economy}%, Police presence ${cityState.policePresence}%
    
    Generate a short, exciting outcome description for this action. Make it immersive and fit the crime city theme.`;
  
  const response = await queryGroq(prompt);
  return response || `You attempt to ${action.name.toLowerCase()}...`;
}

async function getAINewsEvent() {
  const prompt = `Generate a short news headline and brief description about something happening in Groq City, a crime-ridden metropolis. 
    Make it sound like a newspaper report. Format: "HEADLINE: description"`;
  
  const response = await queryGroq(prompt);
  return response || "CITY BEAT: Another quiet night in Groq City...";
}

// Show/hide AI thinking indicator
function showAIThinking() {
  document.getElementById('ai-thinking').style.display = 'block';
}

function hideAIThinking() {
  document.getElementById('ai-thinking').style.display = 'none';
}

// Render action buttons
function renderActions() {
  const container = document.getElementById('player-actions');
  container.innerHTML = '';
  
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = `action-btn ${action.type}`;
    btn.textContent = action.name;
    if (action.cost > playerData.money) {
      btn.style.opacity = '0.5';
      btn.disabled = true;
    }
    btn.onclick = () => performAction(action);
    container.appendChild(btn);
  });
}

// Render market
function renderMarket() {
  const container = document.getElementById('market');
  container.innerHTML = '';
  
  marketItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${item.name}</span>
        <span class="item-price">$${item.price}</span>
      </div>
      <button class="action-btn" style="width: 100%; margin-top: 10px;" 
        ${playerData.money < item.price ? 'disabled' : ''}
        onclick="window.buyItem('${item.id}')">
        Buy
      </button>
    `;
    container.appendChild(card);
  });
}

// Perform action with AI flavor
async function performAction(action) {
  if (!currentUser) return;
  
  showAIThinking();
  
  try {
    // Get AI-generated outcome description
    const aiDescription = await getAIActionOutcome(action, playerData.stats, cityState);
    
    // Calculate success based on stats and city state
    let successChance = action.baseSuccess;
    if (action.type === 'crime') {
      successChance += playerData.stats.agility * 2;
      successChance -= cityState.policePresence * 0.5;
    } else if (action.type === 'business') {
      successChance += playerData.stats.intelligence * 2;
      successChance += cityState.economy * 0.3;
    }
    
    successChance = Math.min(95, Math.max(5, successChance));
    const success = Math.random() * 100 < successChance;
    
    // Calculate rewards
    let reward = 0;
    if (success) {
      reward = Math.floor(Math.random() * 200) + 50;
      playerData.money += reward;
      playerData.reputation += 5;
    } else {
      playerData.reputation -= 2;
    }
    
    // Update player stats if training
    if (action.id === 'train' && success) {
      playerData.money -= action.cost;
      const stat = ['strength', 'agility', 'intelligence'][Math.floor(Math.random() * 3)];
      playerData.stats[stat] += 1;
    }
    
    // Save to Firebase
    await updateDoc(doc(db, "players", currentUser.uid), playerData);
    
    // Log the action
    addToCrimeLog(aiDescription, success, reward);
    
    // Update display
    updatePlayerDisplay();
    renderActions();
    
    // Small chance for city event
    if (Math.random() < 0.3) {
      await generateCityEvent();
    }
    
  } catch (error) {
    console.error("Action error:", error);
    addToCrimeLog("The city's chaos confuses your actions...", false, 0);
  } finally {
    hideAIThinking();
  }
}

// Add to crime log
function addToCrimeLog(description, success, reward = 0) {
  const log = document.getElementById('crime-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${success ? 'log-success' : 'log-failure'}`;
  
  let text = description;
  if (success && reward > 0) {
    text += ` You gained $${reward}.`;
  } else if (!success) {
    text += ` You failed and lost reputation.`;
  }
  
  entry.textContent = `[Day ${cityState.day}] ${text}`;
  log.insertBefore(entry, log.firstChild);
  
  // Keep only last 20 entries
  if (log.children.length > 20) {
    log.removeChild(log.lastChild);
  }
}

// Generate city event with AI
async function generateCityEvent() {
  const news = await getAINewsEvent();
  
  // Update city stats
  cityState.crimeRate += Math.floor(Math.random() * 10) - 5;
  cityState.economy += Math.floor(Math.random() * 8) - 4;
  cityState.policePresence += Math.floor(Math.random() * 12) - 6;
  
  // Clamp values
  cityState.crimeRate = Math.min(100, Math.max(0, cityState.crimeRate));
  cityState.economy = Math.min(100, Math.max(0, cityState.economy));
  cityState.policePresence = Math.min(100, Math.max(0, cityState.policePresence));
  
  updateCityStats();
  addNewsItem(news);
}

// Update city stats display
function updateCityStats() {
  const statsContainer = document.getElementById('city-stats');
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${cityState.crimeRate}%</div>
      <div class="stat-label">Crime Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${cityState.economy}%</div>
      <div class="stat-label">Economy</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${cityState.policePresence}%</div>
      <div class="stat-label">Police Presence</div>
    </div>
  `;
  
  document.getElementById('game-day').textContent = cityState.day;
}

// Add news item
function addNewsItem(news) {
  const feed = document.getElementById('news-feed');
  const item = document.createElement('div');
  item.className = 'news-item';
  item.textContent = `📰 ${news}`;
  feed.insertBefore(item, feed.firstChild);
  
  // Keep only last 10 news items
  if (feed.children.length > 10) {
    feed.removeChild(feed.lastChild);
  }
}

// Day cycle
function startDayCycle() {
  setInterval(async () => {
    if (currentUser) {
      cityState.day++;
      await generateCityEvent();
    }
  }, 60000); // New day every minute (adjust as needed)
}

// Buy item
window.buyItem = async (itemId) => {
  const item = marketItems.find(i => i.id === itemId);
  if (!item || playerData.money < item.price) return;
  
  playerData.money -= item.price;
  playerData.stats[item.stat] += 2;
  
  await updateDoc(doc(db, "players", currentUser.uid), playerData);
  updatePlayerDisplay();
  renderMarket();
  addToCrimeLog(`Purchased ${item.name} from the black market.`, true, 0);
};

// Leaderboard
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
      li.innerHTML = `<span>${doc.data().name}</span> <span>$${doc.data().score}</span>`;
      leaderboard.appendChild(li);
    });
  });
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

// Auth state listener
onAuthStateChanged(auth, (user) => {
  updateUI(user);
});

// Initialize leaderboard
showLeaderboard();
