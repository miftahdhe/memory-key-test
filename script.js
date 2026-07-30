const CORRECT_PIN = "0512";
let currentPin = "";

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('isUnlocked') === 'true') {
        document.getElementById('lock-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
    }
});

function updateDots() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        if (index < currentPin.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

function pressKey(num) {
    const errorMsg = document.getElementById('error-message');
    errorMsg.classList.remove('show');
    const lockContainer = document.querySelector('.lock-container');
    lockContainer.classList.remove('shake');
    
    if (currentPin.length < 4) {
        currentPin += num;
        updateDots();
    }
}

function clearPin() {
    currentPin = currentPin.slice(0, -1);
    updateDots();
    const errorMsg = document.getElementById('error-message');
    errorMsg.classList.remove('show');
}

function submitPin() {
    if (currentPin.length === 0) return;
    
    if (currentPin === CORRECT_PIN) {
        // Unlock success
        sessionStorage.setItem('isUnlocked', 'true');
        const lockScreen = document.getElementById('lock-screen');
        lockScreen.classList.add('unlock-anim');
        
        setTimeout(() => {
            lockScreen.classList.remove('active');
            lockScreen.classList.remove('unlock-anim');
            
            const welcomeScreen = document.getElementById('welcome-screen');
            welcomeScreen.classList.add('active');
            
            setTimeout(() => {
                welcomeScreen.classList.add('fade-out');
                
                setTimeout(() => {
                    welcomeScreen.classList.remove('active');
                    welcomeScreen.classList.remove('fade-out');
                    document.getElementById('main-screen').classList.add('active');
                }, 800);
            }, 2000);
        }, 800);
    } else {
        // Unlock failed
        const errorMsg = document.getElementById('error-message');
        errorMsg.classList.add('show');
        
        const lockContainer = document.querySelector('.lock-container');
        lockContainer.classList.add('shake');
        
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        
        currentPin = "";
        setTimeout(() => {
            updateDots();
        }, 400);
    }
}

function openMenu(menuName) {
    window.location.href = `pages/${menuName}.html`;
}
