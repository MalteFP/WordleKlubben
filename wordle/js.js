let numLetters = 5
let solution = ""
let cols


document.addEventListener("DOMContentLoaded", start);

function start() {
    solution = "FERIE"
    cols = solution.length
    board.style.setProperty("--cols", cols);

    createBoard();
    createKeyboard();
}


function setupWordPrompt() {
    const modal = document.getElementById("wordPrompt");
    const input = document.getElementById("wordInput");
    const button = document.getElementById("wordSubmit");

    button.addEventListener("click", () => {
        let word = input.value.trim();

        if (word.length === 0) return;

        word = word.toUpperCase();

        // Set solution + dynamic column count
        solution = word;
        cols = word.length;

        // Update CSS variable for tile sizing
        board.style.setProperty("--cols", cols);

        // Clear board + keyboard
        board.innerHTML = "";
        keyboard.innerHTML = "";
        message.textContent = "";

        // Build game
        createBoard();
        createKeyboard();

        // Hide modal
        modal.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => modal.style.display = "none", 300);
    });
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

// Du kan ændre løsningen her (skal være 5 bogstaver)
solution = "";
cols = 5; // temporary, overwritten after prompt

const rows = 6;

let currentRow = 0;
let currentCol = 0;
let gameOver = false;

const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const message = document.getElementById("message");

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
    if (gameOver) return;

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
    if (validChars.includes(key)) {
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
        showMessage("Ordet skal være 5 bogstaver.");
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
    let key = e.key.toLowerCase();

    if (key === "enter") {
        handleKey("enter");
    } else if (key === "backspace") {
        handleKey("back");
    } else {
        handleKey(key);
    }
});
