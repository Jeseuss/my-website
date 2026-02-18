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

// Firebase Config
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

// Groq API Key - FIXED the reference
const GROQ_API_KEY = "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"; 

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

// Adventure State
let adventureState = {
  history: [],
  context: {
    location: "Groq City Streets",
    quest: "None",
    health: 100,
    inventory: []
  },
  isProcessing: false
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

// ==================== AUTHENTICATION FUNCTIONS ====================

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
    await initializeNewPlayer(userCredential.user.uid);
  } catch (error) {
    alert("Signup failed: " + error.message);
  }
}

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
    adventureHistory: [],
    adventureContext: {
      location: "Groq City Streets",
      quest: "None",
      health: 100,
      inventory: []
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

// ==================== UI UPDATE FUNCTIONS ====================

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
    if (difficulty) difficulty.style.display = 'none';
    
    loadPlayerData();
    if (musicOn && bgMusic) bgMusic.play();
    initializeCity();
    initAdventureEngine(); // Initialize adventure engine
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

function updatePlayerDisplay() {
  const moneyEl = document.getElementById('player-money');
  const repEl = document.getElementById('player-rep');
  const strengthEl = document.getElementById('player-strength');
  const agilityEl = document.getElementById('player-agility');
  const intelligenceEl = document.getElementById('player-intelligence');
  
  if (moneyEl) moneyEl.textContent = playerData.money || 0;
  if (repEl) repEl.textContent = playerData.reputation || 0;
  if (strengthEl) strengthEl.textContent = playerData.stats?.strength || 10;
  if (agilityEl) agilityEl.textContent = playerData.stats?.agility || 10;
  if (intelligenceEl) intelligenceEl.textContent = playerData.stats?.intelligence || 10;
}

// ==================== LOAD PLAYER DATA ====================

async function loadPlayerData() {
  if (!currentUser) return;
  
  try {
    const playerRef = doc(db, "players", currentUser.uid);
    const playerSnap = await getDoc(playerRef);
    
    if (playerSnap.exists()) {
      playerData = playerSnap.data();
      console.log("Player data loaded:", playerData);
      
      // Load adventure state
      if (playerData.adventureHistory) {
        adventureState.history = playerData.adventureHistory;
        adventureState.context = playerData.adventureContext || adventureState.context;
      }
    } else {
      console.log("No player data found, creating new player...");
      await initializeNewPlayer(currentUser.uid);
      const newPlayerSnap = await getDoc(playerRef);
      playerData = newPlayerSnap.data();
    }
    
    updatePlayerDisplay();
    renderActions();
    renderMarket();
    
    // Update adventure display
    setTimeout(() => {
      displayAdventureHistory();
      const locationEl = document.getElementById('adventure-location');
      const questEl = document.getElementById('adventure-quest');
      if (locationEl) locationEl.textContent = adventureState.context.location;
      if (questEl) questEl.textContent = adventureState.context.quest;
    }, 100);
    
  } catch (error) {
    console.error("Error loading player data:", error);
    alert("Error loading game data. Please refresh.");
  }
}

// ==================== CITY FUNCTIONS ====================

async function initializeCity() {
  showAIThinking();
  
  try {
    if (GROQ_API_KEY) {
      const description = await getAICityDescription();
      if (description) {
        cityState.description = description;
        const descEl = document.getElementById('city-description');
        if (descEl) descEl.textContent = description;
      }
    } else {
      const descEl = document.getElementById('city-description');
      if (descEl) {
        descEl.textContent = "Welcome to Groq City. The neon lights flicker as another day of opportunity begins...";
      }
    }
    
    updateCityStats();
    renderActions();
    renderMarket();
    startDayCycle();
  } catch (error) {
    console.error("Error initializing city:", error);
  } finally {
    hideAIThinking();
  }
}

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

async function generateCityEvent() {
  cityState.crimeRate += Math.floor(Math.random() * 10) - 5;
  cityState.economy += Math.floor(Math.random() * 8) - 4;
  cityState.policePresence += Math.floor(Math.random() * 12) - 6;
  
  cityState.crimeRate = Math.min(100, Math.max(0, cityState.crimeRate));
  cityState.economy = Math.min(100, Math.max(0, cityState.economy));
  cityState.policePresence = Math.min(100, Math.max(0, cityState.policePresence));
  
  updateCityStats();
  
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

function addNewsItem(news) {
  const feed = document.getElementById('news-feed');
  if (!feed) return;
  
  const item = document.createElement('div');
  item.className = 'news-item';
  item.textContent = `📰 ${news}`;
  feed.insertBefore(item, feed.firstChild);
  
  while (feed.children.length > 10) {
    feed.removeChild(feed.lastChild);
  }
}

function startDayCycle() {
  setInterval(async () => {
    if (currentUser) {
      cityState.day++;
      await generateCityEvent();
    }
  }, 60000);
}

// ==================== AI FUNCTIONS ====================

async function queryGroq(prompt, systemPrompt = "You are the AI god of a crime-ridden city. Generate immersive, gritty descriptions and outcomes.") {
  if (!GROQ_API_KEY) {
    console.log("No Groq API key provided");
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
            content: systemPrompt
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

// ==================== UI CONTROLS ====================

function showAIThinking() {
  const indicator = document.getElementById('ai-thinking');
  if (indicator) indicator.style.display = 'block';
}

function hideAIThinking() {
  const indicator = document.getElementById('ai-thinking');
  if (indicator) indicator.style.display = 'none';
}

// ==================== ACTION FUNCTIONS ====================

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

async function performAction(action) {
  if (!currentUser) return;
  
  if (action.cost > (playerData.money || 0)) {
    alert(`You need $${action.cost} to do that!`);
    return;
  }
  
  showAIThinking();
  
  try {
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
    
    const aiDescription = await getAIActionOutcome(action, playerData.stats, cityState, success);
    
    let reward = 0;
    if (success) {
      reward = Math.floor(Math.random() * 200) + 50;
      playerData.money = (playerData.money || 0) + reward;
      playerData.reputation = (playerData.reputation || 0) + 5;
    } else {
      playerData.reputation = (playerData.reputation || 0) - 2;
    }
    
    if (action.id === 'train' && success) {
      playerData.money = (playerData.money || 0) - action.cost;
      const stat = ['strength', 'agility', 'intelligence'][Math.floor(Math.random() * 3)];
      if (!playerData.stats) playerData.stats = { strength: 10, agility: 10, intelligence: 10 };
      playerData.stats[stat] = (playerData.stats[stat] || 10) + 1;
    }
    
    try {
      const playerRef = doc(db, "players", currentUser.uid);
      await updateDoc(playerRef, {
        money: playerData.money,
        reputation: playerData.reputation,
        stats: playerData.stats,
        lastAction: Timestamp.now()
      });
    } catch (saveError) {
      console.error("Error saving to Firebase:", saveError);
      const playerRef = doc(db, "players", currentUser.uid);
      await setDoc(playerRef, playerData, { merge: true });
    }
    
    addToCrimeLog(aiDescription, success, reward);
    updatePlayerDisplay();
    renderActions();
    renderMarket();
    
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
  
  while (log.children.length > 20) {
    log.removeChild(log.lastChild);
  }
}

// ==================== MARKET FUNCTIONS ====================

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
  
  if (!playerData.stats) {
    playerData.stats = { strength: 10, agility: 10, intelligence: 10 };
  }
  
  playerData.stats[item.stat] = (playerData.stats[item.stat] || 10) + item.bonus;
  
  if (!playerData.inventory) playerData.inventory = [];
  playerData.inventory.push({
    id: item.id,
    name: item.name,
    purchasedAt: Timestamp.now()
  });
  
  try {
    const playerRef = doc(db, "players", currentUser.uid);
    await updateDoc(playerRef, {
      money: playerData.money,
      stats: playerData.stats,
      inventory: playerData.inventory
    });
    
    updatePlayerDisplay();
    renderMarket();
    renderActions();
    
    addToCrimeLog(`Purchased ${item.name} from the black market.`, true, 0);
  } catch (error) {
    console.error("Error buying item:", error);
    alert("Purchase failed. Please try again.");
    playerData.money += item.price;
    playerData.stats[item.stat] -= item.bonus;
    playerData.inventory.pop();
  }
};

// ==================== ADVENTURE ENGINE ====================

function initAdventureEngine() {
  const input = document.getElementById('adventure-input');
  const submitBtn = document.getElementById('adventure-submit');
  const clearBtn = document.getElementById('adventure-clear');
  
  if (!input || !submitBtn || !clearBtn) return;
  
  // Only add welcome message if history is empty
  if (adventureState.history.length === 0) {
    addStoryEntry("⚔️ Your adventure begins in Groq City. The neon lights flicker overhead as you step into the shadows...", "system");
  } else {
    displayAdventureHistory();
  }
  
  submitBtn.addEventListener('click', async () => {
    const action = input.value.trim();
    if (!action || adventureState.isProcessing) return;
    
    input.value = '';
    await processAdventureAction(action);
  });
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !adventureState.isProcessing) {
      submitBtn.click();
    }
  });
  
  clearBtn.addEventListener('click', () => {
    if (confirm('Start a new adventure? Your current story will be saved.')) {
      adventureState.history = [];
      adventureState.context = {
        location: "Groq City Streets",
        quest: "None",
        health: 100,
        inventory: []
      };
      const storyLog = document.getElementById('story-log');
      if (storyLog) storyLog.innerHTML = '';
      addStoryEntry("⚔️ You start a new adventure in Groq City...", "system");
      saveAdventureState();
    }
  });
}

function addStoryEntry(text, type = "player") {
  const storyLog = document.getElementById('story-log');
  if (!storyLog) return;
  
  const entry = document.createElement('div');
  entry.className = 'story-entry';
  
  let prefix = "👤";
  let color = "#4ecdc4";
  
  switch(type) {
    case "system":
      prefix = "⚙️";
      color = "#ffe66d";
      break;
    case "ai":
      prefix = "🤖";
      color = "#ff6b6b";
      break;
    case "combat":
      prefix = "⚔️";
      color = "#ff0000";
      break;
    case "loot":
      prefix = "💰";
      color = "#ffd700";
      break;
    default:
      prefix = "👤";
      color = "#4ecdc4";
  }
  
  entry.innerHTML = `<span style="color: ${color};">${prefix}</span> ${text}`;
  entry.style.marginBottom = '10px';
  entry.style.padding = '5px';
  entry.style.borderLeft = `3px solid ${color}`;
  entry.style.paddingLeft = '10px';
  entry.style.animation = 'fadeIn 0.3s ease';
  
  storyLog.appendChild(entry);
  storyLog.scrollTop = storyLog.scrollHeight;
  
  adventureState.history.push({
    text,
    type,
    timestamp: new Date().toISOString()
  });
  
  if (adventureState.history.length > 100) {
    adventureState.history.shift();
  }
}

function displayAdventureHistory() {
  const storyLog = document.getElementById('story-log');
  if (!storyLog) return;
  
  storyLog.innerHTML = '';
  adventureState.history.forEach(entry => {
    const prefix = entry.type === "player" ? "👤" : 
                   entry.type === "system" ? "⚙️" :
                   entry.type === "combat" ? "⚔️" :
                   entry.type === "loot" ? "💰" : "🤖";
    const color = entry.type === "player" ? "#4ecdc4" :
                  entry.type === "system" ? "#ffe66d" :
                  entry.type === "combat" ? "#ff0000" :
                  entry.type === "loot" ? "#ffd700" : "#ff6b6b";
    
    const div = document.createElement('div');
    div.className = 'story-entry';
    div.innerHTML = `<span style="color: ${color};">${prefix}</span> ${entry.text}`;
    div.style.marginBottom = '10px';
    div.style.padding = '5px';
    div.style.borderLeft = `3px solid ${color}`;
    div.style.paddingLeft = '10px';
    storyLog.appendChild(div);
  });
  storyLog.scrollTop = storyLog.scrollHeight;
}

async function processAdventureAction(action) {
  if (!currentUser) {
    alert("Please login to play the adventure!");
    return;
  }
  
  adventureState.isProcessing = true;
  const submitBtn = document.getElementById('adventure-submit');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '🤔 Thinking...';
  submitBtn.disabled = true;
  
  addStoryEntry(action, "player");
  
  try {
    let aiResponse;
    
    if (GROQ_API_KEY) {
      const contextPrompt = buildAdventureContext(action);
      const response = await queryGroq(contextPrompt, "You are a text adventure game master for a gritty crime city. Generate immersive responses in JSON format.");
      
      if (response) {
        try {
          // Try to parse JSON from response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiResponse = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found");
          }
        } catch (e) {
          console.error("Failed to parse AI response:", e);
          aiResponse = getFallbackAdventureResponse(action);
        }
      } else {
        aiResponse = getFallbackAdventureResponse(action);
      }
    } else {
      aiResponse = getFallbackAdventureResponse(action);
    }
    
    const parsedResponse = parseAdventureResponse(aiResponse);
    addStoryEntry(parsedResponse.narrative, "ai");
    await updateGameFromAdventure(parsedResponse);
    await saveAdventureState();
    
  } catch (error) {
    console.error("Adventure error:", error);
    addStoryEntry("The city's chaos makes it hard to think... Try again.", "system");
  } finally {
    adventureState.isProcessing = false;
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function buildAdventureContext(action) {
  const recentHistory = adventureState.history.slice(-5).map(h => 
    `${h.type === 'player' ? 'Player' : 'Game'}: ${h.text}`
  ).join('\n');
  
  return `You are the AI narrator for a gritty crime city adventure game called "Groq City". 
The player is currently in: ${adventureState.context.location}
Current quest: ${adventureState.context.quest}
Player health: ${adventureState.context.health}
Player inventory: ${adventureState.context.inventory.join(', ') || 'empty'}
Player stats: Str ${playerData.stats.strength}, Agi ${playerData.stats.agility}, Int ${playerData.stats.intelligence}

Recent events:
${recentHistory}

The player action: "${action}"

Generate a response in this exact JSON format:
{
  "narrative": "A vivid, immersive description of what happens (2-3 sentences)",
  "location": "New location if changed",
  "quest": "New quest if given/completed",
  "healthChange": number (negative for damage, positive for healing),
  "moneyChange": number,
  "reputationChange": number,
  "itemFound": "item name or null",
  "combat": boolean
}

Make it dark, gritty, and fit the crime city theme.`;
}

function getFallbackAdventureResponse(action) {
  const responses = [
    {
      narrative: "You walk through the rain-slicked streets. The neon signs reflect off puddles as shadows move in alleys.",
      location: "Downtown",
      quest: "Find the informant",
      healthChange: 0,
      moneyChange: 0,
      reputationChange: 1,
      itemFound: null,
      combat: false
    },
    {
      narrative: "A group of thugs blocks your path. 'This is our turf,' one growls. They look ready for a fight.",
      location: "Industrial District",
      quest: "Deal with the thugs",
      healthChange: -10,
      moneyChange: 0,
      reputationChange: 5,
      itemFound: null,
      combat: true
    },
    {
      narrative: "You find an abandoned warehouse. Inside, a briefcase sits on a crate. It's unlocked...",
      location: "Warehouse District",
      quest: "Check the briefcase",
      healthChange: 0,
      moneyChange: 500,
      reputationChange: 2,
      itemFound: "Briefcase",
      combat: false
    }
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function parseAdventureResponse(response) {
  if (!response) {
    return {
      narrative: "Nothing happens. The city is quiet tonight.",
      location: adventureState.context.location,
      quest: adventureState.context.quest,
      healthChange: 0,
      moneyChange: 0,
      reputationChange: 0,
      itemFound: null,
      combat: false
    };
  }
  
  return response;
}

async function updateGameFromAdventure(parsed) {
  let updates = false;
  
  if (parsed.location && parsed.location !== adventureState.context.location) {
    adventureState.context.location = parsed.location;
    const locationEl = document.getElementById('adventure-location');
    if (locationEl) locationEl.textContent = parsed.location;
    updates = true;
  }
  
  if (parsed.quest && parsed.quest !== adventureState.context.quest) {
    adventureState.context.quest = parsed.quest;
    const questEl = document.getElementById('adventure-quest');
    if (questEl) questEl.textContent = parsed.quest;
    updates = true;
  }
  
  if (parsed.healthChange) {
    adventureState.context.health = Math.max(0, Math.min(100, 
      (adventureState.context.health || 100) + parsed.healthChange));
    
    if (parsed.healthChange < 0) {
      addStoryEntry(`You take ${-parsed.healthChange} damage!`, "combat");
    } else if (parsed.healthChange > 0) {
      addStoryEntry(`You heal ${parsed.healthChange} health.`, "system");
    }
    updates = true;
  }
  
  if (parsed.moneyChange) {
    playerData.money = (playerData.money || 1000) + parsed.moneyChange;
    updatePlayerDisplay();
    
    if (parsed.moneyChange > 0) {
      addStoryEntry(`You found $${parsed.moneyChange}!`, "loot");
    }
    updates = true;
  }
  
  if (parsed.reputationChange) {
    playerData.reputation = (playerData.reputation || 0) + parsed.reputationChange;
    updatePlayerDisplay();
    updates = true;
  }
  
  if (parsed.itemFound) {
    if (!playerData.inventory) playerData.inventory = [];
    playerData.inventory.push({
      name: parsed.itemFound,
      foundAt: Timestamp.now()
    });
    addStoryEntry(`You found: ${parsed.itemFound}!`, "loot");
    updates = true;
  }
  
  if (parsed.combat) {
    addStoryEntry("⚔️ Combat initiated!", "combat");
  }
  
  if (updates && currentUser) {
    try {
      const playerRef = doc(db, "players", currentUser.uid);
      await updateDoc(playerRef, {
        money: playerData.money,
        reputation: playerData.reputation,
        inventory: playerData.inventory,
        adventureContext: adventureState.context
      });
    } catch (error) {
      console.error("Error saving adventure state:", error);
    }
  }
}

async function saveAdventureState() {
  if (!currentUser) return;
  
  try {
    const playerRef = doc(db, "players", currentUser.uid);
    await updateDoc(playerRef, {
      adventureHistory: adventureState.history,
      adventureContext: adventureState.context
    });
  } catch (error) {
    console.error("Error saving adventure:", error);
  }
}

// ==================== LEADERBOARD FUNCTIONS ====================

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

// ==================== EVENT LISTENERS ====================

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

// Make functions globally available
window.buyItem = buyItem;

console.log("Groq City game initialized with Adventure Engine!");
