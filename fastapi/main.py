import collections
import datetime as dt
import hmac
import os
import threading
import time
import traceback

import mysql.connector
import redis
from fastapi import FastAPI

# configs
ANALYZE_INTERVAL_SEC: float = float(os.getenv("ANALYZE_INTERVAL_SEC", default="3"))
SQL_CONNECT_TRY_COUNT: int = int(os.getenv("SQL_CONNECT_TRY_COUNT", default="10"))
fastapi = FastAPI()


class MySQL_Connection:
    def __init__(self):
        for i in range(SQL_CONNECT_TRY_COUNT):
            try:
                _host = os.getenv("MYSQL_HOST")
                _database = os.getenv("MYSQL_DATABASE")
                _user = os.getenv("MYSQL_USER")
                _password = os.getenv("MYSQL_PASSWORD")
                self._sql_connection = mysql.connector.connect(host=_host, database=_database, user=_user, password=_password)
            except mysql.connector.Error as e:
                print("Connection Error", i, str(e))
                time.sleep(5)
            else:
                print("Connection Success", i)
                break
        self._sql_cursor = self._sql_connection.cursor()
        self._sql_connection.commit()

    def insert_dictionary(self, params: dict, table_name: str):
        # Insert dictionary to MySQL
        # オーダー文の誤りを防ぐために、Insertを行うときはこの関数から実行すること
        try:
            columns = ", ".join(params.keys())
            questions = ", ".join(["%s"] * len(params))
            order = f"INSERT INTO {table_name} ({columns}) VALUES ({questions})"
            tup = tuple(params.values())
            self._sql_cursor.execute(order, tup)
            self._sql_connection.commit()
        except mysql.connector.Error as e:
            lprint(e)

    def write_log(self, message: str, importance: str) -> None:
        importance = importance.upper()
        parameter = {"_datetime": dt.datetime.now(), "_importance": importance, "_message": message}
        self.insert_dictionary(params=parameter, table_name="log_conf_api")

    def get_data(self, order: str, parameters: tuple):
        self._sql_cursor.execute(order, parameters)
        return self._sql_cursor.fetchall()

    def is_connected(self) -> bool:
        return self._sql_connection.is_connected()

    def close(self):
        self._sql_cursor.close()
        self._sql_connection.close()


class Redis_Connection:
    def __init__(self):
        _host = str(os.getenv("REDIS_HOST"))
        _port = int(os.getenv("REDIS_PORT", default="6379"))
        _db = 0
        self.redis_connection = redis.Redis(host=_host, port=_port, db=_db)
        lprint("Redis Connection Success")

    def set(self, key: str, data: str):
        self.redis_connection.set(key, data)

    def get(self, key):
        return self.redis_connection.get(key)

    def publish(self, key: str, data: str):
        self.redis_connection.publish(key, data)

    def close(self):
        self.redis_connection.close()


def lprint(*args):
    print(dt.datetime.now().strftime("%Y/%m/%d %H:%M:%S"), args)
    try:
        sql_connection.write_log(message=" ".join(map(str, args)), importance="INFO")
    except (NameError, mysql.connector.Error) as e:
        print(e)


@fastapi.post("/front/")
async def api_post(raw_data: dict):
    return {"message": str(raw_data)}


@fastapi.on_event("shutdown")
def shutdown_event():
    sql_connection.close()
    redis_connection.close()


sql_connection = MySQL_Connection()
redis_connection = Redis_Connection()

if __name__ == "app.main" or __name__ == "__main__":
    # uvicorn app.main:fastapi --host 0.0.0.0 --port 80
    print("Start")
