// app.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, getDocs, query, orderBy, where,
  onSnapshot, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ----------------- KONFIGURACJA FIREBASE -----------------
// Wklej tutaj konfigurację z konsoli Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM / templates
const main = document.getElementById("main");
const templates = {};
document.querySelectorAll("template").forEach(t => templates[t.id] = t.content);

const userInfoEl = document.getElementById("user_info");
const btnProjects = document.getElementById("btn_projects");
const btnBack = document.getElementById("btn_back");
const btnAdd = document.getElementById("btn_add");

btnProjects.addEventListener("click", showProjects);
btnBack.addEventListener("click", showHome);
btnAdd.addEventListener("click", () => openEditor(null));

// --- auth UI
async function ensureSignedIn(){
  if (!auth.currentUser) {
    // spróbuj anonimowo, jeśli chcesz prostsze logowanie; możesz też wymusić Google
    try {
      await signInAnonymously(auth);
    } catch(e){
      // fallback: Google popup
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    }
  }
}

onAuthStateChanged(auth, user => {
  if(user){
    userInfoEl.textContent = user.isAnonymous ? "Anonim" : (user.displayName || user.email);
  } else {
    userInfoEl.textContent = "";
  }
});

// --- initial
showHome();

// ----------------- HOME -----------------
function showHome(){
  main.innerHTML = "";
  const node = templates["home-template"].cloneNode(true);
  main.appendChild(node);
  const input = document.getElementById("search_input");
  const go = document.getElementById("search_go");
  const suggestions = document.getElementById("suggestions");

  input.addEventListener("input", updateSuggestions);
  input.addEventListener("keydown", e => { if(e.key === "Enter") openByName(input.value.trim()); });
  go.addEventListener("click", () => openByName(input.value.trim()));
  document.getElementById("open_bot").addEventListener("click", showBot);

  updateSuggestions();

  async function updateSuggestions(){
    suggestions.innerHTML = "";
    const q = input.value.trim().toLowerCase();
    if(!q) return;
    // fetch all pages and filter client-side (small scale). For large scale use indexed queries.
    const pagesSnap = await getDocs(collection(db, "pages"));
    const matches = [];
    pagesSnap.forEach(d => {
      const name = d.data().name || d.id;
      if(name.toLowerCase().includes(q)) matches.push({id:d.id, name});
    });
    matches.slice(0,6).forEach(m => {
      const btn = document.createElement("button");
      btn.textContent = "  " + m.name;
      btn.addEventListener("click", () => openPage(m.id));
      suggestions.appendChild(btn);
    });
  }
}

async function openByName(name){
  if(!name) return;
  // find page by exact name
  const q = query(collection(db, "pages"), where("nameLower", "==", name.toLowerCase()));
  const snap = await getDocs(q);
  if(!snap.empty){
    const docRef = snap.docs[0];
    openPage(docRef.id);
  } else {
    alert("Nie znaleziono strony: " + name);
  }
}

