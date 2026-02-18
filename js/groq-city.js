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
// Import Groq SDK
import Groq from "https://esm.sh/groq-sdk";

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

// Initialize Groq with API key
const GROQ_API_KEY = "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";
const groq = new Groq({
  apiKey: GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser usage
});

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

// Prevent double-binding of adventure UI listeners
let adventureEngineInitialized = false;


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
    initAdventureEngine();
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

// ==================== AI FUNCTIONS WITH STREAMING ====================

async function queryGroqWithStreaming(prompt, systemPrompt, onChunk) {
  if (!GROQ_API_KEY) {
    console.log("No Groq API key provided");
    return null;
  }
  
  try {
    const stream = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt || "You are the AI god of a crime-ridden city. Generate immersive, gritty descriptions and outcomes."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "qwen/qwen3-32b", // Using the model from your example
      temperature: 0.6,
      max_completion_tokens: 4096,
      top_p: 0.95,
      stream: true,
      stop: null
    });

    let fullResponse = "";
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        if (onChunk) {
          onChunk(content);
        }
      }
    }
    
    console.log("Full streaming response:", fullResponse);
    return fullResponse;
  } catch (error) {
    console.error('Groq streaming error:', error);
    return null;
  }
}

async function queryGroq(prompt, systemPrompt) {
  if (!GROQ_API_KEY) {
    console.log("No Groq API key provided");
    return null;
  }
  
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt || "You are the AI god of a crime-ridden city. Generate immersive, gritty descriptions and outcomes."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "qwen/qwen3-32b",
      temperature: 0.6,
      max_completion_tokens: 4096,
      top_p: 0.95,
      stream: false
    });

    return completion.choices[0]?.message?.content;
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
    
    // Use streaming for action outcome
    let aiDescription = "";
    await queryGroqWithStreaming(
      `A player in Groq City attempted to: ${action.name}. 
       They ${success ? 'succeeded' : 'failed'}. 
       Player stats: Strength ${playerData.stats.strength}, Agility ${playerData.stats.agility}, Intelligence ${playerData.stats.intelligence}
       Generate a short, exciting outcome description. Keep it under 50 words.`,
      "You are a gritty crime city narrator.",
      (chunk) => {
        aiDescription += chunk;
        // Optional: Update UI in real-time
        const log = document.getElementById('crime-log');
        if (log) {
          if (!log.firstChild || !log.firstChild.classList?.contains('log-entry')) {
            const temp = document.createElement('div');
            temp.className = 'log-entry log-success';
            temp.textContent = `[Day ${cityState.day}] `;
            log.insertBefore(temp, log.firstChild);
          }
          log.firstChild.textContent += chunk;
        }
      }
    );
    
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
    
    addToCrimeLog(aiDescription || (success ? `Successfully ${action.name.toLowerCase()}!` : `Failed to ${action.name.toLowerCase()}.`), success, reward);
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

// ==================== ADVENTURE ENGINE WITH STREAMING ====================
// UI helpers (supports both older and current HTML ids)
function getStoryContainer() {
  return (
    document.getElementById('adventure-story') ||
    document.getElementById('story-log')
  );
}

function getAdventureForm() {
  return document.getElementById('adventure-form');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Robustly extract the first JSON object from model output
function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    } else {
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}


function initAdventureEngine() {
  if (adventureEngineInitialized) return;
  adventureEngineInitialized = true;

  const adventureInput = document.getElementById('adventure-input');
  const adventureSubmit = document.getElementById('adventure-submit');
  const adventureClear = document.getElementById('adventure-clear');
  const adventureForm = getAdventureForm();

  if (adventureForm && adventureInput) {
    adventureForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const action = adventureInput.value.trim();
      if (action && !adventureState.isProcessing) {
        adventureInput.value = '';
        await processAdventureActionWithStreaming(action);
      }
    });
  }

  if (adventureSubmit && adventureInput) {
    adventureSubmit.addEventListener('click', async () => {
      const action = adventureInput.value.trim();
      if (action && !adventureState.isProcessing) {
        adventureInput.value = '';
        await processAdventureActionWithStreaming(action);
      }
    });
  }

  if (adventureInput) {
    adventureInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !adventureState.isProcessing) {
        e.preventDefault();
        adventureSubmit?.click();
      }
    });
  }

  if (adventureClear) {
    adventureClear.addEventListener('click', () => {
      const container = getStoryContainer();
      if (container) container.innerHTML = '';

      adventureState.history = [];
      adventureState.context = {
        location: "Groq City Streets",
        quest: "None",
        health: 100,
        inventory: []
      };

      const locationEl = document.getElementById('adventure-location');
      const questEl = document.getElementById('adventure-quest');
      if (locationEl) locationEl.textContent = adventureState.context.location;
      if (questEl) questEl.textContent = adventureState.context.quest;

      addStoryEntry("⚔️ Your adventure begins in Groq City...", "system");
    });
  }
}

