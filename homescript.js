const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxASfii_gfA6_Snw83ot_iMswDpekTjmVJcZPi10RBjWLlallV8rS15FG53hjk-0VifDw/exec";

let timerInterval;
let lastAlertMinute = -1; 
let currentTrackingStart = null;
let isAudioEnabled = false;

function toggleMenu() {
    document.getElementById("navLinks").classList.toggle("active");
}

// Eto ang mag-a-activate sa browser permission
function enableEverything() {
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            // Test Notification
            new Notification("✅ Notifications Enabled", { body: "Makakatanggap ka na ng overtime alerts." });
            document.getElementById('setup-section').style.display = 'none';
            isAudioEnabled = true;
        } else {
            alert("Pakiset ang Browser Permission sa 'Allow' para sa Notifications.");
        }
    });
}

async function fetchData() {
    try {
        const response = await fetch(`${SCRIPT_URL}?task=getStatus`);
        const data = await response.json();
        updateUI(data);
    } catch (error) { 
        console.log("Syncing..."); 
    }
}

function updateUI(data) {
    const vacantList = document.getElementById('vacant-list');
    const occupiedList = document.getElementById('occupied-list');
    const timerSection = document.getElementById('timer-section');

    const pill = `<span class="pill">${data.room} <small>${data.schedule}</small></span>`;
    document.getElementById('instName').innerText = data.instructor;
    document.getElementById('roomSched').innerText = data.schedule;

    const statusLabel = document.getElementById('roomStatus');
    statusLabel.innerText = data.status.toUpperCase();
    statusLabel.className = `status ${data.status.toLowerCase()}`;

    if (data.status === "Occupied") {
        occupiedList.innerHTML = pill; 
        vacantList.innerHTML = "";
        timerSection.style.display = "block";

        if (currentTrackingStart !== data.startTime) {
            currentTrackingStart = data.startTime;
            lastAlertMinute = 0; // Reset sa start ng session
            startTimer(data.startTime);
        }
    } else {
        vacantList.innerHTML = pill; 
        occupiedList.innerHTML = "";
        timerSection.style.display = "none";
        clearInterval(timerInterval);
        currentTrackingStart = null;
        lastAlertMinute = -1;
    }
}

function triggerOvertimeAlert(minute) {
    console.log("ALERT TRIGGERED FOR MINUTE: " + minute);

    // 1. Browser Notification
    if (Notification.permission === "granted") {
        new Notification("⚠️ OVERTIME ALERT", {
            body: `Instructor has been in the room for ${minute} minute(s).`,
            requireInteraction: true,
            icon: "https://cdn-icons-png.flaticon.com/512/564/564619.png"
        });
    }

    // 2. Sound Alert (Kailangan may interaction muna sa page)
    if (isAudioEnabled) {
        let audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log("Sound blocked by browser"));
    }

    // 3. Fallback Alert (HINDI ITO NABA-BLOCK NG BROWSER)
    // Lalabas ito kahit nasa ibang tab ka
    setTimeout(() => {
        alert("🚨 OVERTIME ALERT!\nRoom occupied for " + minute + " minute(s).");
    }, 500);
}

function startTimer(startTimeStr) {
    clearInterval(timerInterval);
    if (!startTimeStr) return;

    let cleanStr = startTimeStr.replace(/-/g, '/').replace('T', ' ');
    let startDate = new Date(cleanStr);

    timerInterval = setInterval(() => {
        const now = new Date();
        let diff = now.getTime() - startDate.getTime();

        // Latency Compensation (4s delay fix + 1s offset)
        let adjustedDiff = diff + 4000 + 1000; 
        if (adjustedDiff < 0) adjustedDiff = 0;

        const totalSeconds = Math.floor(adjustedDiff / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        const display = document.getElementById('timer-display');
        if (display) {
            display.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            
            // --- CRITICAL ALERT LOGIC ---
            if (mins >= 1) { 
                display.style.color = "crimson";

                // Tuwing magbabago ang minuto at hindi pa tayo nag-a-alert sa minutong ito
                if (mins > lastAlertMinute) {
                    triggerOvertimeAlert(mins);
                    lastAlertMinute = mins;
                }
            } else { 
                display.style.color = ""; 
            }
        }
    }, 1000);
}

setInterval(fetchData, 2000);
fetchData();
