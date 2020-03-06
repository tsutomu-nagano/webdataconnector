
const PORT = process.env.PORT || 8080

// expressモジュールを読み込む
const express = require('express');


// expressアプリを生成する
const app = express();


app.use("/static",express.static(__dirname + '/static'));


app.get('/trade-stats', function (req, res) {
    res.sendFile(__dirname + '/static/index.html'); });


// ルート（http://localhost/）にアクセスしてきたときに「Hello」を返す
app.get('/', (req, res) => res.send('Hello'));

// ポート3000でサーバを立てる
app.listen(PORT, () => console.log(`Listening on ${ PORT }`))