import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  getDocs,
  increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ─── Firebase Init ───────────────────────────────────────────────────────────
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

// ─── State ───────────────────────────────────────────────────────────────────
let currentPlayer = null;
let playerDocRef = null;
let crimeCooldowns = {};

// Crime definitions
const CRIMES = {
  pickpocket:   { name: "Pickpocket",     nerve: 5,  successRate: 0.85, minReward: 20,  maxReward: 80,   xp: 2  },
  shoplifting:  { name: "Shoplift",       nerve: 10, successRate: 0.70, minReward: 50,  maxReward: 200,  xp: 5  },
  carjack:      { name: "Carjack",        nerve: 20, successRate: 0.50, minReward: 200, maxReward: 800,  xp: 15 },
  dealerdrug:   { name: "Deal Drugs",     nerve: 25, successRate: 0.55, minReward: 150, maxReward: 600,  xp: 12 },
  armrobbery:   { name: "Armed Robbery",  nerve: 40, successRate: 0.35, minReward: 500, maxReward: 2000, xp: 30 },
  realestate:   { name: "Real Estate Fraud", nerve: 35, successRate: 0.45, minReward: 400, maxReward: 1500, xp: 25 }
};

const TRAIN_STATS = {
  strength:     { cost: 50, energy: 20, field: "stats.strength",     label: "Strength" },
  agility:      { cost: 50, energy: 20, field: "stats.agility",      label: "Agility"  },
  intelligence: { cost: 50, energy: 20, field: "stats.intelligence", label: "Intelligence" }
};

const CRIME_COOLDOWN_MS = 10000; // 10 seconds between crimes

// ─── Rank system ─────────────────────────────────────────────────────────────
function getRank(score) {
  if (score < 100)   return "Street Punk";
  if (score < 500)   return "Corner Hustler";
  if (score < 1500)  return "Small Timer";
  if (score < 5000)  return "Made Man";
  if (score < 15000) return "OC Kingpin";
  return "Legend of the County";
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ""; }, 3000);
}

function logCrime(msg, type = "info") {
  const log = document.getElementById("crime-log");
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="ts">[${ts}]</span> <span class="${type}">${msg}</span>`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function addScannerEntry(msg) {
  const log = document.getElementById("scanner-log");
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="ts">[${ts}]</span> <span class="info">${msg}</span>`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// ─── Render Player Stats ─────────────────────────────────────────────────────
function renderPlayer(p) {
  if (!p) return;
  currentPlayer = p;

  document.getElementById("hdr-name").textContent = p.name || "Unknown";
  document.getElementById("hdr-rank").textContent = getRank(p.score || 0);

  document.getElementById("stat-money").textContent = `$${(p.inventory?.money || 0).toLocaleString()}`;

  const health = p.health ?? 100;
  document.getElementById("stat-health-val").textContent = health;
  document.getElementById("stat-health").style.width = `${health}%`;

  const energy = p.energy ?? 100;
  document.getElementById("stat-energy-val").textContent = energy;
  document.getElementById("stat-energy").style.width = `${energy}%`;

  const nerve = p.nerve ?? 100;
  document.getElementById("stat-nerve-val").textContent = nerve;
  document.getElementById("stat-nerve").style.width = `${nerve}%`;

  document.getElementById("stat-str").textContent = p.stats?.strength || 10;
  document.getElementById("stat-agi").textContent = p.stats?.agility || 10;
  document.getElementById("stat-int").textContent = p.stats?.intelligence || 10;
  document.getElementById("stat-wins").textContent = p.wins || 0;
  document.getElementById("stat-losses").textContent = p.losses || 0;

  // Train page values
  document.getElementById("tr-str").textContent = p.stats?.strength || 10;
  document.getElementById("tr-agi").textContent = p.stats?.agility || 10;
  document.getElementById("tr-int").textContent = p.stats?.intelligence || 10;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    showToast("Login failed: " + e.message, "fail");
  }
}

