import express from "express";
import path from "path";
import http from "http";
import socketIO from "socket.io";
import Redis from "ioredis";
import helmet from "helmet";
import mysql from "mysql";
import os from "node:os";
import { cp, stat } from "fs";

// Server and Socket
const app = express();
const port: number = Number(process.env.PORT) || 3000;
const server = http.createServer(app);
const io = socketIO(server);

class RedisClient {
  private client: Redis.RedisClient;
  private subscriber: Redis.RedisClient;

  constructor() {
    this.client = new Redis({
      port: Number(process.env.REDIS_PORT),
      host: process.env.REDIS_HOST,
    });
    this.subscriber = new Redis({
      port: Number(process.env.REDIS_PORT),
      host: process.env.REDIS_HOST,
    });

    this.client.on("connect", () => {
      console.log("Connected to Redis");
    });

    this.client.on("error", (err: any) => {
      console.error("Redis error:", err);
    });

    this.subscriber.subscribe("update_notice_channel", () => {
      console.log("Subscribed to channel");
    });
  }

  // Set a value in Redis
  async setValue(key: string, value: string): Promise<void> {
    try {
      await this.client.set(key, value);
    } catch (err) {
      console.error("Error setting value:", err);
    }
  }

  // Get a value from Redis
  async getValue(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      return value;
    } catch (err) {
      console.error("Error getting value:", err);
      return null;
    }
  }

  // Close the Redis connection
  closeConnection(): void {
    this.client.quit();
  }
}

class MySQLClient {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });
  }

  insert_dictionary(dictionary: { [key: string]: any }, table_name: string) {
    const columns = Object.keys(dictionary).join(",");
    const ques = Object.values(dictionary)
      .map(() => "?")
      .join(",");
    const order = `INSERT INTO ${table_name}(${columns}) VALUES(${ques})`;
    this.pool.query(order, Object.values(dictionary), (err: any) => {
      if (err) {
        console.error("error writing to database: " + err.stack);
        return;
      }
    });
  }
}

const redis_connection = new RedisClient();
const mysql_connection = new MySQLClient();

// 静的ファイルのホスティング
app.use("/", express.static(path.join(__dirname, "public")));
app.use(helmet());

// Redisクライアントの設定
if (!process.env.REDIS_HOST) process.env.REDIS_HOST = "localhost";
if (!process.env.REDIS_HOST) process.env.REDIS_PORT = "6379";
if (!process.env.ENABLE_IP_CHECK) process.env.ENABLE_IP_CHECK = "false";

io.on("connection", (socket: any) => {
  console.log("A user connected");
});

// サーバー起動
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