// ----------------- PROJECTS (lista wszystkich) -----------------
async function showProjects(){
  main.innerHTML = "";
  const node = templates["projects-template"].cloneNode(true);
  main.appendChild(node);
  const grid = document.getElementById("projects_grid");

  // realtime snapshot: pokazuj wszystkie strony posortowane po dacie utworzenia
  const q = query(collection(db, "pages"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    grid.innerHTML = "";
    if(snap.empty){
      grid.innerHTML = "<p style='color:var(--fg2)'>Brak stron. Kliknij '+ Dodaj stronę'!</p>";
      return;
    }
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const name = data.name;
      const page = data;
      const card = document.createElement("div");
      card.className = "card";
      if(page.image_b64){
        const img = document.createElement("img");
        img.src = page.image_b64;
        card.appendChild(img);
      }
      const h = document.createElement("div");
      h.style.color = "var(--accent)";
      h.style.fontFamily = "Georgia";
      h.style.fontWeight = "700";
      h.textContent = name;
      card.appendChild(h);

      const preview = document.createElement("div");
      preview.style.color = "var(--fg2)";
      preview.style.margin = "8px 0";
      preview.textContent = (page.content || "").slice(0,80) + ((page.content||"").length>80 ? "..." : "");
      card.appendChild(preview);

      const btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.gap = "8px";

      const openBtn = document.createElement("button");
      openBtn.className = "btn";
      openBtn.textContent = "Otwórz";
      openBtn.addEventListener("click", ()=> openPage(docSnap.id));
      btnRow.appendChild(openBtn);

      // Edycja dostępna tylko dla właściciela — UI ukrywa przycisk dla innych
      const currentUser = auth.currentUser;
      if(currentUser && page.ownerUid === currentUser.uid){
        const editBtn = document.createElement("button");
        editBtn.className = "btn";
        editBtn.textContent = "Edytuj";
        editBtn.addEventListener("click", ()=> openEditor(docSnap.id));
        btnRow.appendChild(editBtn);

        // opcjonalnie: jeśli chcesz całkowicie zablokować usuwanie, nie dodawaj przycisku usuwania
        // jeśli chcesz dać możliwość usuwania właścicielowi, odkomentuj poniższe:
        // const delBtn = document.createElement("button");
        // delBtn.className = "btn";
        // delBtn.style.color = "var(--danger)";
        // delBtn.textContent = "Usuń";
        // delBtn.addEventListener("click", ()=> deletePage(docSnap.id));
        // btnRow.appendChild(delBtn);
      }

      card.appendChild(btnRow);
      grid.appendChild(card);
    });
  }, err => {
    grid.innerHTML = "<p style='color:var(--danger)'>Błąd ładowania: " + err.message + "</p>";
  });
}

// ----------------- OPEN PAGE -----------------
async function openPage(docId){
  const docRef = doc(db, "pages", docId);
  const snap = await getDoc(docRef);
  if(!snap.exists()) return alert("Brak strony");
  const page = snap.data();
  main.innerHTML = "";
  const node = templates["page-template"].cloneNode(true);
  node.getElementById("page_title").textContent = page.name;
  const imgDiv = node.getElementById("page_image");
  if(page.image_b64){
    const img = document.createElement("img");
    img.src = page.image_b64;
    img.style.maxWidth = "860px";
    imgDiv.appendChild(img);
  }
  node.getElementById("page_content").innerText = page.content || "";
  const meta = node.getElementById("page_meta");
  meta.textContent = `Utworzone: ${page.createdAt ? new Date(page.createdAt.seconds*1000).toLocaleString() : "?"} • Autor: ${page.ownerName || "Anonim"}`;
  main.appendChild(node);
}

// ----------------- EDITOR / CREATE -----------------
function openEditor(docId){
  // wymuś logowanie
  ensureSignedIn().then(() => _openEditor(docId));
}

async function _openEditor(docId){
  main.innerHTML = "";
  const node = templates["editor-template"].cloneNode(true);
  main.appendChild(node);
  const title = document.getElementById("editor_title");
  const nameInput = document.getElementById("editor_name");
  const contentInput = document.getElementById("editor_content");
  const imgFile = document.getElementById("img_file");
  const imgStatus = document.getElementById("img_status");

  let image_b64 = null;
  let isEdit = false;
  if(docId){
    // edycja — tylko właściciel może edytować (UI wywołuje edycję tylko dla właściciela)
    const snap = await getDoc(doc(db, "pages", docId));
    if(!snap.exists()) return alert("Strona nie istnieje");
    const page = snap.data();
    title.textContent = "Edytuj stronę: " + page.name;
    nameInput.value = page.name;
    nameInput.disabled = true;
    contentInput.value = page.content || "";
    if(page.image_b64){ image_b64 = page.image_b64; imgStatus.textContent = "Zdjęcie załadowane"; imgStatus.style.color = "var(--success)"; }
    isEdit = true;
  }

  imgFile.addEventListener("change", e=>{
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      image_b64 = reader.result;
      imgStatus.textContent = "OK: " + f.name;
      imgStatus.style.color = "var(--success)";
    };
    reader.readAsDataURL(f);
  });

  document.getElementById("save_page").addEventListener("click", async ()=>{
    const newName = nameInput.value.trim();
    if(!newName) return alert("Podaj nazwę strony!");
    const content = contentInput.value;
    const currentUser = auth.currentUser;
    if(!currentUser) return alert("Musisz być zalogowany");

    if(isEdit){
      // update — tylko właściciel może (serwerowe reguły Firestore też to wymuszą)
      const ref = doc(db, "pages", docId);
      await updateDoc(ref, {
        content,
        image_b64: image_b64 || null,
        updatedAt: serverTimestamp()
      });
      openPage(docId);
    } else {
      // create
      const docRef = await addDoc(collection(db, "pages"), {
        name: newName,
        nameLower: newName.toLowerCase(),
        content,
        image_b64: image_b64 || null,
        ownerUid: currentUser.uid,
        ownerName: currentUser.isAnonymous ? "Anonim" : (currentUser.displayName || currentUser.email || "Użytkownik"),
        createdAt: serverTimestamp()
      });
      openPage(docRef.id);
    }
  });

  document.getElementById("cancel_edit").addEventListener("click", showHome);
}

