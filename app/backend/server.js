"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = __importDefault(require("socket.io"));
const ioredis_1 = __importDefault(require("ioredis"));
const helmet_1 = __importDefault(require("helmet"));
const mysql_1 = __importDefault(require("mysql"));
const node_os_1 = __importDefault(require("node:os"));
// Server and Socket
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 3000;
const server = http_1.default.createServer(app);
const io = (0, socket_io_1.default)(server);
class RedisClient {
    constructor() {
        this.client = new ioredis_1.default({
            port: Number(process.env.REDIS_PORT),
            host: process.env.REDIS_HOST,
        });
        this.subscriber = new ioredis_1.default({
            port: Number(process.env.REDIS_PORT),
            host: process.env.REDIS_HOST,
        });
        this.client.on("connect", () => {
            console.log("Connected to Redis");
        });
        this.client.on("error", (err) => {
            console.error("Redis error:", err);
        });
        this.subscriber.subscribe("update_notice_channel", () => {
            console.log("Subscribed to channel");
        });
    }
    // Set a value in Redis
    setValue(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.set(key, value);
            }
            catch (err) {
                console.error("Error setting value:", err);
            }
        });
    }
    // Get a value from Redis
    getValue(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const value = yield this.client.get(key);
                return value;
            }
            catch (err) {
                console.error("Error getting value:", err);
                return null;
            }
        });
    }
    // Close the Redis connection
    closeConnection() {
        this.client.quit();
    }
}
class MySQLClient {
    constructor() {
        this.pool = mysql_1.default.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
        });
    }
    insert_dictionary(dictionary, table_name) {
        const columns = Object.keys(dictionary).join(",");
        const ques = Object.values(dictionary)
            .map(() => "?")
            .join(",");
        const order = `INSERT INTO ${table_name}(${columns}) VALUES(${ques})`;
        this.pool.query(order, Object.values(dictionary), (err) => {
            if (err) {
                console.error("error writing to database: " + err.stack);
                return;
            }
        });
    }
    write_log(message, importance) {
        const values = {
            _datetime: new Date(),
            _importance: importance,
            _message: message,
        };
        this.insert_dictionary(values, "log_conf_backend");
        console.log(`${new Date()} ${importance.toUpperCase()}: ${message}`);
    }
    write_status() {
        const cpus = node_os_1.default.cpus();
        let total_ms = 0;
        let working_ms = 0;
        for (const cpu of cpus) {
            working_ms += cpu.times.user; // user: ユーザーモードで実行されたプログラムに割り当てられた時間
            working_ms += cpu.times.nice; // nice: Unix/Linuxシステムにおける、低い優先度で実行されるプロセスの時間
            working_ms += cpu.times.sys; // sys: オペレーティングシステム自体が動作するための処理時間
            working_ms += cpu.times.irq; // irq: ハードウェアからの割り込み信号を処理するための時間
            total_ms += cpu.times.idle; // idle: CPUが何も処理していない、アイドル時間
            total_ms += working_ms;
        }
        const CPU_usage = ((working_ms / total_ms) * 100).toFixed(2); // %
        const MEM_usage = (((node_os_1.default.totalmem() - node_os_1.default.freemem()) / node_os_1.default.totalmem()) * 100).toFixed(2); // %
        const MEM_amount = ((node_os_1.default.totalmem() - node_os_1.default.freemem()) / 1024 / 1024).toFixed(2); // MB
        const values = {
            _datetime: new Date(),
            current_client: io.engine.clientsCount,
            new_client_univ: status.newConnectedClients.univ,
            new_client_other: status.newConnectedClients.other,
            leave_client: status.leave_clients,
            cpu_usage: CPU_usage,
            memory_usage: MEM_usage,
            memory_usage_mb: MEM_amount,
        };
        this.insert_dictionary(values, "status_conf_backend");
        console.log(`${new Date()}, ${Object.keys(values).join(",")}`);
        status.newConnectedClients.univ = 0;
        status.newConnectedClients.other = 0;
        status.leave_clients = 0;
    }
}
const redis_connection = new RedisClient();
const mysql_connection = new MySQLClient();
// 静的ファイルのホスティング
app.use("/", express_1.default.static(path_1.default.join(__dirname, "public")));
app.use((0, helmet_1.default)());
// Redisクライアントの設定
if (!process.env.REDIS_HOST)
    process.env.REDIS_HOST = "localhost";
if (!process.env.REDIS_HOST)
    process.env.REDIS_PORT = "6379";
if (!process.env.ENABLE_IP_CHECK)
    process.env.ENABLE_IP_CHECK = "false";
io.on("connection", (socket) => {
    console.log("A user connected");
});
// 1分ごとにアクセスされた回数と現在接続されているクライアント数をコンソールに表示
setInterval(() => {
    mysql_connection.write_status();
}, 1000 * 60); // 1分間
// サーバー起動
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
