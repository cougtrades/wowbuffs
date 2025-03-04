let buffs = [];
let faction = "horde";

async function loadBuffs() {
    try {
        let url = `${faction}_buffs.json`;
        let response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        let data = await response.json();
        buffs = Array.from(new Map(data.map(item => [item.datetime + item.guild, item])).values());
        buffs.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        displayBuffs();
        startCountdown();
    } catch (error) {
        document.getElementById("buffList").innerHTML = `<tr><td colspan="5">Error loading buffs: ${error.message}</td></tr>`;
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
    localStorage.removeItem("alertedBuffs");
}

function formatDateTime(date, isServerTime = false) {
    return isServerTime
        ? date.toLocaleString("en-US", { timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "numeric", hour12: true })
        : date.toLocaleString("en-US", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, weekday: "long", hour: "numeric", minute: "numeric", hour12: true });
}

function displayBuffs() {
    let buffList = document.getElementById("buffList");
    buffList.innerHTML = "";
    if (buffs.length === 0) {
        buffList.innerHTML = '<tr><td colspan="5">No buffs available.</td></tr>';
        return;
    }
    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let now = new Date();
    let localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    let upcomingBuffs = buffs.filter(buff => {
        let buffDate = new Date(buff.datetime);
        let localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: timezone }));
        return localBuffDate > localNow;
    });
    if (upcomingBuffs.length === 0) {
        buffList.innerHTML = '<tr><td colspan="5">No upcoming buffs available.</td></tr>';
        return;
    }
    upcomingBuffs.forEach(buff => {
        let buffDate = new Date(buff.datetime);
        if (isNaN(buffDate.getTime())) buffDate = new Date();
        let serverTime = formatDateTime(buffDate, true);
        let localTime = formatDateTime(buffDate, false);
        let row = document.createElement("tr");
        row.innerHTML = `
            <td>${serverTime}</td>
            <td>${localTime}</td>
            <td>${buff.guild}</td>
            <td>Onyxia</td>
            <td>${buff.notes || ""}</td>
        `;
        buffList.appendChild(row);
    });
}

function searchBuffs() {
    let searchTerm = document.getElementById("buffSearch").value.toLowerCase();
    let buffList = document.getElementById("buffList");
    buffList.innerHTML = "";
    if (buffs.length === 0) {
        buffList.innerHTML = '<tr><td colspan="5">No buffs available.</td></tr>';
        return;
    }
    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let now = new Date();
    let localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    let filteredBuffs = buffs.filter(buff => {
        let serverTime = formatDateTime(new Date(buff.datetime), true).toLowerCase();
        let guild = buff.guild.toLowerCase();
        let notes = (buff.notes || "").toLowerCase();
        return serverTime.includes(searchTerm) || guild.includes(searchTerm) || notes.includes(searchTerm);
    });
    let upcomingFilteredBuffs = filteredBuffs.filter(buff => {
        let buffDate = new Date(buff.datetime);
        let localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: timezone }));
        return localBuffDate > localNow;
    });
    if (upcomingFilteredBuffs.length === 0) {
        buffList.innerHTML = '<tr><td colspan="5">No matching buffs available.</td></tr>';
        return;
    }
    upcomingFilteredBuffs.forEach(buff => {
        let buffDate = new Date(buff.datetime);
        let serverTime = formatDateTime(buffDate, true);
        let localTime = formatDateTime(buffDate, false);
        let row = document.createElement("tr");
        row.innerHTML = `
            <td>${serverTime}</td>
            <td>${localTime}</td>
            <td>${buff.guild}</td>
            <td>Onyxia</td>
            <td>${buff.notes || ""}</td>
        `;
        buffList.appendChild(row);
    });
}

function startCountdown() {
    let lastBuffs = null;
    
    function updateCountdown() {
        if (buffs.length === 0) {
            document.getElementById("countdownTimer").textContent = "No upcoming buffs";
            return;
        }

        let now = new Date();
        let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
        let nextBuff = buffs.find(e => {
            let buffDate = new Date(e.datetime);
            let localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: timezone }));
            return localBuffDate > localNow;
        });

        if (!nextBuff) {
            document.getElementById("countdownTimer").textContent = "No upcoming buffs";
            if (lastBuffs !== null) {
                displayBuffs();
                lastBuffs = null;
            }
            return;
        }

        let buffDate = new Date(nextBuff.datetime);
        let localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: timezone }));
        let timeDiff = localBuffDate - localNow;
        let alertedBuffs = new Set(JSON.parse(localStorage.getItem("alertedBuffs")) || []);
        let buffKey = `${nextBuff.datetime}_${nextBuff.guild}`;

        if (timeDiff <= 600000 && timeDiff > 0 && !alertedBuffs.has(buffKey)) {
            showCustomNotification(nextBuff);
            alertedBuffs.add(buffKey);
            localStorage.setItem("alertedBuffs", JSON.stringify([...alertedBuffs]));
        }

        if (timeDiff <= 0) {
            document.getElementById("countdownTimer").textContent = "Buff is now!";
            let upcomingBuffs = buffs.filter(e => {
                let d = new Date(e.datetime);
                let localD = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
                return localD > localNow;
            });
            if (JSON.stringify(upcomingBuffs) !== JSON.stringify(lastBuffs)) {
                buffs = upcomingBuffs;
                displayBuffs();
                lastBuffs = upcomingBuffs;
            }
            localStorage.removeItem("alertedBuffs");
            return;
        }

        let days = Math.floor(timeDiff / 86400000);
        let hours = Math.floor((timeDiff % 86400000) / 3600000);
        let minutes = Math.floor((timeDiff % 3600000) / 60000);
        let seconds = Math.floor((timeDiff % 60000) / 1000);
        let timeString;
        if (days === 0) {
            if (hours === 0) {
                if (minutes === 0) {
                    timeString = `${seconds}`;
                } else {
                    timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;
                }
            } else {
                timeString = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            }
        } else {
            timeString = `${days}d ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        document.getElementById("countdownTimer").textContent = timeString;
    }

    function showCustomNotification(buff) {
        let notification = document.createElement("div");
        notification.className = "custom-notification";
        notification.innerHTML = `
            <p>Onyxia buff from ${buff.guild} drops in 10 minutes at ${formatDateTime(new Date(buff.datetime), false)} (Your Time)</p>
            <button onclick="this.parentElement.remove()">Close</button>
        `;
        document.body.appendChild(notification);

        let audio = new Audio("/10minalert.mp3");
        audio.play().catch(e => console.warn("Sound playback failed:", e));

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 30000);

        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Buff Alert!", {
                body: `Onyxia buff from ${buff.guild} drops in 10 minutes at ${formatDateTime(new Date(buff.datetime), false)} (Your Time)`,
                icon: "/favicon.ico"
            });
        } else if ("Notification" in window && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

loadBuffs();
setInterval(loadBuffs, 60000);
displayBuffs();