function addStoryEntry(text, type) {
  const container = getStoryContainer();
  if (!container) return;

  const entry = document.createElement('div');
  entry.className = `story-entry story-${type}`;
  entry.style.whiteSpace = "pre-wrap";

  const safeText = escapeHtml(text);

  if (type === 'player') {
    entry.innerHTML = `<span class="story-player">You:</span> ${safeText}`;
  } else if (type === 'ai') {
    entry.innerHTML = `<span class="story-ai">🎮 Game:</span> ${safeText}`;
  } else {
    entry.innerHTML = `<span class="story-system">⚙️ System:</span> ${safeText}`;
  }

  container.appendChild(entry);
  entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Keep adventure history
  adventureState.history.push({ type, text, timestamp: Date.now() });
  if (adventureState.history.length > 50) adventureState.history.shift();
}

function displayAdventureHistory() {
  const container = getStoryContainer();
  if (!container) return;

  container.innerHTML = '';

  // Display last 20 entries
  const recentHistory = adventureState.history.slice(-20);
  recentHistory.forEach(entry => {
    addStoryEntry(entry.text, entry.type);
  });
}

async function processAdventureActionWithStreaming(action) {
  if (!currentUser) {
    alert("Please login to play the adventure!");
    return;
  }
  
  adventureState.isProcessing = true;
  const submitBtn = document.getElementById('adventure-submit');
  const input = document.getElementById('adventure-input');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '🤔 Thinking...';
  submitBtn.disabled = true;
  input.disabled = true;
  
  addStoryEntry(action, "player");
  
  // Create a temporary entry for streaming
  const container = getStoryContainer();
  const streamingEntry = document.createElement('div');
  streamingEntry.className = 'story-entry story-ai streaming';
  streamingEntry.innerHTML = `<span class="story-ai">🎮 Game:</span> `;
  container.appendChild(streamingEntry);
  
  let streamedContent = '';
  
  try {
    const contextPrompt = buildAdventureContext(action);
    
    const response = await queryGroqWithStreaming(
      contextPrompt,
      `You are a text adventure game master for a gritty crime city called "Groq City". 
       You MUST respond with ONLY valid JSON in this exact format, no other text:
       {
         "narrative": "A vivid, immersive description (2-3 sentences)",
         "location": "New location or same", 
         "quest": "New quest or same", 
         "healthChange": 0,
         "moneyChange": 0,
         "reputationChange": 0,
         "itemFound": null,
         "combat": false
       }
       
       Be creative! Generate different responses based on the player's action.`,
      (chunk) => {
        streamedContent += chunk;
        // Update the streaming entry in real-time
        streamingEntry.innerHTML = `<span class="story-ai">🎮 Game:</span> ${escapeHtml(streamedContent)}`;
      }
    );
    
    // Process the complete response
    if (response) {
      const aiResponse = extractFirstJsonObject(response);

      if (aiResponse) {
        // Ensure all required fields exist
        const parsedResponse = {
          narrative: aiResponse.narrative || streamedContent,
          location: aiResponse.location || adventureState.context.location,
          quest: aiResponse.quest || adventureState.context.quest,
          healthChange: aiResponse.healthChange || 0,
          moneyChange: aiResponse.moneyChange || 0,
          reputationChange: aiResponse.reputationChange || 0,
          itemFound: aiResponse.itemFound || null,
          combat: aiResponse.combat || false
        };

        // Update the entry with the final parsed narrative
        streamingEntry.innerHTML = `<span class="story-ai">🎮 Game:</span> ${escapeHtml(parsedResponse.narrative)}`;

        await updateGameFromAdventure(parsedResponse);
        await saveAdventureState();
      } else {
        // No valid JSON: fall back to streamed content
        streamingEntry.innerHTML = `<span class="story-ai">🎮 Game:</span> ${escapeHtml(streamedContent || "The city streets stretch before you...")}`;

        const simpleResponse = {
          narrative: streamedContent || "The city streets stretch before you...",
          location: adventureState.context.location,
          quest: adventureState.context.quest,
          healthChange: 0,
          moneyChange: 0,
          reputationChange: 0,
          itemFound: null,
          combat: false
        };

        await updateGameFromAdventure(simpleResponse);
        await saveAdventureState();
      }
    }
      }
    }
    
  } catch (error) {
    console.error("Adventure error:", error);
    streamingEntry.innerHTML = `<span class="story-ai">🎮 Game:</span> The city's chaos makes it hard to think... Try again.`;
  } finally {
    adventureState.isProcessing = false;
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    input.disabled = false;
    input.focus();
    
    // Remove streaming class
    streamingEntry.classList.remove('streaming');
  }
}

