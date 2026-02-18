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
  updateDoc,
  deleteDoc // Added for cleanup if needed
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Config (your existing config)
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

// Initialize Groq (REPLACE WITH YOUR ACTUAL KEY)
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE"; 

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
  { id: 'weapon', name: '🔫 Pistol', price: 500, stat: 'strength', bonus: 3 },
  { id: 'lockpick', name: '🔓 Lockpick Set', price: 200, stat: 'agility', bonus: 2 },
  { id: 'mask', name: '🎭 Disguise', price: 300, stat: 'intelligence', bonus: 2 },
  { id: 'armor', name: '🛡️ Kevlar Vest', price: 800, stat: 'strength', bonus: 5 },
  { id: 'software', name: '💾 Hacking Tool', price: 600, stat: 'intelligence', bonus: 4 }
];

// Audio elements
const bgMusic = document.getElementById("backgroundMusic");
const musicToggle = document.getElementById("musicToggle");
let musicOn = true;

// Music control
if (bgMusic) {
  bgMusic.volume = 0.3;
  musicToggle.addEventListener("click", () => {
    musicOn = !musicOn;
    musicToggle.textContent = musicOn ? "♪" : "🔇";
    if (musicOn) bgMusic.play();
    else bgMusic.pause();
  });
}

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
    // Initialize player data immediately after signup
    await initializeNewPlayer(userCredential.user.uid);
  } catch (error) {
    alert("Signup failed: " + error.message);
  }
}

// Initialize new player in Firebase
async function initializeNewPlayer(userId) {
  const playerRef = doc(db, "players", userId);
  const defaultPlayerData = {
    money: 1000,
    reputation: 0,
    inventory: [],
    stats: {
      strength: 10,
      agility: 10,
      intelligence: 10
    },
    createdAt: Timestamp.now(),
    lastLogin: Timestamp.now()
  };
  
  await setDoc(playerRef, defaultPlayerData);
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
  const difficulty = document.getElementById('difficulty');
  
  if (user) {
    currentUser = user;
    if (loginForm) loginForm.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'block';
      if (userEmail) userEmail.textContent = user.email;
    }
    if (gameContainer) gameContainer.style.display = 'block';
    if (leaderboard) leaderboard.style.display = 'block';
    if (difficulty) difficulty.style.display = 'none'; // Hide old difficulty
    
    // Load player data
    loadPlayerData();
    
    // Start music
    if (musicOn && bgMusic) bgMusic.play();
    
    // Initialize city with AI
    initializeCity();
  } else {
    currentUser = null;
    if (loginForm) loginForm.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'none';
    if (leaderboard) leaderboard.style.display = 'none';
    if (difficulty) difficulty.style.display = 'none';
    if (bgMusic) bgMusic.pause();
  }
}

// Load player data from Firebase
async function loadPlayerData() {
  if (!currentUser) return;
  
  try {
    const playerRef = doc(db, "players", currentUser.uid);
    const playerSnap = await getDoc(playerRef);
    
    if (playerSnap.exists()) {
      playerData = playerSnap.data();
      console.log("Player data loaded:", playerData);
    } else {
      console.log("No player data found, creating new player...");
      await initializeNewPlayer(currentUser.uid);
      // Reload the data we just created
      const newPlayerSnap = await getDoc(playerRef);
      playerData = newPlayerSnap.data();
    }
    
    updatePlayerDisplay();
    renderActions(); // Re-render actions with updated money
    renderMarket();
  } catch (error) {
    console.error("Error loading player data:", error);
    alert("Error loading game data. Please refresh.");
  }
}

// Update player display
function updatePlayerDisplay() {
  const moneyEl = document.getElementById('player-money');
  const repEl = document.getElementById('player-rep');
  
  if (moneyEl) moneyEl.textContent = playerData.money || 0;
  if (repEl) repEl.textContent = playerData.reputation || 0;
}

// Initialize city with AI-generated description
async function initializeCity() {
  showAIThinking();
  
  try {
    // Only try AI if we have an API key
    if (GROQ_API_KEY !== "YOUR_GROQ_API_KEY_HERE") {
      const description = await getAICityDescription();
      if (description) {
        cityState.description = description;
        const descEl = document.getElementById('city-description');
        if (descEl) descEl.textContent = description;
      }
    } else {
      // Fallback description
      const descEl = document.getElementById('city-description');
      if (descEl) {
        descEl.textContent = "Welcome to Groq City. The neon lights flicker as another day of opportunity begins...";
      }
    }
    
    // Generate initial city stats
    updateCityStats();
    renderActions();
    renderMarket();
    
    // Start day cycle
    startDayCycle();
  } catch (error) {
    console.error("Error initializing city:", error);
    const descEl = document.getElementById('city-description');
    if (descEl) {
      descEl.textContent = "Welcome to Groq City. The city lives and breathes around you...";
    }
  } finally {
    hideAIThinking();
  }
}

