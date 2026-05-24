// app.js — Petra Browser (Web) simplified
const DATA_KEY = "petra_pages_v1";

// --- prosty loader/saver (localStorage) ---
function loadData(){
  try{
    return JSON.parse(localStorage.getItem(DATA_KEY)) || { pages: {} };
  }catch(e){
    return { pages: {} };
  }
}
function saveData(data){
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}
let DATA = loadData();

// --- helpery DOM ---
const main = document.getElementById("main");
const templates = {};
document.querySelectorAll("template").forEach(t => templates[t.id] = t.content);

// --- initial render ---
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
  document.getElementById("btn_add").addEventListener("click", () => openEditor(null));

  updateSuggestions();

  function updateSuggestions(){
    suggestions.innerHTML = "";
    const q = input.value.trim().toLowerCase();
    if(!q) return;
    const matches = Object.keys(DATA.pages).filter(n => n.toLowerCase().includes(q)).slice(0,6);
    matches.forEach(m => {
      const btn = document.createElement("button");
      btn.textContent = "  " + m;
      btn.addEventListener("click", () => openPage(m));
      suggestions.appendChild(btn);
    });
  }
}

function openByName(name){
  if(!name) return;
  const found = Object.keys(DATA.pages).find(n => n.toLowerCase() === name.toLowerCase());
  if(found) return openPage(found);
  alert("Nie znaleziono strony: " + name);
}

function showProjects(){
  main.innerHTML = "";
  const node = templates["projects-template"].cloneNode(true);
  main.appendChild(node);
  const grid = document.getElementById("projects_grid");
  if(Object.keys(DATA.pages).length === 0){
    grid.innerHTML = "<p style='color:var(--fg2)'>Brak stron. Kliknij '+ Dodaj stronę'!</p>";
    return;
  }
  Object.entries(DATA.pages).forEach(([name,page])=>{
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
    preview.textContent = (page.content || "").slice(0,80) + (page.content && page.content.length>80 ? "..." : "");
    card.appendChild(preview);

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";

    const openBtn = document.createElement("button");
    openBtn.className = "btn";
    openBtn.textContent = "Otwórz";
    openBtn.addEventListener("click", ()=> openPage(name));
    btnRow.appendChild(openBtn);

    const editBtn = document.createElement("button");
    editBtn.className = "btn";
    editBtn.textContent = "Edytuj";
    editBtn.addEventListener("click", ()=> openEditor(name));
    btnRow.appendChild(editBtn);

    // UWAGA: usunięto przycisk "Usuń" — użytkownicy nie mogą usuwać stron
    card.appendChild(btnRow);
    grid.appendChild(card);
  });
}

function openPage(name){
  const page = DATA.pages[name];
  if(!page) return alert("Brak strony");
  main.innerHTML = "";
  const node = templates["page-template"].cloneNode(true);
  node.getElementById("page_title").textContent = name;
  const imgDiv = node.getElementById("page_image");
  if(page.image_b64){
    const img = document.createElement("img");
    img.src = page.image_b64;
    img.style.maxWidth = "860px";
    imgDiv.appendChild(img);
  }
  node.getElementById("page_content").innerText = page.content || "";
  main.appendChild(node);
}

function openEditor(name){
  main.innerHTML = "";
  const node = templates["editor-template"].cloneNode(true);
  main.appendChild(node);
  const title = document.getElementById("editor_title");
  const nameInput = document.getElementById("editor_name");
  const contentInput = document.getElementById("editor_content");
  const imgFile = document.getElementById("img_file");
  const imgStatus = document.getElementById("img_status");

  let image_b64 = null;
  if(name){
    title.textContent = "Edytuj stronę: " + name;
    const page = DATA.pages[name] || {};
    nameInput.value = name;
    nameInput.disabled = true; // zgodnie z oryginałem
    contentInput.value = page.content || "";
    if(page.image_b64){ image_b64 = page.image_b64; imgStatus.textContent = "Zdjęcie załadowane"; imgStatus.style.color = "var(--success)"; }
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

  document.getElementById("save_page").addEventListener("click", ()=>{
    const newName = nameInput.value.trim();
    if(!newName) return alert("Podaj nazwę strony!");
    const content = contentInput.value;
    DATA.pages[newName] = { content, image_b64 };
    saveData(DATA);
    openPage(newName);
  });

  document.getElementById("cancel_edit").addEventListener("click", showHome);
}

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
    // asynchroniczne "myślenie"
    setTimeout(()=>{
      const reply = markovReply(msg);
      // usuń ostatni "Bot: ..." i dodaj odpowiedź
      const bubbles = chat.querySelectorAll(".bubble.bot");
      if(bubbles.length) bubbles[bubbles.length-1].textContent = "Bot: " + reply;
      chat.scrollTop = chat.scrollHeight;
    }, 300);
  }
}

// ----------------- MARKOV (prosty port JS) -----------------
// KORPUS: w praktyce wstaw tu tekst korpusu (może być długi). Dla przykładu używamy krótkiego fragmentu.
// Możesz podmienić zawartość KORPUS na pełny tekst z oryginału.
const KORPUS = `Czesc to jest przykładowy korpus. Petra bot odpowiada losowo na podstawie modelu Markova. Dodaj tu wiecej tekstu aby bot mial z czego generowac.`.toLowerCase();

const corpusWords = KORPUS.match(/\w+/g) || [];
const mapaNormalizacji = {};
function normalizuj(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,"")
           .replace(/ą/g,"a").replace(/ć/g,"c").replace(/ę/g,"e")
           .replace(/ł/g,"l").replace(/ń/g,"n").replace(/ó/g,"o")
           .replace(/ś/g,"s").replace(/ź/g,"z").replace(/ż/g,"z");
}
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

function markovReply(msg){
  try{
    return generuj_odpowiedz(msg);
  }catch(e){
    return "Błąd Markov: " + (e.message || e);
  }
}

// --- topbar buttons ---
document.getElementById("btn_projects").addEventListener("click", showProjects);
document.getElementById("btn_back").addEventListener("click", showHome);
document.getElementById("btn_add").addEventListener("click", ()=> openEditor(null));

// initial
showHome();
