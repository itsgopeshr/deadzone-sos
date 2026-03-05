// ==========================================
// 1. FIREBASE SETUP (The Cloud Database)
// ==========================================
// IMPORTANT: You will need to replace this block with your own Firebase keys later!
// I have provided instructions below on how to get them.
const firebaseConfig = {
    apiKey: "AIzaSyCVNxzyXoYOfpyV2fiVaTlMTUouTvSQCwM",
    authDomain: "realtime-database-5b2c0.firebaseapp.com",
    databaseURL: "https://realtime-database-5b2c0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "realtime-database-5b2c0",
    storageBucket: "realtime-database-5b2c0.firebasestorage.app",
    messagingSenderId: "627152491638",
    appId: "1:627152491638:web:cf4701a3f57e7abe54fb57",
    measurementId: "G-5FGC4EKCN6"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const dbCloud = firebase.database();


// ==========================================
// 2. UI & ACCESSIBILITY FEATURES
// ==========================================

// Mobile Hamburger Menu Toggle
const mobileMenuBtn = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');
if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '60px';
        navLinks.style.right = '0';
        navLinks.style.background = 'var(--nav-bg)';
        navLinks.style.width = '100%';
        navLinks.style.padding = '20px';
    });
}

// Low Battery / High Contrast Mode Toggle
const batteryBtn = document.getElementById('battery-toggle');
if (batteryBtn) {
    // Check if user previously saved battery mode preference
    if (localStorage.getItem('batteryMode') === 'enabled') {
        document.body.classList.add('low-battery');
    }

    batteryBtn.addEventListener('click', () => {
        document.body.classList.toggle('low-battery');
        if (document.body.classList.contains('low-battery')) {
            localStorage.setItem('batteryMode', 'enabled');
        } else {
            localStorage.setItem('batteryMode', 'disabled');
        }
    });
}


// ==========================================
// 3. OFFLINE ENGINE (Service Worker & IndexedDB)
// ==========================================

// Register Service Worker for pure offline PWA caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Active!'))
            .catch(err => console.error('SW Failed:', err));
    });
}

// Setup IndexedDB (The Phone's Local Storage for Offline Reports)
let dbLocal;
const request = indexedDB.open("DeadzoneDB", 2);
request.onupgradeneeded = function(event) {
    dbLocal = event.target.result;
    if (!dbLocal.objectStoreNames.contains("offline_reports")) {
        dbLocal.createObjectStore("offline_reports", { keyPath: "id", autoIncrement: true });
    }
};
request.onsuccess = function(event) { dbLocal = event.target.result; };

// Monitor Connection Status
const statusIndicator = document.getElementById('status-indicator');
const syncMessage = document.getElementById('sync-message');