// AI Integration Functions (with fallbacks)
async function queryGroq(prompt) {
  // Skip if no API key
  if (GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
    console.log("No Groq API key provided, using fallback responses");
    return null;
  }
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
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
        max_tokens: 200
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
  const prompt = `Generate a gritty, immersive description of a crime-ridden city called "Groq City" for the start of a new day. Include details about the atmosphere, the streets, and the general mood. Make it dark and exciting. Keep it under 100 words.`;
  
  const response = await queryGroq(prompt);
  return response || "The neon lights flicker over wet pavement as Groq City wakes to another day of crime and opportunity...";
}

async function getAIActionOutcome(action, playerStats, cityState, success) {
  const prompt = `A player in Groq City attempted to: ${action.name}. 
    They ${success ? 'succeeded' : 'failed'}. 
    Player stats: Strength ${playerStats.strength}, Agility ${playerStats.agility}, Intelligence ${playerStats.intelligence}
    Generate a short, exciting outcome description. Keep it under 50 words.`;
  
  const response = await queryGroq(prompt);
  
  if (success) {
    return response || `You successfully ${action.name.toLowerCase()}! The city trembles at your prowess.`;
  } else {
    return response || `Your attempt to ${action.name.toLowerCase()} fails. The city fights back.`;
  }
}

// Show/hide AI thinking indicator
function showAIThinking() {
  const indicator = document.getElementById('ai-thinking');
  if (indicator) indicator.style.display = 'block';
}

function hideAIThinking() {
  const indicator = document.getElementById('ai-thinking');
  if (indicator) indicator.style.display = 'none';
}

// Render action buttons
function renderActions() {
  const container = document.getElementById('player-actions');
  if (!container) return;
  
  container.innerHTML = '';
  
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = `action-btn ${action.type}`;
    btn.textContent = action.name;
    if (action.cost > (playerData.money || 0)) {
      btn.style.opacity = '0.5';
      btn.disabled = true;
      btn.title = `Costs $${action.cost}`;
    }
    btn.onclick = () => performAction(action);
    container.appendChild(btn);
  });
}

// Render market
function renderMarket() {
  const container = document.getElementById('market');
  if (!container) return;
  
  container.innerHTML = '';
  
  marketItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span>${item.name}</span>
        <span class="item-price">$${item.price}</span>
      </div>
      <div style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 10px;">
        +${item.bonus} ${item.stat}
      </div>
      <button class="action-btn" style="width: 100%;" 
        ${(playerData.money || 0) < item.price ? 'disabled' : ''}
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
  
  // Check if player has enough money
  if (action.cost > (playerData.money || 0)) {
    alert(`You need $${action.cost} to do that!`);
    return;
  }
  
  showAIThinking();
  
  try {
    // Calculate success based on stats and city state
    let successChance = action.baseSuccess;
    if (action.type === 'crime') {
      successChance += (playerData.stats?.agility || 10) * 2;
      successChance -= cityState.policePresence * 0.5;
    } else if (action.type === 'business') {
      successChance += (playerData.stats?.intelligence || 10) * 2;
      successChance += cityState.economy * 0.3;
    }
    
    successChance = Math.min(95, Math.max(5, successChance));
    const success = Math.random() * 100 < successChance;
    
    // Get AI-generated outcome description (or use fallback)
    const aiDescription = await getAIActionOutcome(action, playerData.stats, cityState, success);
    
    // Calculate rewards
    let reward = 0;
    if (success) {
      reward = Math.floor(Math.random() * 200) + 50;
      playerData.money = (playerData.money || 0) + reward;
      playerData.reputation = (playerData.reputation || 0) + 5;
    } else {
      playerData.reputation = (playerData.reputation || 0) - 2;
    }
    
    // Handle training action
    if (action.id === 'train' && success) {
      playerData.money = (playerData.money || 0) - action.cost;
      const stat = ['strength', 'agility', 'intelligence'][Math.floor(Math.random() * 3)];
      if (!playerData.stats) playerData.stats = { strength: 10, agility: 10, intelligence: 10 };
      playerData.stats[stat] = (playerData.stats[stat] || 10) + 1;
    }
    
    // Save to Firebase
    try {
      const playerRef = doc(db, "players", currentUser.uid);
      await updateDoc(playerRef, {
        money: playerData.money,
        reputation: playerData.reputation,
        stats: playerData.stats,
        lastAction: Timestamp.now()
      });
      console.log("Player data saved successfully");
    } catch (saveError) {
      console.error("Error saving to Firebase:", saveError);
      // If update fails, try to set the document
      const playerRef = doc(db, "players", currentUser.uid);
      await setDoc(playerRef, playerData, { merge: true });
    }
    
    // Log the action
    addToCrimeLog(aiDescription, success, reward);
    
    // Update display
    updatePlayerDisplay();
    renderActions();
    renderMarket(); // Re-render market to update button states
    
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
  if (!log) return;
  
  const entry = document.createElement('div');
  entry.className = `log-entry ${success ? 'log-success' : 'log-failure'}`;
  
  let text = description;
  if (success && reward > 0) {
    text += ` +$${reward}`;
  }
  
  entry.textContent = `[Day ${cityState.day}] ${text}`;
  log.insertBefore(entry, log.firstChild);
  
  // Keep only last 20 entries
  while (log.children.length > 20) {
    log.removeChild(log.lastChild);
  }
}

// Generate city event
async function generateCityEvent() {
  // Randomly adjust city stats
  cityState.crimeRate += Math.floor(Math.random() * 10) - 5;
  cityState.economy += Math.floor(Math.random() * 8) - 4;
  cityState.policePresence += Math.floor(Math.random() * 12) - 6;
  
  // Clamp values
  cityState.crimeRate = Math.min(100, Math.max(0, cityState.crimeRate));
  cityState.economy = Math.min(100, Math.max(0, cityState.economy));
  cityState.policePresence = Math.min(100, Math.max(0, cityState.policePresence));
  
  updateCityStats();
  
  // Generate news
  const events = [
    "Police crackdown in the east end!",
    "New gang emerges in the industrial district.",
    "Stock market crashes! Economy in turmoil.",
    "Mayor announces anti-crime initiative.",
    "Rival mob bosses call a truce.",
    "Casino heist shocks the city!",
    "Underground fight club gains popularity.",
    "Drug prices skyrocket on the black market."
  ];
  
  const news = events[Math.floor(Math.random() * events.length)];
  addNewsItem(news);
}

// Update city stats display
function updateCityStats() {
  const statsContainer = document.getElementById('city-stats');
  if (!statsContainer) return;
  
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
  
  const dayEl = document.getElementById('game-day');
  if (dayEl) dayEl.textContent = cityState.day;
}

// Add news item
function addNewsItem(news) {
  const feed = document.getElementById('news-feed');
  if (!feed) return;
  
  const item = document.createElement('div');
  item.className = 'news-item';
  item.textContent = `📰 ${news}`;
  feed.insertBefore(item, feed.firstChild);
  
  // Keep only last 10 news items
  while (feed.children.length > 10) {
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
  }, 60000); // New day every minute
}

