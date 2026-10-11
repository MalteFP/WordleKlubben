// ---------- Spil-tilstand ----------
let solution = "";
let cols = 5;
const rows = 6;

let currentRow = 0;
let currentCol = 0;
let gameOver = false;

const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const message = document.getElementById("message");

const setupModal = document.getElementById("setupModal");
const chooseModal = document.getElementById("chooseModal");
const restartBtn = document.getElementById("restartBtn");

const MIN_LEN = 2;
const MAX_LEN = 10;
const VALID_WORD = /^[a-zæøå]+$/i;

// ---------- Kryptering (AES-GCM) ----------
// Ordene krypteres og lægges i URL'ens #-del, så de ikke kan læses direkte.
// BEMÆRK: Nøglen ligger i denne fil, så det er "svær at læse", ikke "umuligt at knække".
// Skift SECRET til noget eget, før du deler siden.
const SECRET = "wordle-klubben-skift-mig-til-noget-eget";
const SALT = "wordle-klubben-salt-v1";

async function getKey() {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey(
        "raw", enc.encode(SECRET), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode(SALT), iterations: 100000, hash: "SHA-256" },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

function toBase64Url(bytes) {
    let bin = "";
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const bin = atob(str);
    return Uint8Array.from(bin, ch => ch.charCodeAt(0));
}

async function encryptWords(words) {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(words));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));

    const out = new Uint8Array(iv.length + cipher.length);
    out.set(iv, 0);
    out.set(cipher, iv.length);
    return toBase64Url(out);
}

async function decryptWords(token) {
    const bytes = fromBase64Url(token);
    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);
    const key = await getKey();
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    const words = JSON.parse(new TextDecoder().decode(plain));

    if (!Array.isArray(words) || words.length !== 3) throw new Error("Ugyldige data");
    return words.map(w => String(w).toUpperCase());
}

// ---------- Opstart ----------
let loadedWords = null;

document.addEventListener("DOMContentLoaded", start);

async function start() {
    setupMenuEvents();

    if (!window.crypto || !crypto.subtle) {
        openSetup("Din browser understøtter ikke kryptering her. Åbn siden via https:// eller localhost.");
        return;
    }

    const token = getTokenFromUrl();
    if (!token) {
        openSetup();
        return;
    }

    try {
        loadedWords = await decryptWords(token);
        openChoose();
    } catch (err) {
        openSetup("Linket er ugyldigt eller beskadiget. Lav et nyt herunder.");
    }
}

function getTokenFromUrl() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    return params.get("d");
}

// ---------- Menuer ----------
function openSetup(errorText) {
    chooseModal.hidden = true;
    setupModal.hidden = false;
    document.getElementById("setupError").textContent = errorText || "";
}

function openChoose() {
    setupModal.hidden = true;
    chooseModal.hidden = false;
}

function setupMenuEvents() {
    const createBtn = document.getElementById("createBtn");
    const linkBox = document.getElementById("linkBox");
    const linkOutput = document.getElementById("linkOutput");
    const copyBtn = document.getElementById("copyBtn");
    const openBtn = document.getElementById("openBtn");
    const errorBox = document.getElementById("setupError");

    createBtn.addEventListener("click", async () => {
        const words = ["word1", "word2", "word3"].map(id =>
            document.getElementById(id).value.trim().toUpperCase()
        );

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (w.length < MIN_LEN || w.length > MAX_LEN) {
                errorBox.textContent = `${i + 1}.g: ordet skal være ${MIN_LEN}-${MAX_LEN} bogstaver.`;
                return;
            }
            if (!VALID_WORD.test(w)) {
                errorBox.textContent = `${i + 1}.g: brug kun bogstaverne a-z, æ, ø og å.`;
                return;
            }
        }

        errorBox.textContent = "";
        const token = await encryptWords(words);
        const base = location.href.split("#")[0];
        linkOutput.value = `${base}#d=${token}`;
        linkBox.hidden = false;
        linkOutput.select();
    });

    copyBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(linkOutput.value);
        } catch (e) {
            linkOutput.select();
            document.execCommand("copy");
        }
        copyBtn.textContent = "Kopieret! ✓";
        setTimeout(() => copyBtn.textContent = "Kopiér link", 1500);
    });

    openBtn.addEventListener("click", () => {
        location.href = linkOutput.value;
        location.reload();
    });

    document.querySelectorAll(".choice-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const index = Number(btn.getAttribute("data-index"));
            chooseModal.hidden = true;
            startGame(loadedWords[index]);
        });
    });

    document.getElementById("newWordsBtn").addEventListener("click", () => {
        history.replaceState(null, "", location.href.split("#")[0]);
        loadedWords = null;
        openSetup();
    });

    restartBtn.addEventListener("click", () => {
        if (loadedWords) openChoose();
    });
}

// ---------- Spillet ----------
function startGame(word) {
    solution = word.toUpperCase();
    cols = solution.length;

    currentRow = 0;
    currentCol = 0;
    gameOver = false;

    board.style.setProperty("--cols", cols);
    board.innerHTML = "";
    keyboard.innerHTML = "";
    message.textContent = "";
    restartBtn.hidden = false;

    createBoard();
    createKeyboard();
}