async function signup(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Create player document
    const name = prompt("What's your street name?") || "Anonymous";
    await setDoc(doc(db, "players", cred.user.uid), {
      name,
      health: 100,
      energy: 100,
      nerve: 100,
      score: 0,
      wins: 0,
      losses: 0,
      inventory: { money: 1000 },
      stats: { strength: 10, agility: 10, intelligence: 10 },
      userId: cred.user.uid,
      createdAt: Timestamp.now()
    });
  } catch (e) {
    showToast("Signup failed: " + e.message, "fail");
  }
}

async function logout() {
  await signOut(auth);
}

// ─── Load / Subscribe to player ──────────────────────────────────────────────
function subscribePlayer(uid) {
  playerDocRef = doc(db, "players", uid);
  return onSnapshot(playerDocRef, (snap) => {
    if (snap.exists()) {
      renderPlayer(snap.data());
    }
  });
}

// ─── Regen energy/nerve over time ────────────────────────────────────────────
setInterval(async () => {
  if (!playerDocRef || !currentPlayer) return;
  const updates = {};
  if ((currentPlayer.energy ?? 100) < 100) updates.energy = Math.min(100, (currentPlayer.energy ?? 100) + 1);
  if ((currentPlayer.nerve ?? 100) < 100)  updates.nerve  = Math.min(100, (currentPlayer.nerve ?? 100) + 1);
  if ((currentPlayer.health ?? 100) < 100) updates.health = Math.min(100, (currentPlayer.health ?? 100) + 1);
  if (Object.keys(updates).length > 0) await updateDoc(playerDocRef, updates);
}, 30000); // regen every 30s

// ─── Auth State ───────────────────────────────────────────────────────────────
let unsubscribePlayer = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("game-screen").style.display = "block";
    document.getElementById("user-email").textContent = user.email;

    if (unsubscribePlayer) unsubscribePlayer();
    unsubscribePlayer = subscribePlayer(user.uid);

    showLeaderboard();
  } else {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("game-screen").style.display = "none";
    if (unsubscribePlayer) { unsubscribePlayer(); unsubscribePlayer = null; }
    currentPlayer = null;
    playerDocRef = null;
  }
});

document.getElementById("login-btn").addEventListener("click", () => {
  login(document.getElementById("email").value, document.getElementById("password").value);
});
document.getElementById("signup-btn").addEventListener("click", () => {
  signup(document.getElementById("email").value, document.getElementById("password").value);
});
document.getElementById("logout-btn").addEventListener("click", logout);
document.getElementById("logout-btn2").addEventListener("click", logout);

// ─── Page Navigation ──────────────────────────────────────────────────────────
document.querySelectorAll(".nav-btn[data-page]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".game-page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("page-" + btn.dataset.page).classList.add("active");
  });
});

