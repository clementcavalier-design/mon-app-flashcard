const GOOGLE_DATA_URL = 'https://docs.google.com/spreadsheets/d/1EaztEv2c8wZtWOgyC2wOPanelQ5BNhtefVIySOc9M4w/gviz/tq?tqx=out:json&gid=0'; 

let flashcards = [];
let currentCardIndex = -1;
let currentTheme = null;

const COLUMN_NAMES = { QUESTION: 0, ANSWER: 1, THEME: 2 };

function getCardsFromSheets() {
    fetch(GOOGLE_DATA_URL)
        .then(response => response.text())
        .then(data => {
            const jsonText = data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1);
            const parsedData = JSON.parse(jsonText);
            const rows = parsedData.table.rows;
            
            // On nettoie et on importe TOUTES les lignes valides
            flashcards = rows.slice(1)
                .map(row => ({
                    question: row.c[COLUMN_NAMES.QUESTION]?.v || '',
                    answer: row.c[COLUMN_NAMES.ANSWER]?.v || '',
                    theme: (row.c[COLUMN_NAMES.THEME]?.v || 'SANS THEME').trim().toUpperCase()
                }))
                .filter(card => card.question.length > 2); // On ignore les lignes vides ou titres

            showMenu();
        })
        .catch(err => {
            document.getElementById('theme-list').innerHTML = "Erreur de chargement : " + err;
        });
}

function showMenu() {
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('card-container').classList.add('hidden');
    document.getElementById('back-to-menu').classList.add('hidden');

    const themes = [...new Set(flashcards.map(c => c.theme))];
    const themeList = document.getElementById('theme-list');
    themeList.innerHTML = '';

    themes.forEach(theme => {
        const count = flashcards.filter(c => c.theme === theme).length;
        const div = document.createElement('div');
        div.className = 'theme-stat-item';
        div.innerHTML = `
            <h3>${theme}</h3>
            <p>${count} cartes disponibles</p>
            <button onclick="startReview('${theme}')" class="btn difficulty-4">RÉVISER</button>
        `;
        themeList.appendChild(div);
    });
}

function startReview(theme) {
    currentTheme = theme;
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('card-container').classList.remove('hidden');
    document.getElementById('back-to-menu').classList.remove('hidden');
    showNextCard();
}

function showNextCard() {
    const themeCards = flashcards.filter(c => c.theme === currentTheme);
    const randomIndex = Math.floor(Math.random() * themeCards.length);
    const card = themeCards[randomIndex];

    document.getElementById('question-display').textContent = card.question;
    document.getElementById('answer-display').textContent = "Cliquez pour voir la réponse";
    document.getElementById('answer-display').setAttribute('data-answer', card.answer);
    document.getElementById('answer-display').classList.add('answer-hidden');
    document.getElementById('theme-display').textContent = "Thème : " + card.theme;
    document.getElementById('evaluation-buttons').classList.add('hidden');
}

function toggleAnswer() {
    const ad = document.getElementById('answer-display');
    ad.textContent = ad.getAttribute('data-answer');
    ad.classList.remove('answer-hidden');
    document.getElementById('evaluation-buttons').classList.remove('hidden');
}

function evaluateCard(q) { showNextCard(); } // Simple passage à la suite

window.onload = getCardsFromSheets;