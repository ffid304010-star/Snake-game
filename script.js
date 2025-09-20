document.addEventListener('DOMContentLoaded', () => {
    // Firebase Configuration
    const firebaseConfig = {
      authDomain: "crash-an-egg.firebaseapp.com",
      databaseURL: "https://crash-an-egg-default-rtdb.firebaseio.com",
      projectId: "crash-an-egg",
      storageBucket: "crash-an-egg.firebasestorage.app",
      messagingSenderId: "675612863279",
      appId: "1:675612863279:web:7e384a59ee3e97c0258fda",
      measurementId: "G-EYSLPZ2B19"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const tg = window.Telegram.WebApp;

    // Get user ID from Telegram
    const userId = tg.initDataUnsafe?.user?.id || 'test_user_12345'; // Fallback for local testing

    // Page Elements
    const gameContainer = document.getElementById('game-container');
    const walletContainer = document.getElementById('wallet-container');
    const pages = {
        game: gameContainer,
        wallet: walletContainer
    };

    // Footer Buttons
    const gameBtn = document.getElementById('game-btn');
    const showAdsBtn = document.getElementById('show-ads-btn');
    const walletBtn = document.getElementById('wallet-btn');

    // Wallet Elements
    const coinBalanceElem = document.getElementById('coin-balance');
    const bkashNumberInput = document.getElementById('bkash-number');
    const withdrawAmountInput = document.getElementById('withdraw-amount');
    const withdrawBtn = document.getElementById('withdraw-btn');

    // Game Elements
    const gameBoard = document.getElementById('game-board');
    const ctx = gameBoard.getContext('2d');
    const scoreElem = document.getElementById('score');

    // Game Variables
    const tileSize = 20;
    const boardSize = gameBoard.width / tileSize;
    let snake = [{ x: 10, y: 10 }];
    let food = {};
    let score = 0;
    let dx = 0;
    let dy = 0;
    let gameLoop;
    let isGameOver = false;

    // --- Core Functions ---

    function switchPage(pageName) {
        Object.values(pages).forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.footer-btn').forEach(btn => btn.classList.remove('active'));

        if (pages[pageName]) {
            pages[pageName].classList.add('active');
            document.getElementById(`${pageName}-btn`).classList.add('active');
        }
    }

    function updateCoinBalance() {
        const userCoinsRef = database.ref('users/' + userId + '/coins');
        userCoinsRef.on('value', (snapshot) => {
            const coins = snapshot.val() || 0;
            coinBalanceElem.textContent = coins;
        });
    }

    function addCoins(amount) {
        const userCoinsRef = database.ref('users/' + userId + '/coins');
        userCoinsRef.transaction((currentCoins) => {
            return (currentCoins || 0) + amount;
        });
    }
    
    // --- Ad Simulation ---

    function showAd() {
        tg.showPopup({
            title: 'Advertisement',
            message: 'Imagine you are watching an ad for 5 seconds...',
            buttons: [{id: 'close', type: 'close'}]
        });
        
        setTimeout(() => {
            addCoins(10);
            tg.showPopup({
                title: 'Congratulations!',
                message: 'You have earned 10 coins!',
                buttons: [{id: 'ok', type: 'ok'}]
            });
        }, 5000); // 5 second ad simulation
    }
    
    // --- Withdraw Logic ---
    
    function handleWithdraw() {
        const bkashNumber = bkashNumberInput.value;
        const amount = parseInt(withdrawAmountInput.value);
        const currentBalance = parseInt(coinBalanceElem.textContent);

        if (!bkashNumber || bkashNumber.length < 11) {
            tg.showAlert("Please enter a valid Bkash number.");
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            tg.showAlert("Please enter a valid amount.");
            return;
        }
        if (amount < 10000) {
            tg.showAlert("Minimum withdraw amount is 10,000 coins.");
            return;
        }
        if (amount > currentBalance) {
            tg.showAlert("You do not have enough coins to withdraw.");
            return;
        }
        
        const withdrawRequest = {
            userId: userId,
            bkashNumber: bkashNumber,
            amount: amount,
            status: 'pending',
            timestamp: Date.now()
        };

        const newWithdrawRef = database.ref('withdrawals').push();
        newWithdrawRef.set(withdrawRequest)
            .then(() => {
                const userCoinsRef = database.ref('users/' + userId + '/coins');
                userCoinsRef.transaction((currentCoins) => (currentCoins || 0) - amount);
                tg.showAlert("Your withdraw request has been submitted successfully!");
                bkashNumberInput.value = '';
                withdrawAmountInput.value = '';
            })
            .catch((error) => {
                tg.showAlert("An error occurred: " + error.message);
            });
    }

    // --- Snake Game Logic ---

    function generateFood() {
        food = {
            x: Math.floor(Math.random() * boardSize),
            y: Math.floor(Math.random() * boardSize)
        };
        // Ensure food doesn't spawn on the snake
        for (let part of snake) {
            if (part.x === food.x && part.y === food.y) {
                generateFood();
                return;
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, gameBoard.width, gameBoard.height);
        for (let i = 0; i < snake.length; i++) {
            ctx.fillStyle = i === 0 ? '#34C759' : '#A4E8AF';
            ctx.fillRect(snake[i].x * tileSize, snake[i].y * tileSize, tileSize, tileSize);
        }
        ctx.fillStyle = '#FF3B30';
        ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize, tileSize);
    }

    function updateGame() {
        if (isGameOver) return;
        const head = { x: snake[0].x + dx, y: snake[0].y + dy };
        if (head.x < 0 || head.x >= boardSize || head.y < 0 || head.y >= boardSize || checkCollision(head)) {
            gameOver();
            return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score++;
            scoreElem.textContent = score;
            generateFood();
        } else {
            snake.pop();
        }
        draw();
    }

    function checkCollision(head) {
        return snake.some(part => part.x === head.x && part.y === head.y);
    }
    
    function gameOver() {
        isGameOver = true;
        clearInterval(gameLoop);
        tg.showPopup({
            title: 'Game Over!',
            message: `Your score is ${score}. You earned ${score} coins!`,
            buttons: [{id: 'ok', type: 'ok'}]
        });
        addCoins(score); // Add score as coins
    }

    function startGame() {
        snake = [{ x: 10, y: 10 }];
        dx = 0; dy = 0;
        score = 0;
        isGameOver = false;
        scoreElem.textContent = score;
        generateFood();
        clearInterval(gameLoop);
        gameLoop = setInterval(updateGame, 150);
    }
    
    function changeDirection(event) {
        const key = event.key;
        if (key === 'ArrowUp' && dy === 0) { dx = 0; dy = -1; }
        else if (key === 'ArrowDown' && dy === 0) { dx = 0; dy = 1; }
        else if (key === 'ArrowLeft' && dx === 0) { dx = -1; dy = 0; }
        else if (key === 'ArrowRight' && dx === 0) { dx = 1; dy = 0; }
    }

    // --- Event Listeners ---

    gameBtn.addEventListener('click', () => {
        switchPage('game');
        startGame();
    });
    showAdsBtn.addEventListener('click', showAd);
    walletBtn.addEventListener('click', () => switchPage('wallet'));
    withdrawBtn.addEventListener('click', handleWithdraw);
    document.addEventListener('keydown', changeDirection);

    // --- Initializer ---

    function initializeApp() {
        tg.ready();
        tg.expand();
        switchPage('game');
        updateCoinBalance();
        startGame();
    }

    initializeApp();
});