// ----------------- BOT (Markov) -----------------
function showBot(){
  main.innerHTML = "";
  const node = templates["bot-template"].cloneNode(true);
  main.appendChild(node);
  const chat = document.getElementById("chat");
  const input = document.getElementById("bot_input");
  const send = document.getElementById("bot_send");

  addBubble("Bot: Czesc! Jestem Petra Botem. Napisz cos, a odpowiem :)", "bot");

  send.addEventListener("click", sendMsg);
  input.addEventListener("keydown", e => { if(e.key === "Enter") sendMsg(); });

  function addBubble(text, cls){
    const b = document.createElement("div");
    b.className = "bubble " + (cls || "bot");
    b.textContent = text;
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  function sendMsg(){
    const msg = input.value.trim();
    if(!msg) return;
    input.value = "";
    addBubble("Ty: " + msg, "user");
    addBubble("Bot: ...", "bot");
    setTimeout(()=>{
      const reply = markovReply(msg);
      const bubbles = chat.querySelectorAll(".bubble.bot");
      if(bubbles.length) bubbles[bubbles.length-1].textContent = "Bot: " + reply;
      chat.scrollTop = chat.scrollHeight;
    }, 300);
  }
}

// ----------------- MARKOV (prosty) -----------------
const KORPUS = `Czesc to jest przykładowy korpus. Petra bot odpowiada losowo na podstawie modelu Markova. Dodaj tu wiecej tekstu aby bot mial z czego generowac.`.toLowerCase();
const corpusWords = KORPUS.match(/\w+/g) || [];
const mapaNormalizacji = {};
function normalizuj(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,"")
  .replace(/ą/g,"a").replace(/ć/g,"c").replace(/ę/g,"e").replace(/ł/g,"l")
  .replace(/ń/g,"n").replace(/ó/g,"o").replace(/ś/g,"s").replace(/ź/g,"z").replace(/ż/g,"z"); }
corpusWords.forEach(w=>{
  const norm = normalizuj(w);
  if(!mapaNormalizacji[norm]) mapaNormalizacji[norm] = [];
  mapaNormalizacji[norm].push(w);
});
const model = {};
for(let i=0;i<corpusWords.length-1;i++){
  const w1 = corpusWords[i], w2 = corpusWords[i+1];
  model[w1] = model[w1] || [];
  model[w1].push(w2);
}
function generuj_odpowiedz(input_text, max_len=12){
  const user_words = (input_text.toLowerCase().match(/\w+/g) || []).map(normalizuj);
  if(user_words.length === 0) return "Nie rozumiem";
  const znane = user_words.filter(w => mapaNormalizacji[w]);
  if(znane.length === 0) return "Nie rozumiem";
  const start_norm = znane[Math.floor(Math.random()*znane.length)];
  const start = mapaNormalizacji[start_norm][Math.floor(Math.random()*mapaNormalizacji[start_norm].length)];
  const wynik = [start];
  for(let i=0;i<max_len-1;i++){
    const ostatnie = wynik[wynik.length-1];
    if(!model[ostatnie]) break;
    wynik.push(model[ostatnie][Math.floor(Math.random()*model[ostatnie].length)]);
  }
  return wynik.join(" ");
}
function markovReply(msg){ try{ return generuj_odpowiedz(msg); }catch(e){ return "Błąd Markov"; } }
