// Counter functionality
let counter = 0;
const counterBtn = document.getElementById('counter-btn');
const statusEl = document.getElementById('status');

if (counterBtn) {
    counterBtn.addEventListener('click', function() {
        counter++;
        counterBtn.textContent = `اضغط هنا (${counter})`;
        
        if (counter === 1) {
            statusEl.textContent = '✅ مرحباً! اضغط مرة أخرى';
        } else if (counter === 5) {
            statusEl.textContent = '🎉 رائع! أنت تتقدم بسرعة';
        } else if (counter === 10) {
            statusEl.textContent = '🚀 مذهل! عدد كبير من الضغطات!';
        } else if (counter > 10) {
            statusEl.textContent = '💪 أنت قوي جداً!';
        }
    });
}

// Date and time
function updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('date');
    const timeEl = document.getElementById('time');
    const browserEl = document.getElementById('browser');
    
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('ar-SA');
    }
    
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('ar-SA');
    }
    
    if (browserEl) {
        browserEl.textContent = navigator.userAgent.split(' ').slice(-2).join(' ');
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateDateTime);
} else {
    updateDateTime();
}

// Update time every second
setInterval(updateDateTime, 1000);

// Console message
console.log('✅ مشروع تجريبي محول HTML');
console.log('🎯 الملفات المرتبطة:');
console.log('  - styles.css');
console.log('  - script.js');
console.log('✨ يعمل بنجاح!');