// Buy item
window.buyItem = async (itemId) => {
  if (!currentUser) {
    alert("Please login first!");
    return;
  }
  
  const item = marketItems.find(i => i.id === itemId);
  if (!item) return;
  
  if ((playerData.money || 0) < item.price) {
    alert("Not enough money!");
    return;
  }
  
  playerData.money -= item.price;
  
  // Initialize stats if needed
  if (!playerData.stats) {
    playerData.stats = { strength: 10, agility: 10, intelligence: 10 };
  }
  
  // Add stat bonus
  playerData.stats[item.stat] = (playerData.stats[item.stat] || 10) + item.bonus;
  
  // Add to inventory
  if (!playerData.inventory) playerData.inventory = [];
  playerData.inventory.push({
    id: item.id,
    name: item.name,
    purchasedAt: Timestamp.now()
  });
  
  try {
    // Save to Firebase
    const playerRef = doc(db, "players", currentUser.uid);
    await updateDoc(playerRef, {
      money: playerData.money,
      stats: playerData.stats,
      inventory: playerData.inventory
    });
    
    // Update display
    updatePlayerDisplay();
    renderMarket();
    renderActions();
    
    addToCrimeLog(`Purchased ${item.name} from the black market.`, true, 0);
  } catch (error) {
    console.error("Error buying item:", error);
    alert("Purchase failed. Please try again.");
    // Revert changes
    playerData.money += item.price;
    playerData.stats[item.stat] -= item.bonus;
    playerData.inventory.pop();
  }
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
    if (!leaderboard) return;
    
    leaderboard.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement("li");
      li.innerHTML = `<span>${data.name || "Anonymous"}</span> <span>$${data.score || 0}</span>`;
      leaderboard.appendChild(li);
    });
  }, (error) => {
    console.error("Leaderboard error:", error);
  });
}

// Save score to leaderboard (keeping original function)
async function saveScore(name, score) {
  if (!currentUser) return;
  
  try {
    await addDoc(collection(db, "scores"), {
      name: name || "Anonymous",
      score: score || 0,
      timestamp: Timestamp.now(),
      userId: currentUser.uid
    });
  } catch (error) {
    console.error("Error saving score:", error);
  }
}

// Event listeners
document.getElementById('login-btn')?.addEventListener('click', () => {
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  if (email && password) {
    login(email, password);
  } else {
    alert("Please enter email and password");
  }
});

document.getElementById('signup-btn')?.addEventListener('click', () => {
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  if (email && password) {
    signup(email, password);
  } else {
    alert("Please enter email and password");
  }
});

document.getElementById('logout-btn')?.addEventListener('click', logout);

// Auth state listener
onAuthStateChanged(auth, (user) => {
  updateUI(user);
});

// Initialize leaderboard
showLeaderboard();

// Make buyItem globally available
window.buyItem = buyItem;

console.log("Groq City game initialized!");
