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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

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

setInterval(() => {
    const now = new Date();
    liveClock.textContent = now.toTimeString().split(' ')[0];
}, 1000);

authToggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authTitle.textContent = isLoginMode ? 'Sign In' : 'Create Account';
    authPrimaryBtn.textContent = isLoginMode ? 'Login' : 'Register';
    authToggleText.textContent = isLoginMode ? 'Need an account?' : 'Already have an account?';
    authToggleBtn.textContent = isLoginMode ? 'Create one' : 'Sign in';
});

authPrimaryBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return alert('Please enter all credentials.');
    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const assignedRole = email.includes('admin') ? 'admin' : 'employee';
            await set(ref(db, 'users/' + user.uid), {
                uid: user.uid,
                email: email,
                role: assignedRole,
                name: email.split('@')[0]
            });
            alert('Account registered successfully!');
        }
    } catch (error) {
        alert(error.message);
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        logoutBtn.classList.remove('hidden');
        authScreen.classList.add('hidden');
        onValue(ref(db, 'users/' + user.uid), (snapshot) => {
            currentUserData = snapshot.val() || { role: 'employee', name: user.email.split('@')[0] };
            if (currentUserData.role === 'admin') {
                adminScreen.classList.remove('hidden');
                employeeScreen.classList.add('hidden');
                loadAdminData();
            } else {
                employeeScreen.classList.remove('hidden');
                adminScreen.classList.add('hidden');
                loadEmployeeData();
            }
        }, { onlyOnce: true });
    } else {
        currentUserData = null;
        logoutBtn.classList.add('hidden');
        authScreen.classList.remove('hidden');
        employeeScreen.classList.add('hidden');
        adminScreen.classList.add('hidden');
    }
});

function loadEmployeeData() {
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

submitLeaveBtn.addEventListener('click', async () => {
    const date = leaveDate.value;
    const reason = leaveReason.value.trim();
    if (!date || !reason) return alert('Fill out complete fields.');
    const newLeaveRef = push(ref(db, 'leaves'));
    await set(newLeaveRef, {
        uid: auth.currentUser.uid,
        employeeName: currentUserData.name,
        date: date,
        reason: reason,
        status: 'Pending'
    });
    alert('Leave request submitted!');
    leaveDate.value = '';
    leaveReason.value = '';
});

function loadAdminData() {
    const today = new Date().toISOString().split('T')[0];
    onValue(ref(db, 'attendance'), (snapshot) => {
        adminAttendanceList.innerHTML = '';
        const data = snapshot.val();
        let logsFound = false;
        if (data) {
            Object.keys(data).forEach(uid => {
                if (data[uid][today]) {
                    logsFound = true;
                    const log = data[uid][today];
                    const div = document.createElement('div');
                    div.className = "bg-gray-800 p-3 rounded-xl border border-gray-700 flex justify-between text-xs";
                    div.innerHTML = `<span><b>${log.employeeName}</b></span> <span>In: ${log.checkIn} | Out: ${log.checkOut || '--'}</span>`;
                    adminAttendanceList.appendChild(div);
                }
            });
        }
        if (!logsFound) adminAttendanceList.innerHTML = '<p class="italic text-gray-500 text-xs">No logs recorded today.</p>';
    });

    onValue(ref(db, 'leaves'), (snapshot) => {
        adminLeaveList.innerHTML = '';
        const data = snapshot.val();
        let requestsFound = false;
        if (data) {
            Object.keys(data).forEach(key => {
                const leave = data[key];
                if (leave.status === 'Pending') {
                    requestsFound = true;
                    const div = document.createElement('div');
                    div.className = "bg-gray-800 p-3 rounded-xl border border-gray-700 space-y-2 text-xs";
                    div.innerHTML = `
                        <div><b>${leave.employeeName}</b> (${leave.date})<br><span class="text-gray-400">${leave.reason}</span></div>
                        <div class="flex gap-2">
                            <button onclick="window.updateLeaveStatus('${key}', 'Approved')" class="bg-emerald-600 px-3 py-1 font-bold rounded text-white text-xxs">Approve</button>
                            <button onclick="window.updateLeaveStatus('${key}', 'Rejected')" class="bg-rose-600 px-3 py-1 font-bold rounded text-white text-xxs">Reject</button>
                        </div>`;
                    adminLeaveList.appendChild(div);
                }
            });
        }
        if (!requestsFound) adminLeaveList.innerHTML = '<p class="italic text-gray-500 text-xs">No pending requests.</p>';
    });
}

window.updateLeaveStatus = async function(key, status) {
    await set(ref(db, `leaves/${key}/status`), status);
};
