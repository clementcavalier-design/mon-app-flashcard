// ========================================================================
// 1. CONFIGURATION (L'URL publique remplace la Clé API et l'ID !)
// ========================================================================

// ATTENTION : Collez l'URL de données publiques que vous avez construite à l'étape 1.
// Elle doit ressembler à : https://docs.google.com/spreadsheets/d/VOTRE_ID_ICI/gviz/tq?tqx=out:json&gid=0
const GOOGLE_DATA_URL = 'https://docs.google.com/spreadsheets/d/1EaztEv2c8wZtWOgyC2wOPanelQ5BNhtefVIySOc9M4w/gviz/tq?tqx=out:json&gid=0'; 


// ========================================================================
// 2. Variables Globales et Initialisation (Pas de gapi.load)
// ========================================================================

let flashcards = [];
let cardData = [];
let currentCardIndex = -1;
let isAnswerShown = false;

// Noms de colonnes (correspondant à l'ordre des colonnes A, B, C...)
const COLUMN_NAMES = {
    QUESTION: 0,
    ANSWER: 1,
    THEME: 2
};

// Fonction principale pour charger les données (utilise 'fetch')
function getCardsFromSheets() {
    fetch(GOOGLE_DATA_URL)
        .then(response => response.text())
        .then(data => {
            // Le résultat est encapsulé par Google dans un format complexe (Google Visualization API)
            // On retire le préfixe pour obtenir le JSON propre
            const jsonText = data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1);
            const parsedData = JSON.parse(jsonText);
            
            // Extraction des lignes de données
            const rows = parsedData.table.rows;
            
            if (rows.length > 0) {
                // Mapping des données (A, B, C)
                cardData = rows.map(row => [
                    row.c[COLUMN_NAMES.QUESTION]?.v || '', // Question (colonne A)
                    row.c[COLUMN_NAMES.ANSWER]?.v || '',   // Réponse (colonne B)
                    row.c[COLUMN_NAMES.THEME]?.v || ''     // Thématique (colonne C)
                ]);
                
                loadLocalCards();
            } else {
                document.getElementById('question-display').innerHTML = "Aucune donnée de flashcard trouvée dans la feuille publique.";
            }
        })
        .catch(error => {
            document.getElementById('question-display').innerHTML = `Erreur FATALE de connexion : ${error}. Vérifiez l'URL de données publiques et le partage.`;
            console.error("Erreur de connexion:", error);
        });
}

// ========================================================================
// 3. Logique de la Répétition Espacée (SRS) et Persistance (Identique)
// ========================================================================

// Tente de charger les données de progression stockées localement
function loadLocalCards() {
    const localData = localStorage.getItem('flashcardProgress');
    let localCards = localData ? JSON.parse(localData) : [];

    // Fusionner les données Sheet (la vérité) avec la progression locale
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
        progress.theme = sheetCard[COLUMN_NAMES.THEME] || 'Général';
        
        return progress;
    });

    saveLocalCards();
    showNextCard();
}

// Sauvegarde l'état actuel
function saveLocalCards() {
    localStorage.setItem('flashcardProgress', JSON.stringify(flashcards));
}

// Affiche la prochaine carte à réviser
function showNextCard() {
    const now = new Date();
    const dueCards = flashcards.filter(card => new Date(card.nextReview) <= now);
    
    document.getElementById('cards-due-count').textContent = dueCards.length;

    if (dueCards.length === 0) {
        document.getElementById('question-display').innerHTML = "🥳 Félicitations ! Aucune carte à réviser. Revenez plus tard !";
        document.getElementById('answer-display').classList.add('answer-hidden');
        document.getElementById('evaluation-buttons').classList.add('hidden');
        document.getElementById('theme-display').textContent = "";
        currentCardIndex = -1;
        return;
    }

    dueCards.sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
    const nextCardData = dueCards[0];
    
    currentCardIndex = flashcards.findIndex(card => card.question === nextCardData.question);

// Mettre à jour l'affichage
    document.getElementById('question-display').textContent = nextCardData.question;
    document.getElementById('theme-display').textContent = `Thème : ${nextCardData.theme}`;
    
    // Vider le texte de l'élément réponse pour masquer complètement la réponse
    document.getElementById('answer-display').textContent = "Cliquez pour voir la réponse"; // ou laissez vide si vous préférez
    
    // Sauvegarder la VRAIE réponse dans l'élément (utilisation d'un attribut de donnée)
    document.getElementById('answer-display').setAttribute('data-answer', nextCardData.answer);
    
    // Cacher la réponse et les boutons
    document.getElementById('answer-display').classList.add('answer-hidden');
    document.getElementById('evaluation-buttons').classList.add('hidden');
    isAnswerShown = false;
}

// Évaluation et mise à jour SRS (Identique)
function evaluateCard(quality) {
    if (currentCardIndex === -1) return;
    
    let card = flashcards[currentCardIndex];
    const now = new Date();
    
    let newEasinessFactor = card.easinessFactor;
    const MIN_EF = 1.3;
    const MAX_EF = 2.5;

    if (quality < 3) {
        newEasinessFactor = Math.max(MIN_EF, card.easinessFactor - 0.2); 
    } else {
        newEasinessFactor = card.easinessFactor + (0.1 - (4 - quality) * (0.08 + (4 - quality) * 0.02));
        newEasinessFactor = Math.min(MAX_EF, newEasinessFactor); 
    }
    
    card.easinessFactor = newEasinessFactor;

    let newInterval;
    if (quality < 3) {
        newInterval = 1; // 1 minute
    } else {
        if (card.interval === 0) {
            newInterval = 60; // 1 heure
        } else {
            newInterval = card.interval * card.easinessFactor;
        }
    }
    
    newInterval = Math.min(newInterval, 60 * 24 * 60); 
    card.interval = newInterval;

    const intervalMs = newInterval * 60 * 1000;
    card.nextReview = new Date(now.getTime() + intervalMs).toISOString();

    let nextReviewDisplay = (newInterval < 60) ? 
        `dans ${Math.round(newInterval)} minute(s)` : 
        (newInterval < 1440) ? 
        `dans ${Math.round(newInterval / 60)} heure(s)` :
        `dans ${Math.round(newInterval / 1440)} jour(s)`;
        
    document.getElementById('status-message').textContent = `Prochaine révision : ${nextReviewDisplay}`;

    saveLocalCards();
    showNextCard();
    
    setTimeout(() => {
        document.getElementById('status-message').textContent = "";
    }, 3000);
}

// Fonction appelée au clic sur la carte pour afficher/cacher la réponse
function toggleAnswer() {
    if (currentCardIndex === -1) return; 

    const answerDisplay = document.getElementById('answer-display');
    const buttons = document.getElementById('evaluation-buttons');
    
    if (!isAnswerShown) {
        // RÉCUPÉRER LA RÉPONSE CACHÉE
        const actualAnswer = answerDisplay.getAttribute('data-answer'); 
        answerDisplay.textContent = actualAnswer; // Affiche la vraie réponse
        
        // Afficher les boutons
        answerDisplay.classList.remove('answer-hidden');
        buttons.classList.remove('hidden');
        isAnswerShown = true;
    } 
}

// Démarrer l'application
window.onload = getCardsFromSheets;