// ─── Crimes ──────────────────────────────────────────────────────────────────
document.querySelectorAll(".action-card[data-crime]").forEach(card => {
  card.addEventListener("click", async () => {
    if (!auth.currentUser || !currentPlayer || !playerDocRef) return;

    const crimeKey = card.dataset.crime;
    const crime = CRIMES[crimeKey];

    // Cooldown check
    const lastTime = crimeCooldowns[crimeKey] || 0;
    if (Date.now() - lastTime < CRIME_COOLDOWN_MS) {
      const remaining = Math.ceil((CRIME_COOLDOWN_MS - (Date.now() - lastTime)) / 1000);
      showToast(`Wait ${remaining}s before attempting another crime.`, "fail");
      return;
    }

    // Nerve check
    const nerve = currentPlayer.nerve ?? 100;
    if (nerve < crime.nerve) {
      showToast(`Not enough nerve! Need ${crime.nerve}, have ${nerve}.`, "fail");
      logCrime(`You didn't have enough nerve for ${crime.name}.`, "fail");
      return;
    }

    crimeCooldowns[crimeKey] = Date.now();

    // Deduct nerve
    await updateDoc(playerDocRef, { nerve: Math.max(0, nerve - crime.nerve) });

    // Roll for success
    const roll = Math.random();
    if (roll < crime.successRate) {
      const reward = Math.floor(crime.minReward + Math.random() * (crime.maxReward - crime.minReward));
      const newScore = (currentPlayer.score || 0) + crime.xp;
      const newMoney = (currentPlayer.inventory?.money || 0) + reward;

      await updateDoc(playerDocRef, {
        "inventory.money": newMoney,
        score: newScore
      });

      logCrime(`✓ ${crime.name} — scored $${reward.toLocaleString()}!`, "success");
      showToast(`+$${reward.toLocaleString()} — nice work.`, "success");

      // Police scanner reaction
      const scannerMessages = {
        pickpocket:  "Pickpocket reported near festival area, victim unsure of suspect description...",
        shoplifting: "South Coast Plaza security reports shoplifting incident, no arrest made...",
        carjack:     "Vehicle reported stolen, Newport Beach area. BOLO: late model BMW...",
        dealerdrug:  "Narcotics unit monitoring suspicious activity near Katella, Anaheim...",
        armrobbery:  "211 in progress — all units respond to Santa Ana check-cashing location!",
        realestate:  "DA's office investigating fraudulent deed filings in Laguna Niguel..."
      };
      addScannerEntry(scannerMessages[crimeKey] || "Police activity in the area...");

    } else {
      // Failed — lose some health
      const healthLoss = Math.floor(Math.random() * 10) + 5;
      const newHealth = Math.max(0, (currentPlayer.health ?? 100) - healthLoss);
      await updateDoc(playerDocRef, { health: newHealth });

      logCrime(`✗ ${crime.name} — busted! Lost ${healthLoss} HP.`, "fail");
      showToast(`Failed! Lost ${healthLoss} HP.`, "fail");

      addScannerEntry(`Suspect apprehended near ${['PCH', 'Harbor Blvd', 'Bristol St', 'MacArthur'][Math.floor(Math.random()*4)]}. Minor injuries reported...`);
    }
  });
});

// ─── Training ─────────────────────────────────────────────────────────────────
document.querySelectorAll(".train-card[data-train]").forEach(card => {
  card.addEventListener("click", async () => {
    if (!auth.currentUser || !currentPlayer || !playerDocRef) return;

    const trainKey = card.dataset.train;
    const t = TRAIN_STATS[trainKey];

    const energy = currentPlayer.energy ?? 100;
    const money = currentPlayer.inventory?.money || 0;

    if (energy < t.energy) {
      showToast(`Need ${t.energy} energy to train. Rest up.`, "fail");
      return;
    }
    if (money < t.cost) {
      showToast(`Need $${t.cost} to train. Get some cash first.`, "fail");
      return;
    }

    const statPath = `stats.${trainKey}`;
    const currentVal = currentPlayer.stats?.[trainKey] || 10;

    await updateDoc(playerDocRef, {
      energy: energy - t.energy,
      "inventory.money": money - t.cost,
      [statPath]: currentVal + 1
    });

    showToast(`${t.label} increased to ${currentVal + 1}!`, "success");
    logCrime(`💪 Trained ${t.label} — now at ${currentVal + 1}.`, "info");
  });
});

