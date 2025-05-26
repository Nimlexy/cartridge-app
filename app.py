from flask import Flask, request, jsonify, send_from_directory, Response, redirect, url_for, session, render_template_string
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import sqlite3
import os

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = "secret-key-123"
DB_PATH = os.path.join('db', 'base.db')

# ---------------- INIT DB ----------------

def init_db():
    os.makedirs('db', exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()

        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS cartridges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                min_quantity INTEGER NOT NULL,
                printer_model TEXT,
                organization TEXT,
                manufacturer TEXT
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cartridge_id INTEGER NOT NULL,
                change INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(cartridge_id) REFERENCES cartridges(id)
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS writeoffs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT NOT NULL,
                initiator TEXT NOT NULL,
                cartridge_id INTEGER NOT NULL,
                printer_model TEXT NOT NULL,
                organization TEXT NOT NULL,
                cartridge_type TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(cartridge_id) REFERENCES cartridges(id)
            )
        ''')

        c.execute("SELECT * FROM users WHERE username = 'admin'")
        if not c.fetchone():
            hash_ = generate_password_hash("1576MAMAkaka")
            c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", ('admin', hash_))

        conn.commit()

# ---------------- AUTH ----------------

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
            user = c.fetchone()

        if user and check_password_hash(user[1], password):
            session['user_id'] = user[0]
            session['username'] = username
            return redirect('/')
        return render_template_string(LOGIN_HTML, error="Неверный логин или пароль")

    return render_template_string(LOGIN_HTML)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

LOGIN_HTML = '''
<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Вход</title>
<style>body{display:flex;align-items:center;justify-content:center;height:100vh;background:#f9f9f9;font-family:sans-serif}
form{background:#fff;padding:2rem;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}input{display:block;margin-bottom:1rem;width:100%;padding:.5rem}
button{padding:.5rem 1rem;background:#2563eb;color:#fff;border:none;border-radius:4px}label{font-size:.9rem}
</style></head>
<body>
<form method="POST">
  <h2 style="margin-bottom:1rem;">Авторизация</h2>
  {% if error %}<div style="color:red;margin-bottom:1rem">{{ error }}</div>{% endif %}
  <label>Логин</label><input name="username" required>
  <label>Пароль</label><input name="password" type="password" required>
  <button type="submit">Войти</button>
</form></body></html>
'''

# ---------------- ROUTES ----------------

@app.route('/')
@login_required
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
@login_required
def serve_static(filename):
    return send_from_directory('.', filename)

@app.route('/get_cartridges')
@login_required
def get_cartridges():
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("""
            SELECT id, name, quantity, min_quantity, printer_model, organization, manufacturer
            FROM cartridges
            ORDER BY name COLLATE NOCASE, organization COLLATE NOCASE, manufacturer COLLATE NOCASE
        """)
        rows = c.fetchall()
    return jsonify([
        {
            "id": row[0],
            "name": row[1],
            "quantity": row[2],
            "min_quantity": row[3],
            "printer_model": row[4] or "—",
            "organization": row[5] or "—",
            "manufacturer": row[6] or "—"
        }
        for row in rows
    ])

@app.route('/supply_cartridge', methods=['POST'])
@login_required
def supply_cartridge():
    data = request.get_json()
    name = data.get('name').strip()
    quantity = int(data.get('quantity'))
    printer_model = data.get('printer_model').strip()
    organization = data.get('organization', '').strip()
    manufacturer = data.get('cartridge_type', '').strip()

    if not name or not printer_model or not manufacturer or quantity <= 0:
        return jsonify({"error": "Недостаточно данных"}), 400

    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''
            SELECT id FROM cartridges
            WHERE name = ? AND printer_model = ? AND organization = ? AND manufacturer = ?
        ''', (name, printer_model, organization, manufacturer))
        result = c.fetchone()

        if result:
            cartridge_id = result[0]
            c.execute("UPDATE cartridges SET quantity = quantity + ? WHERE id = ?", (quantity, cartridge_id))
        else:
            c.execute('''
                INSERT INTO cartridges (name, quantity, min_quantity, printer_model, organization, manufacturer)
                VALUES (?, ?, 1, ?, ?, ?)
            ''', (name, quantity, printer_model, organization, manufacturer))
            cartridge_id = c.lastrowid

        c.execute("INSERT INTO transactions (cartridge_id, change) VALUES (?, ?)", (cartridge_id, quantity))
        conn.commit()

    return jsonify({"success": True})

@app.route('/writeoff_extended', methods=['POST'])
@login_required
def writeoff_extended():
    data = request.get_json()
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("UPDATE cartridges SET quantity = quantity - ? WHERE id = ?", (data['quantity'], data['cartridge_id']))
        c.execute("INSERT INTO transactions (cartridge_id, change) VALUES (?, ?)", (data['cartridge_id'], -abs(data['quantity'])))
        c.execute('''
            INSERT INTO writeoffs (
                order_number, initiator, cartridge_id,
                printer_model, organization, cartridge_type, quantity
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['order_number'], data['initiator'], data['cartridge_id'],
            data['printer_model'], data['organization'], data['cartridge_type'], data['quantity']
        ))
        conn.commit()

    return jsonify({"success": True})

@app.route('/update_cartridge', methods=['POST'])
@login_required
def update_cartridge():
    data = request.get_json()
    cartridge_id = int(data.get('id'))
    name = data.get('name').strip()
    printer_model = data.get('printer_model', '').strip()
    manufacturer = data.get('manufacturer', '').strip()
    organization = data.get('organization', '').strip()
    quantity = int(data.get('quantity'))
    min_quantity = int(data.get('min_quantity'))

    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''
            SELECT id FROM cartridges
            WHERE name = ? AND printer_model = ? AND organization = ? AND manufacturer = ? AND id != ?
        ''', (name, printer_model, organization, manufacturer, cartridge_id))
        conflict = c.fetchone()
        if conflict:
            return jsonify({"error": "Такая комбинация уже существует!"}), 409

        c.execute('''
            UPDATE cartridges
            SET name = ?, printer_model = ?, manufacturer = ?, organization = ?,
                quantity = ?, min_quantity = ?
            WHERE id = ?
        ''', (name, printer_model, manufacturer, organization, quantity, min_quantity, cartridge_id))
        conn.commit()

    return jsonify({"success": True})

@app.route('/get_statistics')
@login_required
def get_statistics():
    date = request.args.get('date')
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM cartridges")
        total_models = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM cartridges WHERE quantity < min_quantity")
        below_minimum = c.fetchone()[0]

        c.execute("SELECT SUM(change) FROM transactions WHERE change > 0 AND DATE(timestamp) = ?", (date,))
        supplied = c.fetchone()[0] or 0

        c.execute("SELECT SUM(ABS(change)) FROM transactions WHERE change < 0 AND DATE(timestamp) = ?", (date,))
        written_off = c.fetchone()[0] or 0

    return jsonify({
        "total_models": total_models,
        "below_minimum": below_minimum,
        "supplied": supplied,
        "written_off": written_off
    })

@app.route('/export_stock')
@login_required
def export_stock():
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("SELECT name, printer_model, manufacturer, quantity, min_quantity, organization FROM cartridges")
        rows = c.fetchall()

    def generate():
        yield "Модель,Принтер,Производитель,Остаток,Минимум,Организация\n"
        for row in rows:
            yield f"{row[0]},{row[1]},{row[2]},{row[3]},{row[4]},{row[5]}\n"

    return Response(generate(), mimetype='text/csv', headers={
        "Content-Disposition": "attachment; filename=nalichie_export.csv"
    })

@app.route('/export_history')
@login_required
def export_history():
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''
            SELECT cartridges.name, transactions.change, transactions.timestamp
            FROM transactions
            JOIN cartridges ON transactions.cartridge_id = cartridges.id
            ORDER BY transactions.timestamp DESC
        ''')
        rows = c.fetchall()

    def generate():
        yield "Картридж,Изменение,Дата\n"
        for row in rows:
            yield f"{row[0]},{row[1]},{row[2]}\n"

    return Response(generate(), mimetype='text/csv', headers={
        "Content-Disposition": "attachment; filename=history.csv"
    })

# ---------------- START ----------------
if __name__ == '__main__':
    init_db()
    app.run()