function colorKeyboard(letter, result) {
    const key = document.querySelector(`button[data-key="${letter.toLowerCase()}"]`);
    if (!key) return;

    // Prioritet: grøn > gul > grå
    const current = key.getAttribute("data-state");

    if (current === "correct") return; // grøn må aldrig nedgraderes
    if (current === "present" && result === "absent") return; // gul må ikke blive grå

    key.setAttribute("data-state", result);

    if (result === "correct") key.style.background = "#6aaa64";
    else if (result === "present") key.style.background = "#c9b458";
    else key.style.background = "#3a3a3c";
}

// Lav brættet
function createBoard() {
    for (let r = 0; r < rows; r++) {
        const rowDiv = document.createElement("div");
        rowDiv.classList.add("row");
        for (let c = 0; c < cols; c++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");
            tile.setAttribute("data-row", r);
            tile.setAttribute("data-col", c);
            rowDiv.appendChild(tile);
        }
        board.appendChild(rowDiv);
    }
}

// Dansk tastatur inkl. æ, ø, å
const keyboardLayout = [
    "q w e r t y u i o p".split(" "),
    "a s d f g h j k l æ".split(" "),
    ["enter", ..."z x c v b n m ø å".split(" "), "back"]
];

function createKeyboard() {
    keyboardLayout.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.classList.add("kb-row");
        row.forEach(key => {
            const btn = document.createElement("button");
            btn.classList.add("key");
            if (key === "enter" || key === "back") {
                btn.classList.add("wide");
            }
            btn.textContent = key === "back" ? "⌫" : key;
            btn.setAttribute("data-key", key);
            btn.addEventListener("click", () => handleKey(key));
            rowDiv.appendChild(btn);
        });
        keyboard.appendChild(rowDiv);
    });
}

function showMessage(text) {
    message.textContent = text;
}

function getTile(row, col) {
    return document.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
}

function handleKey(key) {
    if (gameOver || !solution) return;

    key = key.toLowerCase();

    if (key === "enter") {
        if (currentCol === cols) {
            submitGuess();
        } else {
            showMessage("Ordet skal være " + cols + " bogstaver.");
        }
        return;
    }

    if (key === "back") {
        if (currentCol > 0) {
            currentCol--;
            const tile = getTile(currentRow, currentCol);
            tile.textContent = "";
            tile.classList.remove("filled");
        }
        return;
    }

    // Tillad bogstaver a-z + æøå
    const validChars = "abcdefghijklmnopqrstuvwxyzæøå";
    if (key.length === 1 && validChars.includes(key)) {
        if (currentCol < cols) {
            const tile = getTile(currentRow, currentCol);
            tile.textContent = key.toUpperCase();
            tile.classList.add("filled");
            currentCol++;
        }
    }
}

function submitGuess() {
    let guess = "";
    for (let c = 0; c < cols; c++) {
        guess += getTile(currentRow, c).textContent;
    }

    // INGEN ordbogstjek – kun længde
    if (guess.length !== cols) {
        showMessage("Ordet skal være " + cols + " bogstaver.");
        return;
    }

    const solutionArray = solution.split("");
    const guessArray = guess.split("");

    // Først markér korrekte bogstaver
    const result = Array(cols).fill("absent");
    const solutionUsed = Array(cols).fill(false);

    for (let i = 0; i < cols; i++) {
        if (guessArray[i] === solutionArray[i]) {
            result[i] = "correct";
            solutionUsed[i] = true;
        }
    }

    // Så markér bogstaver der findes, men i forkert position
    for (let i = 0; i < cols; i++) {
        if (result[i] === "correct") continue;
        for (let j = 0; j < cols; j++) {
            if (!solutionUsed[j] && guessArray[i] === solutionArray[j]) {
                result[i] = "present";
                solutionUsed[j] = true;
                break;
            }
        }
    }

    // Opdater felter
    for (let c = 0; c < cols; c++) {
        const tile = getTile(currentRow, c);
        tile.classList.add(result[c]);
        colorKeyboard(guessArray[c], result[c]);
    }

    if (guess === solution) {
        showMessage("Du gættede ordet! 🎉");
        gameOver = true;
        return;
    }

    currentRow++;
    currentCol = 0;

    if (currentRow === rows) {
        showMessage("Spillet er slut. Ordet var: " + solution);
        gameOver = true;
    } else {
        showMessage("");
    }
}

// Understøt fysisk tastatur (inkl. æøå)
document.addEventListener("keydown", (e) => {
    // Ignorer tastetryk mens en menu er åben eller man skriver i et inputfelt
    if (!setupModal.hidden || !chooseModal.hidden) return;
    if (e.target.tagName === "INPUT") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    let key = e.key.toLowerCase();

    if (key === "enter") {
        handleKey("enter");
    } else if (key === "backspace") {
        handleKey("back");
    } else {
        handleKey(key);
    }
});
