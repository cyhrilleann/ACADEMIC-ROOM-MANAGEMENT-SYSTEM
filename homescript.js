const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxASfii_gfA6_Snw83ot_iMswDpekTjmVJcZPi10RBjWLlallV8rS15FG53hjk-0VifDw/exec";

let timerInterval;
let currentTrackingStart = null;

async function fetchData() {
    try {
        const response = await fetch(`${SCRIPT_URL}?task=getStatus`);
        const data = await response.json();
        
        // Debugging: Tingnan sa Console (F12) kung ano ang format ng data na dumadating
        console.log("Data received:", data); 
        
        updateUI(data);
    } catch (error) { 
        console.error("Syncing error:", error); 
    }
}

function updateUI(data) {
    // Siguraduhin na may default value kung walang data
    const room = data.room || "AH E-LEARN LAB";
    const instructor = data.instructor || "Mr. Cabuyaban";
    const schedule = data.schedule || "1:00PM-3:00PM";
    const status = data.status ? data.status.toUpperCase() : "UNKNOWN";

    // 1. I-update ang Room Information (Right Card)
    const instElem = document.getElementById('instName');
    const schedElem = document.getElementById('roomSched');
    const statusLabel = document.getElementById('roomStatus');

    if (instElem) instElem.innerText = instructor;
    if (schedElem) schedElem.innerText = schedule;
    if (statusLabel) {
        statusLabel.innerText = status;
        statusLabel.className = `status ${status.toLowerCase()}`;
    }

    // 2. I-update ang Vacant/Occupied Lists (Left and Middle Cards)
    const vacantList = document.getElementById('vacant-list');
    const occupiedList = document.getElementById('occupied-list');
    const timerSection = document.getElementById('timer-section');

    const pill = `<span class="pill">${room} <small>${schedule}</small></span>`;

    if (status === "OCCUPIED") {
        if (occupiedList) occupiedList.innerHTML = pill; 
        if (vacantList) vacantList.innerHTML = "";
        if (timerSection) timerSection.style.display = "block";

        if (currentTrackingStart !== data.startTime) {
            currentTrackingStart = data.startTime;
            startTimer(data.startTime);
        }
    } else {
        if (vacantList) vacantList.innerHTML = pill; 
        if (occupiedList) occupiedList.innerHTML = "";
        if (timerSection) timerSection.style.display = "none";
        
        clearInterval(timerInterval);
        currentTrackingStart = null;
    }
}

function startTimer(startTimeStr) {
    clearInterval(timerInterval);
    if (!startTimeStr) return;

    // Ayusin ang date format para sa cross-browser compatibility
    let cleanStr = startTimeStr.replace(/-/g, '/').replace('T', ' ');
    let startDate = new Date(cleanStr);

    timerInterval = setInterval(() => {
        const now = new Date();
        let diff = now.getTime() - startDate.getTime();

        // Latency compensation (4s delay + 1s start)
        let adjustedDiff = diff + 5000; 
        if (adjustedDiff < 0) adjustedDiff = 0;

        const totalSeconds = Math.floor(adjustedDiff / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        const display = document.getElementById('timer-display');
        if (display) {
            display.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            display.style.color = (mins >= 1) ? "crimson" : "";
        }
    }, 1000);
}

// Initial calls
setInterval(fetchData, 5000); // Ginawa nating 5s para hindi ma-rate limit ang Google Script
fetchData();;
