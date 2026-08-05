// Import Firebase core and features via CDN modules
import { initializeApp } from "https://gstatic.com";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://gstatic.com";
import { getDatabase, ref, set, push, onValue } from "https://gstatic.com";

// --- PASTE YOUR EXACT COPIED FIREBASE CONFIG OBJECT HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyBbkux5VfjJOu8LrQ01vvWihztrbPuQuCs",
  authDomain: "sahara-hrms.firebaseapp.com",
  projectId: "sahara-hrms",
  storageBucket: "sahara-hrms.firebasestorage.app",
  messagingSenderId: "676034766674",
  appId: "1:676034766674:web:a1478194d3fbe7536f3c8b",
  measurementId: "G-S2VD2XBZRR"
};
// -----------------------------------------------------------

// Initialize Firebase engine instances
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// DOM elements cache references
const authScreen = document.getElementById('authScreen');
const employeeScreen = document.getElementById('employeeScreen');
const adminScreen = document.getElementById('adminScreen');
const authTitle = document.getElementById('authTitle');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authPrimaryBtn = document.getElementById('authPrimaryBtn');
const authToggleText = document.getElementById('authToggleText');
const authToggleBtn = document.getElementById('authToggleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const liveClock = document.getElementById('liveClock');
const punchInBtn = document.getElementById('punchInBtn');
const punchOutBtn = document.getElementById('punchOutBtn');
const punchStatus = document.getElementById('punchStatus');
const leaveDate = document.getElementById('leaveDate');
const leaveReason = document.getElementById('leaveReason');
const submitLeaveBtn = document.getElementById('submitLeaveBtn');
const adminAttendanceList = document.getElementById('adminAttendanceList');
const adminLeaveList = document.getElementById('adminLeaveList');

let isLoginMode = true;
let currentUserData = null;

// Live interactive digital desk clock loop
setInterval(() => {
    const now = new Date();
    liveClock.textContent = now.toTimeString().split(' ')[0];
}, 1000);

// Toggle between Sign In layout and Create Account layout
authToggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authTitle.textContent = isLoginMode ? 'Sign In' : 'Create Account';
    authPrimaryBtn.textContent = isLoginMode ? 'Login' : 'Register';
    authToggleText.textContent = isLoginMode ? 'Need an account?' : 'Already have an account?';
    authToggleBtn.textContent = isLoginMode ? 'Create one' : 'Sign in';
});

// Authentication Primary Process Execution
authPrimaryBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) return alert('Please enter all security credentials.');

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Default first account as Admin for testing, others as regular employees
            const assignedRole = email.includes('admin') ? 'admin' : 'employee';
            
            await set(ref(db, 'users/' + user.uid), {
                uid: user.uid,
                email: email,
                role: assignedRole,
                name: email.split('@')[0]
            });
            alert('Account created successfully!');
        }
    } catch (error) {
        alert(error.message);
    }
});

// Handle user logouts
logoutBtn.addEventListener('click', () => signOut(auth));

// Application State Routing Management based on authenticated session state
onAuthStateChanged(auth, (user) => {
    if (user) {
        logoutBtn.classList.remove('hidden');
        authScreen.classList.add('hidden');
        
        onValue(ref(db, 'users/' + user.uid), (snapshot) => {
            currentUserData = snapshot.val() || { role: 'employee', name: user.email.split('@')[0] };
            if (currentUserData.role === 'admin') {
                showAdminInterface();
            } else {
                showEmployeeInterface();
            }
        }, { onlyOnce: true });
    } else {
        currentUserData = null;
        logoutBtn.classList.add('hidden');
        authScreen.classList.remove('hidden');
        employeeScreen.classList.add('hidden');
        adminScreen.classList.add('hidden');
        emailInput.value = '';
        passwordInput.value = '';
    }
});