function updateNetworkStatus() {
    if (navigator.onLine) {
        if (statusIndicator) {
            statusIndicator.innerHTML = "🟢 Online";
            statusIndicator.className = "online-text";
        }
        if (syncMessage) syncMessage.style.display = 'none';
        syncOfflineDataToCloud(); // The magic sync function!
    } else {
        if (statusIndicator) {
            statusIndicator.innerHTML = "🔴 Offline";
            statusIndicator.className = "offline-text";
        }
        if (syncMessage) syncMessage.style.display = 'block';
    }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus(); // Check on page load


// ==========================================
// 4. REPORT EMERGENCY PAGE LOGIC
// ==========================================
const reportForm = document.getElementById('hazard-form');
if (reportForm) {
    const typeSelect = document.getElementById('type');
    const customTypeGroup = document.getElementById('custom-type-group');
    const customTypeInput = document.getElementById('custom-type');
    const locationInput = document.getElementById('location');
    const gpsBtn = document.getElementById('gps-btn');

    // Show/Hide "Other" input field
    typeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Other') {
            customTypeGroup.classList.remove('hidden');
            customTypeInput.required = true;
        } else {
            customTypeGroup.classList.add('hidden');
            customTypeInput.required = false;
        }
    });

    // GPS "Find Me" Feature
    if (gpsBtn) {
        gpsBtn.addEventListener('click', () => {
            if ("geolocation" in navigator) {
                gpsBtn.innerText = "⏳ Locating...";
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        locationInput.value = `GPS: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
                        gpsBtn.innerText = "✅ Found";
                    },
                    (error) => {
                        alert("GPS access denied or unavailable.");
                        gpsBtn.innerText = "📍 Find Me";
                    }
                );
            } else {
                alert("GPS not supported on this device.");
            }
        });
    }

    // Handle Form Submission
    reportForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Determine the final hazard type
        let finalType = typeSelect.value;
        let isCustom = false;
        if (finalType === 'Other') {
            finalType = customTypeInput.value;
            isCustom = true;
        }

        const reportData = {
            type: finalType,
            location: locationInput.value,
            description: document.getElementById('description').value,
            timestamp: new Date().toLocaleString(),
            isCustom: isCustom
        };

        if (navigator.onLine) {
            // Online? Push straight to Firebase Cloud!
            dbCloud.ref('reports').push(reportData)
                .then(() => {
                    alert("✅ Report sent to rescue teams!");
                    reportForm.reset();
                    customTypeGroup.classList.add('hidden');
                });
        } else {
            // Offline? Save to IndexedDB!
            const transaction = dbLocal.transaction(["offline_reports"], "readwrite");
            transaction.objectStore("offline_reports").add(reportData);
            transaction.oncomplete = () => {
                alert("⚠️ Saved Offline. Will auto-sync when signal returns.");
                reportForm.reset();
                customTypeGroup.classList.add('hidden');
            };
        }
    });
}

// Function to push offline data to the cloud when internet returns
function syncOfflineDataToCloud() {
    if (!dbLocal) return;
    const transaction = dbLocal.transaction(["offline_reports"], "readwrite");
    const store = transaction.objectStore("offline_reports");
    const request = store.getAll();

    request.onsuccess = function() {
        const offlineReports = request.result;
        if (offlineReports.length > 0) {
            console.log(`Syncing ${offlineReports.length} offline reports to cloud...`);
            
            offlineReports.forEach(report => {
                // Push to Firebase
                dbCloud.ref('reports').push({
                    type: report.type,
                    location: report.location,
                    description: report.description,
                    timestamp: report.timestamp,
                    isCustom: report.isCustom || false
                });
                // Remove from local queue
                store.delete(report.id); 
            });
            alert("📶 Connection Restored! All offline reports have been synced.");
        }
    };
}


// ==========================================
// 5. LIVE DASHBOARD LOGIC (Real-time updates)
// ==========================================
const reportsContainer = document.getElementById('reports-container');
const reportCount = document.getElementById('report-count');

if (reportsContainer) {
    // Listen to Firebase for real-time changes
    dbCloud.ref('reports').on('value', (snapshot) => {
        reportsContainer.innerHTML = ''; // Clear container
        const data = snapshot.val();
        
        if (!data) {
            reportsContainer.innerHTML = `<div class="empty-state"><p>No active reports. The area is secure.</p></div>`;
            reportCount.innerText = "0 Total";
            return;
        }

        // Convert Firebase object to an array and reverse it (newest first)
        const reportsArray = Object.values(data).reverse();
        reportCount.innerText = `${reportsArray.length} Total`;

        reportsArray.forEach(report => {
            // Determine badge color
            let badgeClass = 'info'; 
            if (['Trapped Person', 'Medical Emergency'].includes(report.type)) badgeClass = 'critical';
            else if (['Wildfire', 'Powerline Down'].includes(report.type)) badgeClass = 'warning';
            else if (report.isCustom) badgeClass = 'unclassified'; // Purple for custom

            const card = document.createElement('div');
            card.className = 'report-card';
            card.innerHTML = `
                <div class="report-header">
                    <span class="hazard-badge ${badgeClass}">${report.type}</span>
                    <span class="time">${report.timestamp}</span>
                </div>
                <h4>${report.location}</h4>
                <p>${report.description}</p>
            `;
            reportsContainer.appendChild(card);
        });
    });

    // Listen for Admin Announcements
    dbCloud.ref('announcements').on('value', (snapshot) => {
        const announcement = snapshot.val();
        if (announcement) {
            // If there's an active announcement, show a giant alert banner at the top of the dashboard!
            const existingAlert = document.getElementById('broadcast-alert');
            if(existingAlert) existingAlert.remove();

            const alertDiv = document.createElement('div');
            alertDiv.id = 'broadcast-alert';
            alertDiv.style = "background: #ef4444; color: white; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 5px 15px rgba(239, 68, 68, 0.4); animation: fadeIn 0.5s;";
            alertDiv.innerHTML = `<h3 style="margin-bottom: 5px;">📢 ${announcement.title}</h3><p>${announcement.message}</p>`;
            
            reportsContainer.parentNode.insertBefore(alertDiv, reportsContainer);
        }
    });
}


// ==========================================
// 6. ADMIN PORTAL LOGIC
// ==========================================
const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) {
    const loginSection = document.getElementById('admin-login-section');
    const dashboardSection = document.getElementById('admin-dashboard-section');

    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pass = document.getElementById('admin-pass').value;
        
        if (pass === "admin123") {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
        } else {
            alert("❌ Incorrect Passcode");
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        dashboardSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        document.getElementById('admin-pass').value = '';
    });

    // Admin Feature: Clear All Test Data
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        if(confirm("CRITICAL WARNING: Are you sure you want to delete ALL live rescue reports?")) {
            dbCloud.ref('reports').remove()
                .then(() => alert("All data wiped successfully."));
        }
    });

    // Admin Feature: Send Broadcast Announcement
    document.getElementById('announcement-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('announce-title').value;
        const msg = document.getElementById('announce-msg').value;

        dbCloud.ref('announcements').set({
            title: title,
            message: msg,
            timestamp: new Date().toLocaleString()
        }).then(() => {
            alert("📢 Broadcast sent to all connected devices!");
            document.getElementById('announcement-form').reset();
        });
    });
}