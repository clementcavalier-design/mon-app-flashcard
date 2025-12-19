// ========================================================================
// 1. CONFIGURATION
// ========================================================================
const GOOGLE_DATA_URL = 'https://docs.google.com/spreadsheets/d/1EaztEv2c8wZtWOgyC2wOPanelQ5BNhtefVIySOc9M4w/gviz/tq?tqx=out:json&gid=0'; 

// ========================================================================
// 2. Variables Globales
// ========================================================================
let flashcards = [];
let cardData = [];
let currentCardIndex = -1;
let isAnswerShown = false;
let currentTheme = null;

const COLUMN_NAMES = {
    QUESTION: 0,
    ANSWER: 1,
    THEME: 2
};

// ========================================================================
// 3. Récupération des données
// ========================================================================
function getCardsFromSheets() {
    fetch(GOOGLE_DATA_URL)
        .then(response => response.text())
        .then(data => {
            const jsonText = data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1);
            const parsedData = JSON.parse(jsonText);
            const rows = parsedData.table.rows;
            
            if (rows.length > 1) { 
                const rawData = rows.slice(1); 
                cardData = rawData.map(row => [
                    row.c[COLUMN_NAMES.QUESTION]?.v || '', 
                    row.c[COLUMN_NAMES.ANSWER]?.v || '',   
                    row.c[COLUMN_NAMES.THEME]?.v || 'Non classé'
                ]);
                loadLocalCards();
            }
        })
        .catch(error => console.error("Erreur:", error));
}

function loadLocalCards() {
    const localData = localStorage.getItem('flashcardProgress');
    let localCards = localData ? JSON.parse(localData) : [];

    flashcards = cardData.map(sheetCard => {
        const question = sheetCard[COLUMN_NAMES.QUESTION];
        let progress = localCards.find(lc => lc.question === question);
        
        if (!progress) {
            progress = {
                question: question,
                nextReview: new Date().toISOString(), 
                interval: 0,
                easinessFactor: 2.5 
            };
        }
        progress.answer = sheetCard[COLUMN_NAMES.ANSWER];
        progress.theme = (sheetCard[COLUMN_NAMES.THEME] || 'Non classé').trim();
        return progress;
    });
    showMenu();
}

function saveLocalCards() {
    localStorage.setItem('flashcardProgress', JSON.stringify(flashcards));
}

// ========================================================================
// 4. Affichage du Menu
// ========================================================================
function showMenu() {
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('card-container').classList.add('hidden');
    document.getElementById('back-to-menu').classList.add('hidden');
    displayStats();
}

function startReview(selectedTheme) {
    currentTheme = selectedTheme;
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('card-container').classList.remove('hidden');
    document.getElementById('back-to-menu').classList.remove('hidden');
    showNextCard();
}

function displayStats() {
    const themeStats = {};
    flashcards.forEach(card => {
        const theme = card.theme;
        if (!themeStats[theme]) themeStats[theme] = { total: 0 };
        themeStats[theme].total++;
    });

    const themeListElement = document.getElementById('theme-list');
    themeListElement.innerHTML = ''; 

    for (const theme in themeStats) {
        const themeButton = document.createElement('div');
        themeButton.className = 'theme-stat-item';
        themeButton.innerHTML = `
            <h3>${theme}</h3>
            <p><strong>Total cartes :</strong> ${themeStats[theme].total}</p>
            <button onclick="startReview('${theme}')" class="btn difficulty-4">RÉVISER CE THÈME</button>
        `;
        themeListElement.appendChild(themeButton);
    }
}

// ========================================================================
// 5. Logique de Révision (MODIFIÉE POUR TOUT AFFICHER)
// ========================================================================
function showNextCard() {
    // MODIFICATION : On prend toutes les cartes du thème, sans filtrer par date
    const themeCards = flashcards.filter(card => card.theme === currentTheme);
    
    document.getElementById('cards-due-count').textContent = themeCards.length;
    
    if (themeCards.length === 0) {
        document.getElementById('question-display').innerHTML = "Fin du thème !";
        return;
    }

    // On mélange un peu pour ne pas avoir toujours le même ordre
    const randomIndex = Math.floor(Math.random() * themeCards.length);
    const nextCardData = themeCards[randomIndex];
    
    currentCardIndex = flashcards.findIndex(card => card.question === nextCardData.question);

    document.getElementById('question-display').textContent = nextCardData.question;
    document.getElementById('theme-display').textContent = `Thème : ${nextCardData.theme}`;
    
    const answerDisplay = document.getElementById('answer-display');
    answerDisplay.setAttribute('data-answer', nextCardData.answer);
    answerDisplay.textContent = "Cliquez pour voir la réponse";
    answerDisplay.classList.add('answer-hidden');
    
    document.getElementById('evaluation-buttons').classList.add('hidden');
    isAnswerShown = false;
}

function toggleAnswer() {
    if (currentCardIndex === -1) return; 
    const answerDisplay = document.getElementById('answer-display');
    if (!isAnswerShown) {
        answerDisplay.textContent = answerDisplay.getAttribute('data-answer');
        answerDisplay.classList.remove('answer-hidden');
        document.getElementById('evaluation-buttons').classList.remove('hidden');
        isAnswerShown = true;
    } 
}

function evaluateCard(quality) {
    // On garde la logique de calcul en arrière-plan pour le futur
    saveLocalCards();
    showNextCard();
}

window.onload = getCardsFromSheets;