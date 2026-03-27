const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxASfii_gfA6_Snw83ot_iMswDpekTjmVJcZPi10RBjWLlallV8rS15FG53hjk-0VifDw/exec";

let timerInterval;
let lastAlertMinute = -1;
let currentTrackingStart = null;

function toggleMenu() { 
    document.getElementById('navLinks').classList.toggle('active'); 
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

function startTimer(startTimeStr) {
    clearInterval(timerInterval);
    if (!startTimeStr) return;

    // 1. Linisin ang format para maging Local Time
    let cleanStr = startTimeStr.replace(/-/g, '/').replace('T', ' ');
    let startDate = new Date(cleanStr);

    timerInterval = setInterval(() => {
        const now = new Date();
        
        // 2. Kunin ang difference sa milliseconds
        let diff = now.getTime() - startDate.getTime();

        /**
         * LATENCY COMPENSATION FIX:
         * Nagdadagdag tayo ng 4000ms (4 seconds) para mabawi yung 
         * delay ng pagpapadala ng data mula Arduino hanggang Google Sheets.
         * Dagdagan din natin ng 1000ms para mag-start sa 00:01.
         */
        let adjustedDiff = diff + 4000 + 1000; 

        if (adjustedDiff < 0) adjustedDiff = 0;

        const totalSeconds = Math.floor(adjustedDiff / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        const display = document.getElementById('timer-display');
        if (display) {
            display.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            
            // Overtime color logic
            if (mins >= 1) { 
                display.style.color = "crimson";
            } else { 
                display.style.color = ""; 
            }
        }
    }, 1000);
}

// Initial sync
setInterval(fetchData, 2000);
fetchData();
