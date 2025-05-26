import sqlite3

db_path = 'db/base.db'

conn = sqlite3.connect(db_path)
c = conn.cursor()

# 1. Создание новой таблицы без UNIQUE
c.execute('''
    CREATE TABLE IF NOT EXISTS cartridges_temp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        min_quantity INTEGER NOT NULL,
        printer_model TEXT,
        organization TEXT,
        manufacturer TEXT
    )
''')

# 2. Перенос данных
c.execute('''
    INSERT INTO cartridges_temp (id, name, quantity, min_quantity, printer_model, organization, manufacturer)
    SELECT id, name, quantity, min_quantity, printer_model, organization, manufacturer FROM cartridges
''')

# 3. Удаление старой таблицы и переименование
c.execute("DROP TABLE cartridges")
c.execute("ALTER TABLE cartridges_temp RENAME TO cartridges")

conn.commit()
conn.close()
print("✅ Таблица cartridges обновлена — UNIQUE удалён.")
