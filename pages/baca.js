document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const bookScreen = document.getElementById('book-screen');
    const leftTextContainer = document.getElementById('left-text-container');
    const rightTextContainer = document.getElementById('right-text-container');
    const pen = document.getElementById('pen-cursor');
    const hintText = document.getElementById('hint-text');
    const book = document.getElementById('the-book');
    const audio = document.getElementById('bg-music');

    let fullText = "";
    let tokens = [];
    
    let pagesData = []; // Array of objects { start, end }
    let currentPageIndex = 0;
    let maxTypedPageIndex = 0; // Index in pagesData for the left page. Right page is currentPageIndex + 1
    
    let isTyping = false;
    let isBookOpen = false;
    let typeInterval = null;
    let waitingForNextPage = false;
    
    let currentContainer = leftTextContainer;
    let startIndexForCurrentContainer = 0;
    let currentIndex = 0; // For typing

    // Load text
    try {
        const response = await fetch('../assets/puisi/puisi1.txt');
        fullText = await response.text();
    } catch (error) {
        fullText = "Teks puisi tidak ditemukan.";
        console.error(error);
    }

    parseTextToTokens();
    
    // Wait for fonts to load before measuring
    await document.fonts.ready;
    
    // We will measure pages now
    measurePages();

    loadingScreen.classList.remove('active');
    bookScreen.classList.add('active');
    
    setTimeout(() => {
        hintText.classList.add('visible');
    }, 1000);

    let touchStartX = 0;
    let touchEndX = 0;
    
    bookScreen.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });

    bookScreen.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleGesture(e.target);
    });

    bookScreen.addEventListener('click', (e) => {
        if (e.target.classList.contains('back-btn')) return;
        
        if (!isBookOpen) {
            openBook();
            return;
        }
        
        if (e.clientX > window.innerWidth / 2) {
            // Click right half -> Next page
            if (waitingForNextPage) {
                turnPageForward();
            }
        } else {
            // Click left half -> Prev page
            if (!isTyping) {
                turnPageBackward();
            }
        }
    });
    
    function handleGesture(target) {
        if (target.classList.contains('back-btn')) return;
        
        const threshold = 40;
        if (touchStartX - touchEndX > threshold) {
            // Swiped left (next)
            if (!isBookOpen) {
                openBook();
            } else if (waitingForNextPage) {
                turnPageForward();
            }
        } else if (touchEndX - touchStartX > threshold) {
            // Swiped right (previous)
            if (isBookOpen && !isTyping) {
                turnPageBackward();
            }
        }
    }

    function parseTextToTokens() {
        const lines = fullText.split('\n');
        let lastWasTitle = false;
        for (let l = 0; l < lines.length; l++) {
            let line = lines[l];
            let trimmed = line.trim();
            
            let isTitle = ['SUBUH', 'DZUHUR', 'ASHAR', 'MAGRIB', 'ISYA'].includes(trimmed);
            
            if (trimmed === '') {
                if (!lastWasTitle) {
                    tokens.push({ char: '<br>', tag: null, isBr: true });
                }
                continue;
            }
            
            let tag = isTitle ? 'h2' : 'span';
            
            for (let i = 0; i < line.length; i++) {
                tokens.push({ char: line[i], tag: tag });
            }
            if (l < lines.length - 1 && !isTitle) {
                tokens.push({ char: '<br>', tag: null, isBr: true });
            }
            
            lastWasTitle = isTitle;
        }
    }
    
    function getHTMLForTokens(startIndex, endIndex, addTracker = false) {
        let html = '';
        let currentTag = null;
        for (let i = startIndex; i < endIndex; i++) {
            let t = tokens[i];
            if (t.isBr) {
                if (currentTag) { html += `</${currentTag}>`; currentTag = null; }
                html += '<br>';
                continue;
            }
            if (t.tag !== currentTag) {
                if (currentTag) html += `</${currentTag}>`;
                if (t.tag) {
                    let className = t.tag === 'h2' ? ' class="section-title"' : '';
                    html += `<${t.tag}${className}>`;
                }
                currentTag = t.tag;
            }
            html += t.char;
        }
        
        if (addTracker) {
            html += '<span id="tracker"></span>';
        }
        
        if (currentTag) html += `</${currentTag}>`;
        return html;
    }

    function measurePages() {
        book.classList.add('open'); // temporarily open to get correct dimensions
        leftTextContainer.innerHTML = '';
        let start = 0;
        
        while (start < tokens.length) {
            let current = start;
            leftTextContainer.innerHTML = '';
            
            while (current < tokens.length) {
                let t = tokens[current];
                let prevT = current > 0 ? tokens[current - 1] : null;
                let isStartingTitle = t && t.tag === 'h2' && (!prevT || prevT.tag !== 'h2');
                
                let hasVisibleTextOnPage = false;
                for (let i = start; i < current; i++) {
                    if (!tokens[i].isBr && tokens[i].char.trim() !== '') {
                        hasVisibleTextOnPage = true;
                        break;
                    }
                }

                if (isStartingTitle && hasVisibleTextOnPage) {
                    break;
                }
                
                leftTextContainer.innerHTML = getHTMLForTokens(start, current + 1, false);
                
                if (leftTextContainer.scrollHeight > leftTextContainer.clientHeight) {
                    // Backtrack
                    while (current > start) {
                        let bk = tokens[current - 1];
                        if (bk.isBr || bk.char === ' ' || bk.char === '\n') {
                            break;
                        }
                        current--;
                    }
                    break;
                }
                current++;
            }
            
            if (current === start) {
                // Failsafe to prevent infinite loop
                current++;
            }
            
            pagesData.push({ start: start, end: current });
            
            start = current;
            while(start < tokens.length && (tokens[start].isBr || tokens[start].char === ' ')) {
                start++;
            }
        }
        
        leftTextContainer.innerHTML = '';
        book.classList.remove('open');
    }

    function openBook() {
        isBookOpen = true;
        book.classList.add('open');
        hintText.classList.remove('visible');
        
        audio.volume = 0.5;
        audio.play().catch(e => console.log("Autoplay blocked, will play on next interaction."));
        
        setTimeout(() => {
            currentPageIndex = 0;
            currentContainer = leftTextContainer;
            startIndexForCurrentContainer = pagesData[currentPageIndex].start;
            currentIndex = startIndexForCurrentContainer;
            rightTextContainer.innerHTML = '';
            
            maxTypedPageIndex = Math.max(maxTypedPageIndex, currentPageIndex + 1);
            startTyping();
        }, 1500); 
    }

    function updateDisplay() {
        currentContainer.innerHTML = getHTMLForTokens(startIndexForCurrentContainer, currentIndex, true);
        
        const tracker = document.getElementById('tracker');
        if (tracker) {
            const screenRect = bookScreen.getBoundingClientRect();
            const trackerRect = tracker.getBoundingClientRect();
            pen.style.top = (trackerRect.bottom - screenRect.top) + 'px';
            pen.style.left = (trackerRect.left - screenRect.left) + 'px';
        }
    }

    function startTyping() {
        if (!pagesData[currentPageIndex]) return;
        
        let targetEndIndex = pagesData[currentPageIndex].end;
        if (currentContainer === rightTextContainer && pagesData[currentPageIndex + 1]) {
            targetEndIndex = pagesData[currentPageIndex + 1].end;
        }

        isTyping = true;
        pen.style.opacity = "1";
        pen.classList.add('writing');
        
        typeInterval = setInterval(() => {
            if (currentIndex >= targetEndIndex || currentIndex >= tokens.length) {
                clearInterval(typeInterval);
                isTyping = false;
                pen.classList.remove('writing');
                pen.style.opacity = "0";
                
                // Done with current container
                if (currentContainer === leftTextContainer) {
                    if (pagesData[currentPageIndex + 1]) {
                        currentContainer = rightTextContainer;
                        startIndexForCurrentContainer = pagesData[currentPageIndex + 1].start;
                        currentIndex = startIndexForCurrentContainer;
                        maxTypedPageIndex = Math.max(maxTypedPageIndex, currentPageIndex + 1);
                        setTimeout(startTyping, 400); 
                    } else {
                        // Book is fully typed on left page, nothing on right
                        waitingForNextPage = true;
                        hintText.textContent = "Selesai";
                        hintText.classList.add('visible');
                    }
                } else {
                    // Done with right page
                    waitingForNextPage = true;
                    if (currentPageIndex + 2 < pagesData.length) {
                        hintText.textContent = "Usap ke kiri untuk membalik";
                    } else {
                        hintText.textContent = "Selesai";
                    }
                    hintText.classList.add('visible');
                }
                return;
            }

            currentIndex++;
            updateDisplay();

        }, 40);
    }

    function turnPageForward() {
        if (currentPageIndex + 2 >= pagesData.length) return; // No more pages
        
        waitingForNextPage = false;
        hintText.classList.remove('visible');
        
        if (audio.paused) {
            audio.play().catch(e => console.log(e));
        }

        const flipPage = document.createElement('div');
        flipPage.className = 'page flip-page';
        
        const front = document.createElement('div');
        front.className = 'page-face front right-page-bg';
        front.innerHTML = `<div class="page-content">${rightTextContainer.innerHTML}</div>`;
        
        const back = document.createElement('div');
        back.className = 'page-face back left-page-bg';
        back.innerHTML = `<div class="page-content"></div>`;
        
        flipPage.appendChild(front);
        flipPage.appendChild(back);
        
        book.appendChild(flipPage);
        
        rightTextContainer.innerHTML = '';
        pen.style.opacity = "0";

        setTimeout(() => {
            flipPage.classList.add('flipping');
        }, 50);

        setTimeout(() => {
            leftTextContainer.innerHTML = '';
            flipPage.remove();
            
            currentPageIndex += 2;
            
            // Should we type it or just show it? 
            // If we have never visited this page, we type it. 
            // Let's assume we always type new pages.
            // Since we only advance linearly during typing, any forward turn is a new page.
            
            currentContainer = leftTextContainer;
            startIndexForCurrentContainer = pagesData[currentPageIndex].start;
            currentIndex = startIndexForCurrentContainer;
            
            if (currentPageIndex > maxTypedPageIndex) {
                // Not typed yet
                maxTypedPageIndex = Math.max(maxTypedPageIndex, currentPageIndex + 1);
                startTyping();
            } else {
                // Already typed, just show
                leftTextContainer.innerHTML = getHTMLForTokens(pagesData[currentPageIndex].start, pagesData[currentPageIndex].end);
                if (pagesData[currentPageIndex + 1]) {
                    rightTextContainer.innerHTML = getHTMLForTokens(pagesData[currentPageIndex + 1].start, pagesData[currentPageIndex + 1].end);
                }
                waitingForNextPage = true;
                if (currentPageIndex + 2 < pagesData.length) {
                    hintText.textContent = "Usap untuk membalik";
                } else {
                    hintText.textContent = "Selesai";
                }
                hintText.classList.add('visible');
            }
        }, 1550);
    }

    function turnPageBackward() {
        if (currentPageIndex === 0) return; // At first page
        if (isTyping) return; // Don't allow flipping back while typing
        
        waitingForNextPage = false;
        hintText.classList.remove('visible');
        
        if (audio.paused) {
            audio.play().catch(e => console.log(e));
        }
        
        // We need to animate a page flipping from left to right.
        const flipPage = document.createElement('div');
        flipPage.className = 'page flip-page flipped-backwards'; // start flipped
        flipPage.style.transform = 'rotateY(-180deg)';
        flipPage.style.transition = 'transform 1.5s cubic-bezier(0.645, 0.045, 0.355, 1)';
        
        const front = document.createElement('div');
        front.className = 'page-face front right-page-bg';
        front.innerHTML = `<div class="page-content"></div>`; // back of previous left
        
        const back = document.createElement('div');
        back.className = 'page-face back left-page-bg';
        back.innerHTML = `<div class="page-content">${leftTextContainer.innerHTML}</div>`; // current left
        
        flipPage.appendChild(front);
        flipPage.appendChild(back);
        
        book.appendChild(flipPage);
        
        // Immediately set underlying pages to the previous pages
        currentPageIndex -= 2;
        leftTextContainer.innerHTML = getHTMLForTokens(pagesData[currentPageIndex].start, pagesData[currentPageIndex].end);
        if (pagesData[currentPageIndex + 1]) {
            rightTextContainer.innerHTML = getHTMLForTokens(pagesData[currentPageIndex + 1].start, pagesData[currentPageIndex + 1].end);
        } else {
            rightTextContainer.innerHTML = '';
        }
        
        pen.style.opacity = "0";

        setTimeout(() => {
            flipPage.style.transform = 'rotateY(0deg)'; // animate back to right side
        }, 50);

        setTimeout(() => {
            flipPage.remove();
            
            waitingForNextPage = true;
            hintText.textContent = "Usap untuk membalik";
            hintText.classList.add('visible');
        }, 1550);
    }
});
