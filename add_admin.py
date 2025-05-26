import sqlite3
from werkzeug.security import generate_password_hash

conn = sqlite3.connect("db/base.db")
c = conn.cursor()

username = "admin"
password = "1576MAMAkaka"  # можно поменять
hash_ = generate_password_hash(password)

c.execute("INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)", (username, hash_))
conn.commit()
conn.close()

print("✅ Админ добавлен")