async function updateGameFromAdventure(result) {
  // Update player stats
  playerData.money = (playerData.money || 0) + (result.moneyChange || 0);
  playerData.reputation = (playerData.reputation || 0) + (result.reputationChange || 0);
  
  // Update health (you might want to add health to playerData if not already there)
  if (!playerData.health) playerData.health = 100;
  playerData.health = Math.max(0, Math.min(100, playerData.health + (result.healthChange || 0)));
  
  // Update adventure context
  adventureState.context.location = result.location || adventureState.context.location;
  adventureState.context.quest = result.quest || adventureState.context.quest;
  adventureState.context.health = playerData.health;
  
  // Add item to inventory if found
  if (result.itemFound) {
    if (!playerData.inventory) playerData.inventory = [];
    playerData.inventory.push({
      name: result.itemFound,
      foundAt: Timestamp.now()
    });
    addStoryEntry(`Found item: ${result.itemFound}!`, "system");
  }
  
  // Handle combat
  if (result.combat) {
    addStoryEntry("You're in combat! Be careful...", "system");
  }
  
  // Update UI
  updatePlayerDisplay();
  
  const locationEl = document.getElementById('adventure-location');
  const questEl = document.getElementById('adventure-quest');
  if (locationEl) locationEl.textContent = adventureState.context.location;
  if (questEl) questEl.textContent = adventureState.context.quest;
}

async function saveAdventureState() {
  if (!currentUser) return;
  
  try {
    const playerRef = doc(db, "players", currentUser.uid);
    await updateDoc(playerRef, {
      money: playerData.money,
      reputation: playerData.reputation,
      inventory: playerData.inventory,
      stats: playerData.stats,
      adventureHistory: adventureState.history,
      adventureContext: adventureState.context,
      lastUpdate: Timestamp.now()
    });
  } catch (error) {
    console.error("Error saving adventure state:", error);
  }
}

function buildAdventureContext(action) {
  const recentHistory = adventureState.history.slice(-3).map(h => 
    `${h.type}: ${h.text}`
  ).join('\n');
  
  return `You are the AI narrator for Groq City, a gritty crime-filled metropolis.

Current game state:
- Location: ${adventureState.context.location}
- Active quest: ${adventureState.context.quest}
- Health: ${playerData.health || 100}
- Money: $${playerData.money}
- Reputation: ${playerData.reputation}
- Stats: Str ${playerData.stats.strength}, Agi ${playerData.stats.agility}, Int ${playerData.stats.intelligence}

Recent events:
${recentHistory}

Player's new action: "${action}"

Generate a UNIQUE response based on this specific action. Be creative! Don't repeat scenarios.
Respond with ONLY valid JSON in this exact format:
{
  "narrative": "A vivid, immersive 2-3 sentence description of what happens",
  "location": "New location (can be same or different)",
  "quest": "New quest or current quest",
  "healthChange": number between -30 and 30,
  "moneyChange": number between -200 and 500,
  "reputationChange": number between -10 and 20,
  "itemFound": "item name or null",
  "combat": true or false
}

Make it dark, gritty, and fit the crime city theme. The response should feel different for each action.`;
}

// ==================== LEADERBOARD FUNCTIONS ====================

async function showLeaderboard() {
  const leaderboardDiv = document.getElementById('leaderboard');
  if (!leaderboardDiv) return;
  
  try {
    const playersRef = collection(db, "players");
    const q = query(playersRef, orderBy("reputation", "desc"), limit(10));
    
    onSnapshot(q, (snapshot) => {
      let html = '<h2>🏆 Top Criminals</h2>';
      
      if (snapshot.empty) {
        html += '<p>No players yet. Be the first!</p>';
      } else {
        snapshot.forEach((doc, index) => {
          const data = doc.data();
          html += `
            <div class="leaderboard-item">
              <span class="leaderboard-rank">#${index + 1}</span>
              <span class="leaderboard-name">${doc.id.slice(0, 6)}...</span>
              <span class="leaderboard-rep">${data.reputation || 0} rep</span>
              <span class="leaderboard-money">$${data.money || 0}</span>
            </div>
          `;
        });
      }
      
      leaderboardDiv.innerHTML = html;
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    leaderboardDiv.innerHTML = '<p>Error loading leaderboard</p>';
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

// Initialize adventure engine when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initAdventureEngine();
});

console.log("Groq City game initialized with Streaming Adventure Engine!");
