window.onload = function (){
    var game = document.getElementById("game");
    var gameStart = document.getElementById("gameStart");
    var gameEnter = document.getElementById("gameEnter");
    var myPlane = document.getElementById("myPlane");
    var bulletsP = document.getElementById("bullets");
    var enemiesP = document.getElementById("enemies");
    var s = document.getElementById("s");

    var gameW = parseFloat(getStyle(game,"width"));
    var gameH = parseFloat(getStyle(game,"height"));
    var gameML = parseFloat(getStyle(game,"marginLeft"));
    var gameMT = parseFloat(getStyle(game,"marginTop"));
    var myPlaneW = parseFloat(getStyle(myPlane,"width"));
    var myPlaneH = parseFloat(getStyle(myPlane,"height"));
    var bulletW = 8;
    var bulletH = 16;

    var gameStatus = false;
    var a = null; //bullets timer
    var b = null; //enemies timer
    var c = null; //packages timer

    var bullets = [];
    var enemies = [];
    var scores = 0;

    //create an getStyle function
    function getStyle(obj, name) {
        if (window.getComputedStyle) {
            return getComputedStyle(obj, null)[name];
            return obj.currentStyle[name];
        }
    }

    //create an onclick function for span 
    gameStart.firstElementChild.onclick = function () {
        gameStart.style.display = "none";
        gameEnter.style.display = "block";

        document.onkeyup = function(event){
            var event = event||window.event;
            if (event.keyCode == 32) {
                if (!gameStatus){
                    gameEnter.style.backgroundImage = "url(../images/bg.png)";
                    this.onmousemove = myPlaneMove;
                    shot();
                    appearEnemy();
                    if (bullets.length != 0) restart(bullets,1);
                    if (enemies.length != 0) restart(enemies);
                }
                else if (gameStatus){
                    this.onmousemove = null;
                    clearInterval(a);
                    clearInterval(b);
                    a = null;
                    b = null;
                    clear(bullets);
                    clear(enemies);
                }
                gameStatus = !gameStatus;
            };
        }
    }

    function myPlaneMove(event) {
        var event = event||window.event;
        var mouse_x = event.X||event.pageX;
        var mouse_y = event.Y||event.pageY;
        var last_myPlane_left = mouse_x - gameML -myPlaneW/2;
        var last_myPlane_top = mouse_y - gameMT -myPlaneH/2;

        if (last_myPlane_left <= 0) {
            last_myPlane_left = 0;
        } else if (last_myPlane_left >= (gameW - myPlaneW)) {
            last_myPlane_left = (gameW - myPlaneW);
        }
        if (last_myPlane_top <= 0) {
            last_myPlane_top = 0;
        } else if (last_myPlane_top >= (gameH - myPlaneH)) {
            last_myPlane_top = (gameH - myPlaneH);
        }
        myPlane.style.left = last_myPlane_left+"px";
        myPlane.style.top = last_myPlane_top+"px";
    }

    function shot() {
        a = setInterval(function(){
            createBullet()
        },150);
    }
    function createBullet() {
        var bullet = new Image();
        bullet.src = "../images/bullet1.png";
        var myPlaneL = parseFloat(getStyle(myPlane,"left"));
        var myPlaneT = parseFloat(getStyle(myPlane,"top"));
        var bulletL = myPlaneL + (myPlaneW/2) - (bulletW/2);
        var bulletT = myPlaneT - bulletH;
        bullet.style.left = bulletL +"px";
        bullet.style.top = bulletT +"px";
        bullet.className = "b";
        bulletsP.appendChild(bullet);
        bullets.push(bullet);
        move(bullet,"top");
    }
    function move(obj, attr) {
        obj.timer = setInterval(function () {
            var speed = -5;
            var oldValue = parseFloat(getStyle(obj, attr));
            var newValue = oldValue + speed;
            if (newValue <= bulletH) {
                clearInterval(obj.timer);
                obj.parentNode.removeChild(obj);
                bullets.splice(0,1);
            }
            obj.style[attr] = newValue + "px";
        }, 10)
    }

    //enemies info
    var enemiesObj = {
        enemy1: {
            width: 50,
            heiht: 50,
            score: 10,
            hp: 300
        },
        enemy2: {
            width: 70,
            heiht: 70,
            score: 30,
            hp: 800
        },
        enemy3: {
            width: 110,
            heiht: 110,
            score: 50,
            hp: 1800
        }
    }
    function appearEnemy () {
        // if (b) return ;
        b = setInterval(function (){
        createEnemy();
        deleteEnemy();
        },1000)
    }
    
    function createEnemy () {
        var percentData = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,3];
        var enemyType = percentData[Math.floor(Math.random()*percentData.length)];
         //create the data of enemies
        var enemyData = enemiesObj["enemy"+enemyType];
        // create the enemy img
        var enemy = new Image(enemyData.width,enemyData.height);
        enemy.src = "../images/enemy" + enemyType + ".png";
        enemy.score = enemyData.score;
        enemy.hp = enemyData.hp;
        enemy.t = enemyType;
        enemy.dead = false;
        //start position of enemies
        var enemyL  = Math.floor(Math.random()*(gameW-enemyData.width+1));
        var enemyT = -enemyData.height;
        enemy.className = "e";
        enemy.style.left = enemyL + "px";
        enemy.style.top = enemyT+ "px";
        enemiesP.appendChild(enemy);
        enemies.push(enemy);
        enemyMove(enemy,"top");
    }
    function enemyMove(obj, attr) {
        obj.timer = setInterval(function () {
            var speed;
            if (obj.t == 1) {
                speed = 1.5;
            } else if (obj.t == 2) {
                speed = 1;
            } else if (obj.t == 3) {
                speed = 0.5;
            }
            var oldValue = parseFloat(getStyle(obj, attr));
            var newValue = oldValue + speed;
            if (newValue >= gameH) {
                clearInterval(obj.timer);
                obj.parentNode.removeChild(obj);
                enemies.splice(0,1);
            }
            obj.style[attr] = newValue + "px";
            collision(obj);
            collision2();
        }, 10)
    }
    
    //energy package
    var packagesObj = {
        package1: {
            value: "double",
        }
    }
    function appearPackage () {
        c = setInterval(function (){
        createPackage();
        },10000)
    };
    function createPackage () {
        var percentData = [1,1,1,2,2,3];
        var packageType = percentageData[Math.floor(Math.random()*percentageData)];
        var packageInfo = packagesObj["package"+ packageType]; 
        var package = new Image(30,30);
        package.src = "../images/packages"+ packageType + ".png";
        package.value = packageInfo.value;
    };


    //clear function
    function clear(childs) {
        for(var i= 0;i<childs.length;i++) {
            clearInterval(childs[i].timer);
        }
    }

    //restart function 
    function restart(childs,type) {
        for(var i= 0;i<childs.length;i++) {
            type ==1 ? move(childs[i],"top") : enemyMove(childs[i],"top");
        }
    }

    //test the collision between enemies and bullets
    function collision (enemy) {
        for (var i=0;i<bullets.length;i++) {
            var bulletL = parseFloat(getStyle(bullets[i],"left"));
            var bulletT = parseFloat(getStyle(bullets[i],"top"));
            var enemyL = parseFloat(getStyle(enemy,"left"));
            var enemyT = parseFloat(getStyle(enemy,"top"));
            var enemyW = parseFloat(getStyle(enemy,"width"));
            var enemyH = parseFloat(getStyle(enemy,"height"));

            var condition = bulletL + bulletW >=enemyL && bulletL <= enemyL + enemyW && bulletT <= enemyT + enemyH && bulletT + bulletH >= enemyT;

            if (condition) {

                //delete bullet
                clearInterval(bullets[i].timer);
                bulletsP.removeChild (bullets[i]);
                bullets.splice(i,1); 

                //minus hp
                enemy.hp -= 100;
                if (enemy.hp == 0) {
                    //delete enemy
                    clearInterval(enemy.timer)
                    enemy.src  = "../images/bz"+enemy.t+".png";
                    enemy.dead = true;
                    scores = scores + enemy.score;
                    s.innerHTML = scores;
                }
            }
        }
    }
    function deleteEnemy () {
        for (var i = enemies.length - 1; i>= 0;i--) {
            if (enemies[i].dead) {
                (function(index) {
                    enemiesP.removeChild(enemies[index]);
                    enemies.splice(index,1);
                }
                )(i)
            }
        }
    }

    // collision between plane and enemies
    function collision2 (){
        for (var i = 0; i<enemies.length ;i++) {
                var  enemyL = parseFloat(getStyle(enemies[i],"left"));
                var  enemyT = parseFloat(getStyle(enemies[i],"top"));
                var  enemyW = parseFloat(getStyle(enemies[i],"width"));
                var  enemyH = parseFloat(getStyle(enemies[i],"height"));
                var myPlaneL = parseFloat(getStyle(myPlane,"left"));
                var myPlaneT = parseFloat(getStyle(myPlane,"top"));
                var condition2 = myPlaneL + myPlaneW >= enemyL && myPlaneL <= enemyL + enemyW && myPlaneT >= enemyT - myPlaneH && myPlaneT <= enemyT + enemyH 
                
                if (condition2) {
                    myPlane.firstElementChild.src = "../images/bz4.png";
                    setTimeout(function(){
                        gameOver();
                    },1000);
                }
        }
    }

    function rem (childs) {
        for (var i = childs.length-1;i>=0;i--){
            clearInterval(childs[i].timer);
            console.log(childs[i].parentNode);
            childs[i].parentNode.removeChild(childs[i]);
        }
    }
    function gameOver() {
        clearInterval(a);
        clearInterval(b);
        clearInterval(c);
        a = null;
        b = null;
        c = null;
        rem(bullets);
        rem(enemies);
        bullets = [];
        enemies = [];
        gameStart.style.display = "block";
        gameEnter.style.display = "none";
        var myPlane = document.getElementById("myPlane");
        myPlane.style.left = "190px";
        myPlane.style.top = "757px";
        myPlane.firstElementChild.src = "../images/my4.png";
        scores = 0;
        s.innerHTML = scores;
        gameStatus = false;
        document.onmousemove = null;
    }
}