// ─── Fight System ─────────────────────────────────────────────────────────────
document.getElementById("find-players-btn").addEventListener("click", async () => {
  if (!auth.currentUser || !currentPlayer) return;

  document.getElementById("fight-ticker").textContent = "// scanning OC for targets...";
  document.getElementById("player-list").innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-dim); font-size:0.8rem;">Scanning...</div>`;

  const q = query(collection(db, "players"), orderBy("score", "desc"), limit(10));
  const snap = await getDocs(q);
  const list = document.getElementById("player-list");
  list.innerHTML = "";

  let found = 0;
  snap.forEach(d => {
    if (d.id === auth.currentUser.uid) return; // skip self
    const p = d.data();
    const row = document.createElement("div");
    row.className = "pl-item";
    row.innerHTML = `
      <div>
        <div class="pl-name">${p.name || "Unknown"}</div>
        <div class="pl-stats">STR ${p.stats?.strength || 10} | AGI ${p.stats?.agility || 10} | INT ${p.stats?.intelligence || 10} | 💰 $${(p.inventory?.money || 0).toLocaleString()}</div>
      </div>
      <button class="fight-btn" data-uid="${d.id}">ATTACK</button>
    `;
    list.appendChild(row);
    found++;
  });

  if (found === 0) {
    list.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-dim); font-size:0.8rem;">No other players found. OC is quiet for now...</div>`;
  }

  document.getElementById("fight-ticker").textContent = `// found ${found} target(s) in the county`;

  // Attach fight buttons
  list.querySelectorAll(".fight-btn").forEach(btn => {
    btn.addEventListener("click", () => fightPlayer(btn.dataset.uid));
  });
});

async function fightPlayer(targetUid) {
  if (!auth.currentUser || !currentPlayer || !playerDocRef) return;

  const energy = currentPlayer.energy ?? 100;
  if (energy < 20) {
    showToast("Need 20 Energy to fight. Rest up.", "fail");
    return;
  }

  // Load target
  const targetSnap = await getDoc(doc(db, "players", targetUid));
  if (!targetSnap.exists()) { showToast("Target not found.", "fail"); return; }
  const target = targetSnap.data();

  // Combat formula: weighted random based on stats
  const myPower = (currentPlayer.stats?.strength || 10) * 2 + (currentPlayer.stats?.agility || 10) + Math.random() * 20;
  const theirPower = (target.stats?.strength || 10) * 2 + (target.stats?.agility || 10) + Math.random() * 20;

  const won = myPower > theirPower;
  const healthLoss = Math.floor(Math.random() * 15) + 5;

  // Deduct energy from attacker
  await updateDoc(playerDocRef, {
    energy: energy - 20,
    health: Math.max(0, (currentPlayer.health ?? 100) - healthLoss)
  });

  if (won) {
    const stolen = Math.floor((target.inventory?.money || 0) * 0.1); // steal 10%
    await updateDoc(playerDocRef, {
      "inventory.money": (currentPlayer.inventory?.money || 0) + stolen,
      score: (currentPlayer.score || 0) + 20,
      wins: (currentPlayer.wins || 0) + 1
    });
    await updateDoc(doc(db, "players", targetUid), {
      "inventory.money": Math.max(0, (target.inventory?.money || 0) - stolen),
      health: Math.max(0, (target.health ?? 100) - 20),
      losses: (target.losses || 0) + 1
    });

    logCrime(`⚔️ Fought ${target.name} and WON — stole $${stolen.toLocaleString()}!`, "success");
    showToast(`Beat ${target.name}! Stole $${stolen.toLocaleString()}.`, "success");
  } else {
    await updateDoc(doc(db, "players", targetUid), {
      wins: (target.wins || 0) + 1
    });
    await updateDoc(playerDocRef, {
      losses: (currentPlayer.losses || 0) + 1
    });
    logCrime(`⚔️ Attacked ${target.name} and LOST. Took ${healthLoss} damage.`, "fail");
    showToast(`Lost the fight. Took ${healthLoss} HP damage.`, "fail");
  }

  // Refresh player list
  document.getElementById("find-players-btn").click();
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
function showLeaderboard() {
  const q = query(collection(db, "players"), orderBy("score", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    const list = document.getElementById("leaderboard-list");
    list.innerHTML = "";
    let rank = 1;
    snap.forEach(d => {
      const p = d.data();
      const row = document.createElement("div");
      row.className = "lb-row";
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.name || "Unknown"}</span>
        <span class="lb-score">${(p.score || 0).toLocaleString()}</span>
      `;
      list.appendChild(row);
      rank++;
    });
    if (rank === 1) {
      list.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-dim); font-size:0.75rem;">No criminals yet...</div>`;
    }
  });
}
