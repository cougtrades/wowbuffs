let buffs = [];

async function loadBuffs() {
    try {
        const response = await fetch('buffs.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        
        // Remove duplicates based on datetime and guild
        buffs = Array.from(new Map(data.map(item => [item.datetime + item.guild, item])).values()); // Use UTC datetime + guild as key
        
        // Sort buffs by datetime (soonest to oldest, in UTC)
        buffs.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        displayBuffs();
        startCountdown(); // Start or restart the countdown when buffs are loaded
    } catch (error) {
        document.getElementById("buffList").innerHTML = `<tr><td colspan="4">Error loading buffs: ${error.message}</td></tr>`;
        buffs = [];
    }
}

function formatDateTime(date, isServerTime = false) {
    if (isServerTime) {
        // Format as Mountain Time (UTC-7) for Server Time, without the year
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
        // Format as user's local timezone for Your Time, without the year
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
        buffList.innerHTML = `<tr><td colspan="4">No buffs available.</td></tr>`;
        return;
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));

    // Filter out expired buffs (only show future buffs in user's local time)
    const futureBuffs = buffs.filter(buff => {
        const utcDate = new Date(buff.datetime);
        const localBuffDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
        return localBuffDate > localNow;
    });

    if (futureBuffs.length === 0) {
        buffList.innerHTML = `<tr><td colspan="4">No upcoming buffs available.</td></tr>`;
        return;
    }

    futureBuffs.forEach(buff => {
        const utcDate = new Date(buff.datetime);
        if (isNaN(utcDate.getTime())) {
            console.warn(`Invalid UTC datetime: '${buff.datetime}', using current date`);
            utcDate = new Date();
        }

        const serverTime = formatDateTime(utcDate, true); // Mountain Time (MNT)
        const yourTime = formatDateTime(utcDate, false); // User's local timezone
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${serverTime}</td> <!-- Server Time (MNT) -->
            <td>${yourTime}</td> <!-- Your Time (user's local timezone) -->
            <td>${buff.server || "Doomhowl"}</td>
            <td>${buff.guild}</td>
        `;
        buffList.appendChild(row);
    });

    // Hide or clear the last-updated element if it exists
    const lastUpdatedElement = document.querySelector(".last-updated");
    if (lastUpdatedElement) {
        lastUpdatedElement.style.display = "none"; // Hide the entire element
        // Optionally, clear its content: lastUpdatedElement.textContent = "";
    }
}

function startCountdown() {
    let lastDisplayedBuffs = null; // Track the last displayed buffs to avoid unnecessary updates

    function updateCountdown() {
        if (buffs.length === 0) {
            document.getElementById("countdownTimer").textContent = "No upcoming buffs";
            return;
        }

        const now = new Date(); // User's local time
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localNow = new Date(now.toLocaleString("en-US", { timeZone: userTimezone })); // User's local time in their timezone

        // Log for debugging
        console.log("User's Local Time:", localNow.toLocaleString("en-US", { timeZone: userTimezone, second: "numeric" }));
        console.log("Next Buff Datetime (UTC):", buffs.map(b => b.datetime));

        const nextBuff = buffs.find(buff => {
            const buffDate = new Date(buff.datetime); // Parse UTC datetime
            // Convert buffDate to user's local timezone for comparison (no -1 hour adjustment)
            const localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: userTimezone }));
            console.log("Buff Date (Local):", localBuffDate.toLocaleString("en-US", { timeZone: userTimezone, second: "numeric" }));
            return localBuffDate > localNow;
        });

        if (!nextBuff) {
            document.getElementById("countdownTimer").textContent = "No upcoming buffs";
            if (lastDisplayedBuffs !== null) {
                displayBuffs(); // Update display only if it changed
                lastDisplayedBuffs = null;
            }
            return;
        }

        const buffDate = new Date(nextBuff.datetime); // Parse UTC datetime
        const localBuffDate = new Date(buffDate.toLocaleString("en-US", { timeZone: userTimezone })); // Convert to user's local timezone
        const timeDiff = localBuffDate - localNow;

        if (timeDiff <= 0) {
            document.getElementById("countdownTimer").textContent = "Buff is now!";
            // Filter out expired buffs in user's local time and update display
            const currentFutureBuffs = buffs.filter(buff => {
                const utcDate = new Date(buff.datetime);
                const localBuffDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
                return localBuffDate > localNow;
            });
            if (JSON.stringify(currentFutureBuffs) !== JSON.stringify(lastDisplayedBuffs)) {
                buffs = currentFutureBuffs; // Update buffs to only include future buffs
                displayBuffs(); // Update display only if buffs have changed
                lastDisplayedBuffs = currentFutureBuffs;
            }
            return;
        }

        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        // Hide fields if their value is 0 for clarity
        let timerDisplay;
        if (days === 0) {
            if (hours === 0) {
                if (minutes === 0) {
                    timerDisplay = `${seconds}`; // Only show seconds (e.g., "50")
                } else {
                    timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`; // Only show minutes and seconds (e.g., "23:50")
                }
            } else {
                timerDisplay = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; // Only show hours, minutes, seconds (e.g., "21:22")
            }
        } else {
            timerDisplay = `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; // Show all fields with days (e.g., "1d 12:34:56")
        }

        document.getElementById("countdownTimer").textContent = timerDisplay;
    }

    console.log("Starting countdown...");
    updateCountdown();
    setInterval(updateCountdown, 1000); // Update countdown every second
}

loadBuffs();
setInterval(loadBuffs, 60000); // Refresh every minute