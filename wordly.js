// DOM elements
const wordInput = document.getElementById('wordInput');
const searchBtn = document.getElementById('searchBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const resultContainer = document.getElementById('resultContainer');

// Store current word data for saving
let currentWordData = null;
let currentSearchWord = '';

// Helper: show temporary message
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    if (isError) toast.style.background = '#dc2626';
    else toast.style.background = '#10b981';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Helper: clean and trim
function getCleanWord() {
    return wordInput.value.trim().toLowerCase();
}

// Helper: escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Fetch from Free Dictionary API
async function fetchWordData(word) {
    if (!word) throw new Error('Please enter a word');
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
        if (response.status === 404) throw new Error(`"${word}" not found.`);
        throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    if (!data || data.length === 0) throw new Error('No definitions found.');
    return data;
}

// Extract synonyms
function extractSynonyms(dataEntries) {
    const synonymSet = new Set();
    for (const entry of dataEntries) {
        if (entry.meanings) {
            for (const meaning of entry.meanings) {
                if (meaning.synonyms) meaning.synonyms.forEach(syn => synonymSet.add(syn));
                if (meaning.definitions) {
                    for (const def of meaning.definitions) {
                        if (def.synonyms) def.synonyms.forEach(syn => synonymSet.add(syn));
                    }
                }
            }
        }
    }
    return Array.from(synonymSet).slice(0, 12);
}

// Extract phonetic & audio
function extractPhoneticAndAudio(dataEntries) {
    let phoneticText = '';
    let audioUrl = null;
    for (const entry of dataEntries) {
        if (entry.phonetics) {
            for (const phonetic of entry.phonetics) {
                if (!phoneticText && phonetic.text) phoneticText = phonetic.text;
                if (!audioUrl && phonetic.audio && phonetic.audio.trim() !== '') {
                    audioUrl = phonetic.audio;
                }
                if (phoneticText && audioUrl) break;
            }
        }
        if (phoneticText && audioUrl) break;
    }
    return { phoneticText, audioUrl };
}

// Build definitions HTML
function buildDefinitionsHTML(meaningsArray) {
    if (!meaningsArray || meaningsArray.length === 0) return '<div>No definitions available.</div>';
    let defHtml = '';
    for (const meaning of meaningsArray) {
        const partOfSpeech = meaning.partOfSpeech || 'unknown';
        const definitions = meaning.definitions || [];
        const limitedDefs = definitions.slice(0, 4);
        defHtml += `<div style="margin-bottom: 1rem;">
                        <span class="part-of-speech">${escapeHtml(partOfSpeech)}</span>`;
        for (let i = 0; i < limitedDefs.length; i++) {
            const defItem = limitedDefs[i];
            const definition = defItem.definition || '';
            const example = defItem.example || '';
            defHtml += `<div class="definition-text"> ${i+1}. ${escapeHtml(definition)}</div>`;
            if (example) {
                defHtml += `<div class="example-text"> "${escapeHtml(example)}"</div>`;
            }
        }
        defHtml += `</div>`;
    }
    return defHtml;
}

// Render the word data
function renderWordData(data, searchWord) {
    if (!data || data.length === 0) throw new Error('Invalid data');
    
    const mainEntry = data[0];
    const wordTitle = mainEntry.word || searchWord;
    const { phoneticText, audioUrl } = extractPhoneticAndAudio(data);
    const synonymsList = extractSynonyms(data);
    
    let allMeanings = [];
    for (const entry of data) {
        if (entry.meanings) allMeanings = allMeanings.concat(entry.meanings);
    }
    const definitionsHtml = buildDefinitionsHTML(allMeanings);
    
    const audioButtonHtml = audioUrl ? 
        `<button class="audio-btn" id="playAudioBtn" title="Listen to pronunciation">🔊 Speak</button>` : 
        `<span style="opacity:0.6; font-size:0.75rem;">🔇 no audio</span>`;
    
    const phoneticDisplay = phoneticText ? 
        `<span class="pronunciation">${escapeHtml(phoneticText)}</span>` : 
        `<span class="pronunciation">[no pronunciation]</span>`;
    
    let synonymsHtml = '';
    if (synonymsList.length > 0) {
        synonymsHtml = `<div class="synonyms-section">
                            <div class="synonyms-title">🔗 SYNONYMS (click to search)</div>
                            <div class="synonyms-list" id="synonymsListContainer">
                                ${synonymsList.map(syn => `<span class="synonym-badge" data-word="${escapeHtml(syn).replace(/"/g, '&quot;')}">${escapeHtml(syn)}</span>`).join('')}
                            </div>
                        </div>`;
    } else {
        synonymsHtml = `<div class="synonyms-section"><div class="synonyms-title">🔗 No synonyms found</div></div>`;
    }
    
    const mainHtml = `
        <div class="word-card" id="activeWordCard">
            <div class="word-header">
                <div class="word-title">
                    ${escapeHtml(wordTitle)}
                    <div class="pronounce-area">
                        ${phoneticDisplay}
                        ${audioButtonHtml}
                    </div>
                </div>
            </div>
            <div class="meaning-section">
                ${definitionsHtml}
            </div>
            ${synonymsHtml}
        </div>
    `;
    
    resultContainer.innerHTML = mainHtml;
    
    // Audio player
    if (audioUrl) {
        const audioBtn = document.getElementById('playAudioBtn');
        if (audioBtn) {
            audioBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const audio = new Audio(audioUrl);
                audio.play().catch(() => showToast('🔇 Audio not available', true));
            });
        }
    }
    
    // Synonym click handler
    const synonymsContainer = document.getElementById('synonymsListContainer');
    if (synonymsContainer) {
        const badges = synonymsContainer.querySelectorAll('.synonym-badge');
        badges.forEach(badge => {
            badge.addEventListener('click', () => {
                const synonymWord = badge.getAttribute('data-word');
                if (synonymWord) {
                    wordInput.value = synonymWord;
                    performSearch(synonymWord);
                }
            });
        });
    }
}

// Save current word to localStorage
function saveCurrentWord() {
    if (!currentWordData || !currentSearchWord) {
        showToast('⚠️ No word loaded. Search a word first!', true);
        return;
    }
    
    let savedWords = JSON.parse(localStorage.getItem('smartDictionary_saved') || '[]');
    
    const alreadyExists = savedWords.some(item => item.word === currentSearchWord);
    if (alreadyExists) {
        showToast(`📌 "${currentSearchWord}" is already in your saved list!`, false);
        return;
    }
    
    let firstDefinition = '';
    if (currentWordData && currentWordData.length > 0) {
        const firstMeaning = currentWordData[0]?.meanings?.[0];
        if (firstMeaning && firstMeaning.definitions && firstMeaning.definitions[0]) {
            firstDefinition = firstMeaning.definitions[0].definition.substring(0, 120);
        }
    }
    
    const savedItem = {
        word: currentSearchWord,
        savedAt: new Date().toLocaleString(),
        preview: firstDefinition || 'No definition preview'
    };
    
    savedWords.unshift(savedItem);
    if (savedWords.length > 20) savedWords.pop();
    
    localStorage.setItem('smartDictionary_saved', JSON.stringify(savedWords));
    showToast(`💾 "${currentSearchWord}" saved to your dictionary!`, false);
}

// Clear input and reset to welcome state
function clearAll() {
    wordInput.value = '';
    currentWordData = null;
    currentSearchWord = '';
    resultContainer.innerHTML = `
        <div class="word-card" style="text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: 0.8rem;">📚</div>
            <h3>Ready to learn new words?</h3>
            <p style="margin-top: 0.5rem;">Type a word above and click Search to see definitions, pronunciation & synonyms.</p>
            <p style="margin-top: 1rem; font-size: 0.85rem; color: #666;"> Try: "epiphany", "eloquent", "resilience" ✨</p>
            <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #888;"> Double-click the header to see your saved words</p>
        </div>
    `;
    showToast('🧹 Cleared! Ready for a new word.', false);
}

// Show loading
function showLoading() {
    resultContainer.innerHTML = `<div class="loading"><span>⏳</span> Fetching word wisdom...</div>`;
}

// Show error
function showError(message) {
    resultContainer.innerHTML = `
        <div class="error-message"> ${escapeHtml(message)}</div>
        <div style="margin-top:0.8rem; text-align:center; font-size:0.85rem;"> Try another word like "harmony", "wonder", "brave"</div>
    `;
}

// Main search function
async function performSearch(wordOverride = null) {
    const searchWord = (wordOverride !== null) ? wordOverride : getCleanWord();
    if (!searchWord) {
        showError('Please enter a word to search.');
        return;
    }
    
    showLoading();
    try {
        const wordData = await fetchWordData(searchWord);
        currentWordData = wordData;
        currentSearchWord = searchWord;
        renderWordData(wordData, searchWord);
    } catch (err) {
        console.error(err);
        let userMessage = err.message || 'Something went wrong.';
        if (userMessage.includes('not found')) {
            userMessage = `"${escapeHtml(searchWord)}" not found. Check spelling.`;
        } else if (userMessage.includes('API error')) {
            userMessage = 'Dictionary service busy. Please try again.';
        }
        showError(userMessage);
        currentWordData = null;
        currentSearchWord = '';
    }
}

// Show saved words list
function showSavedList() {
    const savedWords = JSON.parse(localStorage.getItem('smartDictionary_saved') || '[]');
    if (savedWords.length === 0) {
        showToast(' No saved words yet. Search and save your favorites!', false);
        return;
    }
    
    let listHtml = `<div class="word-card" style="max-height: 450px; overflow-y: auto;">
        <h3 style="color:#1e3c72; margin-bottom: 0.8rem;">📘 Your Saved Words (${savedWords.length})</h3>
        <div style="display: flex; flex-direction: column; gap: 0.6rem;">`;
    
    savedWords.forEach(item => {
        listHtml += `
            <div class="saved-word-item" data-word="${escapeHtml(item.word)}">
                <strong style="font-size: 1.1rem; color:#2a5298;"> ${escapeHtml(item.word)}</strong>
                <div style="font-size: 0.75rem; color:#555; margin-top: 4px;">${escapeHtml(item.preview.substring(0, 80))}...</div>
                <div style="font-size: 0.65rem; color:#888;">saved: ${escapeHtml(item.savedAt)}</div>
            </div>
        `;
    });
    
    listHtml += `</div><button id="closeSavedBtn" style="margin-top: 1rem; padding: 0.5rem 1rem; background:#2a5298; color:white; border:none; border-radius: 30px; cursor:pointer;">Close</button></div>`;
    
    resultContainer.innerHTML = listHtml;
    
    document.querySelectorAll('.saved-word-item').forEach(el => {
        el.addEventListener('click', () => {
            const savedWord = el.getAttribute('data-word');
            if (savedWord) {
                wordInput.value = savedWord;
                performSearch(savedWord);
            }
        });
    });
    
    const closeBtn = document.getElementById('closeSavedBtn');
    if (closeBtn) closeBtn.onclick = () => {
        if (currentSearchWord && currentWordData) {
            renderWordData(currentWordData, currentSearchWord);
        } else {
            clearAll();
        }
    };
}

// Event listeners
searchBtn.addEventListener('click', () => performSearch());
saveBtn.addEventListener('click', saveCurrentWord);
clearBtn.addEventListener('click', clearAll);

wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

// Double click on header shows saved words
document.querySelector('.smart-header').addEventListener('dblclick', () => {
    showSavedList();
});

// Initialize with welcome state
window.addEventListener('DOMContentLoaded', () => {
    wordInput.value = '';
    currentWordData = null;
    currentSearchWord = '';
});
