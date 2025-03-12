let buffs = [];
let faction = "horde";
let selectedTimezone = localStorage.getItem("selectedTimezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;

function populateTimezoneDropdown() {
    const timezoneSelect = document.getElementById("timezone");
    const timezoneSearch = document.getElementById("timezoneSearch");
    const countryTimezones = {
        "United States": ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"],
        "Canada": ["America/Toronto", "America/Vancouver"],
        "Australia": ["Australia/Perth", "Australia/Sydney"],
        "Chile": ["America/Santiago"],
        "Brazil": ["America/Sao_Paulo"],
        "United Kingdom": ["Europe/London"],
        "New Zealand": ["Pacific/Auckland"],
        "China": ["Asia/Shanghai"],
        "Argentina": ["America/Argentina/Buenos_Aires"],
        "Germany": ["Europe/Berlin"],
        "Sweden": ["Europe/Stockholm"],
        "Ukraine": ["Europe/Kiev"],
        "Mexico": ["America/Mexico_City"],
        "Colombia": ["America/Bogota"],
        "Russia": ["Europe/Moscow"],
        "Norway": ["Europe/Oslo"],
        "Spain": ["Europe/Madrid"],
        "Singapore": ["Asia/Singapore"],
        "Finland": ["Europe/Helsinki"],
        "Peru": ["America/Lima"],
        "Indonesia": ["Asia/Jakarta"],
        "Netherlands": ["Europe/Amsterdam"],
        "Denmark": ["Europe/Copenhagen"],
        "South Korea": ["Asia/Seoul"],
        "Taiwan": ["Asia/Taipei"],
        "Venezuela": ["America/Caracas"],
        "France": ["Europe/Paris"],
        "Hungary": ["Europe/Budapest"],
        "Romania": ["Europe/Bucharest"],
        "Saudi Arabia": ["Asia/Riyadh"],
        "Belarus": ["Europe/Minsk"],
        "Czechia": ["Europe/Prague"],
        "Poland": ["Europe/Warsaw"],
        "Thailand": ["Asia/Bangkok"],
        "Costa Rica": ["America/Costa_Rica"],
        "Iceland": ["Atlantic/Reykjavik"],
        "Malaysia": ["Asia/Kuala_Lumpur"],
        "Serbia": ["Europe/Belgrade"],
        "Uruguay": ["America/Montevideo"],
        "Cyprus": ["Asia/Nicosia"]
    };

    let options = Object.entries(countryTimezones).map(([country, zones]) => {
        return `<optgroup label="${country}">
            ${zones.map(zone => `<option value="${zone}" ${zone === selectedTimezone ? "selected" : ""}>${zone}</option>`).join("")}
        </optgroup>`;
    }).join("");

    timezoneSelect.innerHTML = options;

    function filterTimezones() {
        const searchTerm = timezoneSearch.value.toLowerCase();
        const optgroups = timezoneSelect.getElementsByTagName("optgroup");
        Array.from(optgroups).forEach(optgroup => {
            const options = optgroup.getElementsByTagName("option");
            let anyMatch = false;
            Array.from(options).forEach(option => {
                const text = option.textContent.toLowerCase();
                if (text.includes(searchTerm) || optgroup.label.toLowerCase().includes(searchTerm)) {
                    option.style.display = "";
                    anyMatch = true;
                } else {
                    option.style.display = "none";
                }
            });
            optgroup.style.display = anyMatch ? "" : "none";
        });
    }

    timezoneSearch.addEventListener("input", filterTimezones);
    filterTimezones(); // Initial filter
}

function updateTimezone() {
    selectedTimezone = document.getElementById("timezone").value;
    localStorage.setItem("selectedTimezone", selectedTimezone);
    displayBuffs();
    startCountdown(); // Restart countdown with new timezone
}

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
    document.getElementById("lastBuffTime").textContent = "--:--:--";
    if (faction === "alliance") {
        document.body.classList.add("alliance");
    } else {
        document.body.classList.remove("alliance");
    }
    loadBuffs();
    localStorage.removeItem("alertedBuffs");
}

function formatDateTime(date, isServerTime = false) {
    const timezone = isServerTime ? "America/Denver" : selectedTimezone;
    return moment(date).tz(timezone).format(
        isServerTime ? "dddd, MMMM D, h:mm A" : "dddd, h:mm A"
    );
}

