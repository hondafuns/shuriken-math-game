document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const quizContainer = document.getElementById('quiz-container');
    const quizQuestionEl = document.getElementById('quiz-question');
    const quizAnswerEl = document.getElementById('quiz-answer');
    const quizSubmitBtn = document.getElementById('quiz-submit');
    const gameContainer = document.getElementById('game-container');
    const gameInfoBar = document.getElementById('game-info-bar');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const shurikenCountEl = document.getElementById('shuriken-count');
    const popupContainer = document.getElementById('popup-container');
    const bgm = document.getElementById('bgm');
    const hitSound = document.getElementById('hit-sound');
    const quizBGM = document.getElementById('quiz-bgm');
    const correctSound = document.getElementById('correct-sound');
    const incorrectSound = document.getElementById('incorrect-sound');
    const secondChanceMessage = document.getElementById('second-chance-message');
    const lastChanceMessage = document.getElementById('last-chance-message');
    const finalScoreOverlay = document.getElementById('final-score-overlay');
    const finalScoreEl = document.getElementById('final-score');
    const retryButton = document.getElementById('retry-button');

    // --- Game Resolution ---
    const logicalWidth = 800;
    const logicalHeight = 600;

    // --- State Variables ---
    let audioUnlocked = false;
    let currentQuestion = 0;
    let correctAnswers = 0;
    let num1, num2, operator;
    const totalQuestions = 10;
    let score = 0;
    let shurikenCount = 0;
    let animationFrameId; 
    let attemptsLeft = 2; // 2 attempts: 1st try, 2nd chance, 3rd (last) chance

    const target = { x: logicalWidth / 2, y: 80, radius: 40, dx: 2 };
    const launcher = { x: logicalWidth / 2, y: logicalHeight * 0.8, angle: 0 };
    const shurikens = [];
    const shurikenImage = new Image();
    shurikenImage.src = 'yari.png';

    const backgroundImage = new Image();
    backgroundImage.src = 'yukimura.PNG';
    let backgroundOffsetY = 0; // For jump animation
    let jumpDirection = 1; // 1 for up, -1 for down

    // --- Audio Unlock Logic ---
    function unlockAndLoadAudio() {
        if (audioUnlocked) return;
        const audioElements = [bgm, hitSound, quizBGM, correctSound, incorrectSound];
        audioElements.forEach(audio => {
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                console.log(audio.id + " unlocked successfully.");
            }).catch(e => console.error("Audio unlock failed for", audio.id, ":", e));
        });
        audioUnlocked = true;
    }

    // --- Quiz Logic ---
    function generateQuestion() {
        secondChanceMessage.classList.add('hidden'); // Hide second chance message
        lastChanceMessage.classList.add('hidden'); // Hide last chance message
        attemptsLeft = 2; // Reset attempts for new question
        const operators = ['+', '-', '*', '/'];
        operator = operators[Math.floor(Math.random() * operators.length)];

        switch (operator) {
            case '+':
                num1 = Math.floor(Math.random() * 90) + 10; // 10-99
                num2 = Math.floor(Math.random() * 90) + 10; // 10-99
                break;
            case '-':
                num1 = Math.floor(Math.random() * 90) + 10; // 10-99
                num2 = Math.floor(Math.random() * (num1 - 9)) + 10; // 10-num1, ensure result is positive and 2-digit
                break;
            case '*':
                num1 = Math.floor(Math.random() * 90) + 10; // 10-99
                num2 = Math.floor(Math.random() * 9) + 1; // 1-9
                break;
            case '/':
                num2 = Math.floor(Math.random() * 9) + 1; // 1-9 (divisor)
                num1 = num2 * (Math.floor(Math.random() * 10) + 1); // Ensure num1 is a multiple of num2
                break;
        }
        quizQuestionEl.textContent = `${num1} ${operator} ${num2} = ?`;
        quizAnswerEl.value = '';
        quizAnswerEl.focus();
        quizBGM.play().catch(e => console.error("Quiz BGM Playback Failed (generateQuestion):", e));
    }

    function handleAnswer() {
        unlockAndLoadAudio();
        if (quizAnswerEl.value === '') return;
        const userAnswer = parseInt(quizAnswerEl.value, 10);
        let correctAnswer;

        switch (operator) {
            case '+':
                correctAnswer = num1 + num2;
                break;
            case '-':
                correctAnswer = num1 - num2;
                break;
            case '*':
                correctAnswer = num1 * num2;
                break;
            case '/':
                correctAnswer = num1 / num2;
                break;
        }

        if (userAnswer === correctAnswer) {
            correctAnswers++;
            correctSound.currentTime = 0;
            correctSound.play().catch(e => console.error("Correct Sound Playback Failed:", e));
            secondChanceMessage.classList.add('hidden'); // Hide messages on correct answer
            lastChanceMessage.classList.add('hidden');
            currentQuestion++;
            if (currentQuestion < totalQuestions) {
                generateQuestion();
            } else {
                endQuiz();
            }
        } else {
            incorrectSound.currentTime = 0;
            incorrectSound.play().catch(e => console.error("Incorrect Sound Playback Failed:", e));
            attemptsLeft--;

            if (attemptsLeft === 1) {
                secondChanceMessage.classList.remove('hidden');
                lastChanceMessage.classList.add('hidden');
            } else if (attemptsLeft === 0) {
                secondChanceMessage.classList.add('hidden');
                lastChanceMessage.classList.remove('hidden');
            } else { // No more chances, move to next question
                secondChanceMessage.classList.add('hidden');
                lastChanceMessage.classList.add('hidden');
                currentQuestion++;
                if (currentQuestion < totalQuestions) {
                    generateQuestion();
                } else {
                    endQuiz();
                }
            }
            quizAnswerEl.value = ''; // Clear answer for retry
            quizAnswerEl.focus();
        }
    }

    function endQuiz() {
        quizContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        gameInfoBar.classList.remove('hidden'); 

        resizeCanvas(); 
        shurikenCount = correctAnswers;
        shurikenCountEl.textContent = shurikenCount;
        quizBGM.pause();
        quizBGM.currentTime = 0;
        bgm.play().catch(e => console.error("BGM Playback Failed in endQuiz:", e));
        gameLoop();
    }

    // --- Game Logic ---
    function drawSingleShuriken(x, y, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Calculate dimensions maintaining aspect ratio
        const originalWidth = shurikenImage.naturalWidth;
        const originalHeight = shurikenImage.naturalHeight;
        const targetHeight = 150; // Desired height for the spear
        const aspectRatio = originalWidth / originalHeight;
        const targetWidth = targetHeight * aspectRatio;

        ctx.drawImage(shurikenImage, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
        ctx.restore();
    }

    function drawTarget() {
        ctx.fillStyle = '#FF6347'; // Tomato Red
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function updateTarget() {
        target.x += target.dx;
        if (target.x + target.radius > logicalWidth || target.x - target.radius < 0) {
            target.dx *= -1;
        }
    }

    function drawShurikens() {
        shurikens.forEach(shuriken => drawSingleShuriken(shuriken.x, shuriken.y, shuriken.angle));
    }

    function drawLauncher() {
        ctx.globalAlpha = 0.8; // Increased alpha for more opacity
        drawSingleShuriken(launcher.x, launcher.y, launcher.angle);
        ctx.globalAlpha = 1.0;
    }

    function updateShurikens() {
        shurikens.forEach((shuriken, index) => {
            shuriken.y -= 7;
            // shuriken.angle += 0.2; // Rotation speed - Removed
            if (shuriken.y < -20) {
                shurikens.splice(index, 1);
            }
        });
    }

    function checkCollisions() {
        shurikens.forEach((shuriken, shurikenIndex) => {
            const distance = Math.sqrt(Math.pow(shuriken.x - target.x, 2) + Math.pow(shuriken.y - target.y, 2));
            if (distance < target.radius) {
                shurikens.splice(shurikenIndex, 1);
                score++;
                scoreEl.textContent = score;
                hitSound.currentTime = 0;
                hitSound.play().catch(e => console.error("Hit Sound Playback Failed in checkCollisions:", e));
                scoreEl.classList.add('score-pop');
                setTimeout(() => scoreEl.classList.remove('score-pop'), 200);
                popupContainer.classList.remove('hidden');
                popupContainer.classList.add('show');
                setTimeout(() => {
                    popupContainer.classList.remove('show');
                    setTimeout(() => popupContainer.classList.add('hidden'), 300);
                }, 800);
            }
        });
    }

    function gameLoop() {
        requestAnimationFrame(gameLoop);
        ctx.clearRect(0, 0, logicalWidth, logicalHeight); 

        // 背景画像を描画
        if (backgroundImage.complete) {
            const originalWidth = backgroundImage.naturalWidth;
            const originalHeight = backgroundImage.naturalHeight;
            const targetHeight = logicalHeight * 0.6; // 枠の6割の高さ (元の3割の2倍)
            const aspectRatio = originalWidth / originalHeight;
            const targetWidth = targetHeight * aspectRatio;

            const imgX = logicalWidth - targetWidth; // 右端に配置
            const imgY = logicalHeight - targetHeight + backgroundOffsetY; // 下端に配置 + ジャンプオフセット
            ctx.drawImage(backgroundImage, imgX, imgY, targetWidth, targetHeight);

            // ジャンプアニメーションの更新
            backgroundOffsetY += jumpDirection * 0.5; // ジャンプ速度
            if (backgroundOffsetY > 10 || backgroundOffsetY < 0) { // ジャンプの高さと着地
                jumpDirection *= -1;
            }
        }

        drawTarget();
        updateTarget();
        drawLauncher();
        drawShurikens();
        updateShurikens();
        checkCollisions();

        if (shurikenCount <= 0 && shurikens.length === 0) {
            cancelAnimationFrame(animationFrameId); 
            bgm.pause();
            bgm.currentTime = 0;
            finalScoreEl.textContent = score;
            finalScoreOverlay.classList.remove('hidden');
            return; 
        }
    }

    // --- Event Listeners ---
    quizSubmitBtn.addEventListener('click', () => {
        handleAnswer();
    });
    quizAnswerEl.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            handleAnswer();
        }
    });

    canvas.addEventListener('click', () => {
        if (shurikenCount > 0) {
            shurikens.push({ x: launcher.x, y: launcher.y, angle: launcher.angle });
            shurikenCount--;
            shurikenCountEl.textContent = shurikenCount;
        }
    });

    retryButton.addEventListener('click', () => {
        resetGame();
    });

    // --- Game Reset Logic ---
    function resetGame() {
        score = 0;
        shurikenCount = 0;
        shurikens.length = 0; 
        currentQuestion = 0;
        correctAnswers = 0;

        scoreEl.textContent = score;
        shurikenCountEl.textContent = shurikenCount;
        finalScoreOverlay.classList.add('hidden');
        gameContainer.classList.add('hidden');
        gameInfoBar.classList.add('hidden'); 
        quizContainer.classList.remove('hidden');

        generateQuestion();
    }

    // --- Canvas Resizing ---
    function resizeCanvas() {
        const gameContainerRect = gameContainer.getBoundingClientRect();
        canvas.width = gameContainerRect.width;
        canvas.height = gameContainerRect.height;

        const scaleX = canvas.width / logicalWidth;
        const scaleY = canvas.height / logicalHeight;

        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.scale(scaleX, scaleY);
    }

    // --- Initialisation ---
    function init() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        shurikenImage.onload = () => {
            generateQuestion();
        };
        if (shurikenImage.complete) {
            generateQuestion();
        }
    }

    init();
});