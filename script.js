// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// IMPORTANT: Added 'query' to the import list
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDuiYgA_QbT_mAamKpQbBGZZ1F-9hTnBrs",
    authDomain: "vibe-storefront-tracker.firebaseapp.com",
    projectId: "vibe-storefront-tracker",
    storageBucket: "vibe-storefront-tracker.firebasestorage.app",
    messagingSenderId: "444468826127",
    appId: "1:444468826127:web:5c665d5206ce3b427ad37a",
    measurementId: "G-VNMPCB2N3F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global variable for user ID
let userId = null;

// Reference to the add transaction button
const addTransactionBtn = document.getElementById('addTransactionBtn');

/**
 * Authenticates the user anonymously if not already authenticated.
 * Sets up real-time listeners for transactions once authenticated.
 */
async function authenticateAndSetupListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            document.getElementById('userIdDisplay').textContent = `Your User ID: ${userId}`;
            console.log("User authenticated:", userId);
            setupTransactionsListener();
            addTransactionBtn.addEventListener('click', handleAddTransaction);
        } else {
            try {
                const result = await signInAnonymously(auth);
                userId = result.user.uid;
                document.getElementById('userIdDisplay').textContent = `Your User ID: ${userId} (Anonymous)`;
                console.log("Signed in anonymously:", userId);
                setupTransactionsListener();
                addTransactionBtn.addEventListener('click', handleAddTransaction);
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                showModal(`Error: Could not sign in anonymously. ${error.message}`, 'alert');
            }
        }
    });
}

/**
 * Sets up a real-time listener for transactions from Firestore.
 * Updates the UI with new data.
 */
function setupTransactionsListener() {
    if (!userId) {
        console.warn("User ID not available, cannot listen to transactions.");
        return;
    }
    const transactionsCollectionRef = collection(db, `users/${userId}/transactions`);
    // Now 'query' is correctly imported and can be used
    const q = query(transactionsCollectionRef, orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        const transactions = [];
        snapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        console.log("Transactions updated:", transactions); // Added logging
        renderTransactions(transactions);
        calculateSummary(transactions);
    }, (error) => {
        console.error("Error fetching transactions:", error);
        showModal(`Error loading transactions: ${error.message}`, 'alert');
    });
}

/**
 * Renders the list of transactions in the UI.
 * @param {Array} transactions - An array of transaction objects.
 */
function renderTransactions(transactions) {
    const transactionsList = document.getElementById('transactionsList');
    transactionsList.innerHTML = ''; // Clear existing list

    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p id="noTransactionsMessage" style="text-align: center; color: #777;">No transactions yet. Add one above!</p>';
        return;
    }

    transactions.forEach(transaction => {
        const listItem = document.createElement('li');
        listItem.className = 'transaction-item';
        listItem.dataset.id = transaction.id;

        const date = new Date(transaction.timestamp).toLocaleDateString();
        const time = new Date(transaction.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        listItem.innerHTML = `
            <div class="transaction-info">
                <strong>${transaction.description}</strong>
                <span>${date} ${time}</span>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'}$${transaction.amount.toFixed(2)}
            </div>
            <button class="delete-button" data-id="${transaction.id}">&#x2715;</button>
        `;
        transactionsList.appendChild(listItem);
    });

    transactionsList.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const transactionIdToDelete = event.target.dataset.id;
            showModal('Are you sure you want to delete this transaction?', 'confirm', () => {
                deleteTransaction(transactionIdToDelete);
            });
        });
    });
}

/**
 * Calculates and displays the summary of income, expenses, and profit/loss.
 * @param {Array} transactions - An array of transaction objects.
 */
function calculateSummary(transactions) {
    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach(transaction => {
        if (transaction.type === 'income') {
            totalIncome += transaction.amount;
        } else if (transaction.type === 'expense') {
            totalExpenses += transaction.amount;
        }
    });

    const profitOrLoss = totalIncome - totalExpenses;

    document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('profitOrLoss').textContent = `$${profitOrLoss.toFixed(2)}`;

    const profitOrLossElement = document.getElementById('profitOrLoss');
    profitOrLossElement.style.color = profitOrLoss >= 0 ? '#007bff' : '#dc3545';
}

/**
 * Handles the addition of a new transaction to Firestore.
 */
async function handleAddTransaction() {
    const descriptionInput = document.getElementById('description');
    const amountInput = document.getElementById('amount');
    const typeInput = document.getElementById('type');

    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const type = typeInput.value;

    if (!description || isNaN(amount) || amount <= 0) {
        showModal('Please enter a valid description and a positive amount.', 'alert');
        return;
    }

    if (!userId) {
        console.error("User ID not available, cannot add transaction.");
        showModal("Error: User not authenticated. Please try again.", 'alert');
        return;
    }

    console.log("Attempting to add transaction for user:", userId);

    try {
        const docRef = await addDoc(collection(db, `users/${userId}/transactions`), {
            description: description,
            amount: amount,
            type: type,
            timestamp: Date.now()
        });
        console.log("Transaction added with ID:", docRef.id);
        descriptionInput.value = '';
        amountInput.value = '';
        typeInput.value = 'income';
    } catch (error) {
        console.error("Error adding document:", error);
        showModal(`Error adding transaction: ${error.message}`, 'alert');
    }
}

/**
 * Deletes a transaction from Firestore.
 * @param {string} transactionId - The ID of the transaction document to delete.
 */
async function deleteTransaction(transactionId) {
    if (!userId) {
        console.error("User ID not available, cannot delete transaction.");
        showModal("Error: User not authenticated. Please try again.", 'alert');
        return;
    }
    try {
        await deleteDoc(doc(db, `users/${userId}/transactions`, transactionId));
        console.log("Transaction deleted successfully!");
    } catch (error) {
        console.error("Error deleting document:", error);
        showModal(`Error deleting transaction: ${error.message}`, 'alert');
    }
}

/* --- Custom Modal Logic --- */
const customModal = document.getElementById('customModal');
const modalMessage = document.getElementById('modalMessage');
const modalButtons = document.getElementById('modalButtons');
const closeButton = document.querySelector('.close-button');

function showModal(message, type = 'alert', onConfirm = null) {
    modalMessage.textContent = message;
    modalButtons.innerHTML = '';

    if (type === 'alert') {
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'confirm';
        okButton.onclick = () => customModal.style.display = 'none';
        modalButtons.appendChild(okButton);
    } else if (type === 'confirm') {
        const yesButton = document.createElement('button');
        yesButton.textContent = 'Yes';
        yesButton.className = 'confirm';
        yesButton.onclick = () => {
            if (onConfirm) onConfirm();
            customModal.style.display = 'none';
        };

        const noButton = document.createElement('button');
        noButton.textContent = 'No';
        noButton.className = 'cancel';
        noButton.onclick = () => customModal.style.display = 'none';

        modalButtons.appendChild(yesButton);
        modalButtons.appendChild(noButton);
    }

    customModal.style.display = 'flex';
}

closeButton.addEventListener('click', () => {
    customModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === customModal) {
        customModal.style.display = 'none';
    }
});

// Initialize Firebase and authentication when the window loads
window.onload = authenticateAndSetupListener;