function displayBuffs() {
    let buffList = document.getElementById("buffList");
    buffList.innerHTML = "";
    if (buffs.length === 0) {
        buffList.innerHTML = '<tr><td colspan="5">No buffs available.</td></tr>';
        return;
    }
    let now = moment().tz(selectedTimezone);
    let upcomingBuffs = buffs.filter(buff => {
        let buffDate = moment(buff.datetime).tz(selectedTimezone);
        return buffDate.isAfter(now);
    });
    if (upcomingBuffs.length === 0) {
        buffList.innerHTML = '<tr><td colspan="5">No upcoming buffs available.</td></tr>';
        return;
    }
    upcomingBuffs.forEach(buff => {
        let buffDate = moment(buff.datetime);
        if (!buffDate.isValid()) buffDate = moment();
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
    let now = moment().tz(selectedTimezone);
    let filteredBuffs = buffs.filter(buff => {
        let serverTime = formatDateTime(new Date(buff.datetime), true).toLowerCase();
        let guild = buff.guild.toLowerCase();
        let notes = (buff.notes || "").toLowerCase();
        return serverTime.includes(searchTerm) || guild.includes(searchTerm) || notes.includes(searchTerm);
    });
    let upcomingFilteredBuffs = filteredBuffs.filter(buff => {
        let buffDate = moment(buff.datetime).tz(selectedTimezone);
        return buffDate.isAfter(now);
    });
    if (upcomingFilteredBuffs.length === 0) {
        buffList.innerHTML = '<tr><td colspan="5">No matching buffs available.</td></tr>';
        return;
    }
    upcomingFilteredBuffs.forEach(buff => {
        let buffDate = moment(buff.datetime);
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
            document.getElementById("countdownTimer").textContent = "--:--:--";
            document.getElementById("lastBuffTime").textContent = "--:--:--";
            return;
        }

        let now = moment().tz(selectedTimezone);
        let nextBuff = buffs.find(e => {
            let buffDate = moment(e.datetime).tz(selectedTimezone);
            return buffDate.isAfter(now);
        });

        // Find the last completed buff and calculate elapsed time
        let pastBuffs = buffs.filter(e => {
            let buffDate = moment(e.datetime).tz(selectedTimezone);
            return buffDate.isBefore(now);
        }).sort((a, b) => moment(b.datetime).tz(selectedTimezone) - moment(a.datetime).tz(selectedTimezone));

        let lastBuff = pastBuffs[0]; // Most recent past buff
        if (lastBuff) {
            let lastBuffDate = moment(lastBuff.datetime).tz(selectedTimezone);
            let timeDiff = now.diff(lastBuffDate); // Time elapsed since last buff
            let duration = moment.duration(timeDiff);
            let days = Math.floor(duration.asDays());
            let hours = duration.hours();
            let minutes = duration.minutes();
            let seconds = duration.seconds();
            let timeString;
            if (days === 0) {
                if (hours === 0) {
                    if (minutes === 0) {
                        timeString = `-${seconds}`;
                    } else {
                        timeString = `-${minutes}:${seconds.toString().padStart(2, "0")}`;
                    }
                } else {
                    timeString = `-${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
                }
            } else {
                timeString = `-${days}d ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            }
            document.getElementById("lastBuffTime").textContent = timeString;
        } else {
            document.getElementById("lastBuffTime").textContent = "--:--:--";
        }

        if (!nextBuff) {
            document.getElementById("countdownTimer").textContent = "No upcoming buffs";
            if (lastBuffs !== null) {
                displayBuffs();
                lastBuffs = null;
            }
            return;
        }

        let buffDate = moment(nextBuff.datetime).tz(selectedTimezone);
        let timeDiff = buffDate.diff(now);
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
                let d = moment(e.datetime).tz(selectedTimezone);
                return d.isAfter(now);
            });
            if (JSON.stringify(upcomingBuffs) !== JSON.stringify(lastBuffs)) {
                buffs = upcomingBuffs;
                displayBuffs();
                lastBuffs = upcomingBuffs;
            }
            localStorage.removeItem("alertedBuffs");
            return;
        }

        let duration = moment.duration(timeDiff);
        let days = Math.floor(duration.asDays());
        let hours = duration.hours();
        let minutes = duration.minutes();
        let seconds = duration.seconds();
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

// Initialize
populateTimezoneDropdown();
loadBuffs();
setInterval(loadBuffs, 60000);
displayBuffs();