function showEmployeeInterface() {
    employeeScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
    
    const today = new Date().toISOString().split('T')[0];
    onValue(ref(db, `attendance/${auth.currentUser.uid}/${today}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            if (data.checkIn && data.checkOut) {
                punchStatus.textContent = `Completed: Shift logged today!`;
                punchInBtn.disabled = true;
                punchOutBtn.disabled = true;
            } else if (data.checkIn) {
                punchStatus.textContent = `Active: Checked in at ${data.checkIn}`;
                punchInBtn.disabled = true;
                punchOutBtn.disabled = false;
            }
        } else {
            punchStatus.textContent = 'Not checked in today';
            punchInBtn.disabled = false;
            punchOutBtn.disabled = true;
        }
    });
}

// Attendance Time Recording Updates
punchInBtn.addEventListener('click', async () => {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    await set(ref(db, `attendance/${auth.currentUser.uid}/${today}`), {
        employeeName: currentUserData.name,
        date: today,
        checkIn: time
    });
});

punchOutBtn.addEventListener('click', async () => {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    await set(ref(db, `attendance/${auth.currentUser.uid}/${today}/checkOut`), time);
});

// Leave Application Processing Submission
submitLeaveBtn.addEventListener('click', async () => {
    const date = leaveDate.value;
    const reason = leaveReason.value.trim();
    if (!date || !reason) return alert('Fill out complete fields.');

    const leaveRef = ref(db, 'leaves');
    const newLeaveRef = push(leaveRef);
    await set(newLeaveRef, {
        uid: auth.currentUser.uid,
        employeeName: currentUserData.name,
        date: date,
        reason: reason,
        status: 'Pending'
    });
    alert('Leave request dispatched successfully!');
    leaveDate.value = '';
    leaveReason.value = '';
});

function showAdminInterface() {
    adminScreen.classList.remove('hidden');
    employeeScreen.classList.add('hidden');
    
    // Live Monitoring Feed for Admin Overview
    onValue(ref(db, 'attendance'), (snapshot) => {
        adminAttendanceList.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            adminAttendanceList.innerHTML = '<p class="italic text-gray-500">No punch records found.</p>';
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        let entriesFound = false;
        
        Object.keys(data).forEach(uid => {
            if (data[uid][today]) {
                entriesFound = true;
                const record = data[uid][today];
                const item = document.createElement('div');
                item.className = "bg-gray-700/50 p-2.5 rounded-lg border border-gray-600/40 flex justify-between";
                item.innerHTML = `<strong>${record.employeeName}</strong> <span>In: ${record.checkIn} | Out: ${record.checkOut || '--:--'}</span>`;
                adminAttendanceList.appendChild(item);
            }
        });
        if (!entriesFound) adminAttendanceList.innerHTML = '<p class="italic text-gray-500">No logs recorded today.</p>';
    });

    onValue(ref(db, 'leaves'), (snapshot) => {
        adminLeaveList.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            adminLeaveList.innerHTML = '<p class="italic text-gray-500">No pending requests.</p>';
            return;
        }
        Object.keys(data).forEach(key => {
            const leave = data[key];
            if (leave.status === 'Pending') {
                const item = document.createElement('div');
                item.className = "bg-gray-700/50 p-3 rounded-lg border border-gray-600/40 space-y-2";
                item.innerHTML = `
                    <div><strong>${leave.employeeName}</strong> requires leave on <strong>${leave.date}</strong><br><span class="text-xs text-gray-400">Reason: ${leave.reason}</span></div>
                    <div class="flex gap-2"><button onclick="window.updateLeaveStatus('${key}', 'Approved')" class="bg-emerald-600 px-3 py-1 text-xs font-bold rounded text-white">Approve</button><button onclick="window.updateLeaveStatus('${key}', 'Rejected')" class="bg-rose-600 px-3 py-1 text-xs font-bold rounded text-white">Reject</button></div>
                `;
                adminLeaveList.appendChild(item);
            }
        });
    });
}

window.updateLeaveStatus = async function(key, status) {
    await set(ref(db, `leaves/${key}/status`), status);
};
