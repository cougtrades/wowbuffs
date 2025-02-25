let buffs = [];
let faction = "horde"; // Default to Horde

async function loadBuffs() {
    try {
        const url = `${faction}_buffs.json`;
        console.log(`Attempting to load: ${url}`); // Debug log
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        
        buffs = Array.from(new Map(data.map(item => [item.datetime + item.guild, item])).values());
        buffs.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        displayBuffs();
        startCountdown();
    } catch (error) {
        console.error("Load error:", error); // Debug log
        document.getElementById("buffList").innerHTML = `<tr><td colspan="6">Error loading buffs: ${error.message}</td></tr>`;
        buffs = [];
    }
}

function updateFaction() {
    faction = document.getElementById("faction").value;
    document.getElementById("buffList").innerHTML = "";
    document.getElementById("countdownTimer").textContent = "--:--:--";
    if (faction === "alliance") {
        document.body.classList.add("alliance");
    } else {
        document.body.classList.remove("alliance");
    }
    loadBuffs();
}

function formatDateTime(date, isServerTime = false) {
    if (isServerTime) {
        return date.toLocaleString("en-US", {
            timeZone: "America/Denver",
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true
        });
    } else {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return date.toLocaleString("en-US", {
            timeZone: userTimezone,
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true
        });
    }
}

function displayBuffs() {
    const buffList = document.getElementById("buffList");
    buffList.innerHTML = "";
    
    if (buffs.length === 0) {
        buffList.innerHTML = `<tr><td colspan="6">No buffs available.</td></tr>`;
        return;
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));

    const futureBuffs = buffs.filter(buff => {
        const utcDate = new Date(buff.datetime);
        const localBuffDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
        return localBuffDate > localNow;
    });

    if (futureBuffs.length === 0) {
        buffList.innerHTML = `<tr><td colspan="6">No upcoming buffs available.</td></tr>`;
        return;
    }

    futureBuffs.forEach(buff => {
        const utcDate = new Date(buff.datetime);
        if (isNaN(utcDate.getTime())) {
            console.warn(`Invalid UTC datetime: '${buff.datetime}', using current date`);
            utcDate = new Date();
        }

        const serverTime = formatDateTime(utcDate, true);
        const yourTime = formatDateTime(utcDate, false);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${serverTime}</td>
            <td>${yourTime}</td>
            <td>${buff.server || "Doomhowl"}</td>
            <td>${buff.guild}</td>
            <td>Onyxia</td> <!-- Hardcoded as Onyxia -->
            <td>${buff.notes || ""}</td>
        `;
        buffList.appendChild(row);
    });
}

function startCountdown() {
    let lastDisplayedBuffs = null;

    function updateCountdown() {
        if (buffs.length === 0) {
            document.getElementById("countdownTimer").textContent = "No upcoming buffs";
            return;
        }

        const now = new Date();
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));

        const nextBuff = buffs.find(buff => {
            const buffDate = new Date(buff.datetime);
            const localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: userTimezone }));
            return localBuffDate > localNow;
        });

        if (!nextBuff) {
            document.getElementById("countdownTimer").textContent = "No upcoming buffs";
            if (lastDisplayedBuffs !== null) {
                displayBuffs();
                lastDisplayedBuffs = null;
            }
            return;
        }

        const buffDate = new Date(nextBuff.datetime);
        const localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: userTimezone }));
        const timeDiff = localBuffDate - localNow;

        if (timeDiff <= 0) {
            document.getElementById("countdownTimer").textContent = "Buff is now!";
            const currentFutureBuffs = buffs.filter(buff => {
                const utcDate = new Date(buff.datetime);
                const localBuffDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
                return localBuffDate > localNow;
            });
            if (JSON.stringify(currentFutureBuffs) !== JSON.stringify(lastDisplayedBuffs)) {
                buffs = currentFutureBuffs;
                displayBuffs();
                lastDisplayedBuffs = currentFutureBuffs;
            }
            return;
        }

        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        let timerDisplay;
        if (days === 0) {
            if (hours === 0) {
                if (minutes === 0) {
                    timerDisplay = `${seconds}`;
                } else {
                    timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            } else {
                timerDisplay = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        } else {
            timerDisplay = `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        document.getElementById("countdownTimer").textContent = timerDisplay;
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

loadBuffs();
setInterval(loadBuffs, 60000); // Refresh every minute
